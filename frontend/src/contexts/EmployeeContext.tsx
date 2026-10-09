import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../config";
import { useBiometrics } from '../hooks/useBiometrics';
import { ShieldCheck, Lock } from 'lucide-react';

export interface BehavioralMetrics {
  avgDwell: number;
  avgFlight: number;
  mouseVelocity: number;
  mouseCurvature: number;
}

export type WsStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

interface EmployeeContextType {
  trustScore: number;
  isEnrolled: boolean;
  enrollmentProgress: number;
  isLocked: boolean;
  isSimulated: boolean;
  isImpostor: boolean;
  setIsImpostor: (val: boolean) => void;
  mySessions: any[];
  contributions: Record<string, number>;
  radarData: any[];
  scoreHistory: {time: string, score: number}[];
  alerts: {timestamp: string, type: string, score: number}[];
  liveMetrics: BehavioralMetrics;
  baselineMetrics: BehavioralMetrics;
  handleReauth: () => void;
  wsStatus: WsStatus;
  networkRiskScore: number;
  networkSeverity: string;
  networkBreakdown: Record<string, any>;
  latencyStats: { avg_latency_ms: number; jitter_ms: number };
}

const EmployeeContext = createContext<EmployeeContextType | null>(null);

export const useEmployeeContext = () => {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployeeContext must be used within EmployeeProvider");
  return ctx;
};

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
const MAX_RETRIES = 10;

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const role = localStorage.getItem('trustloop_role');
  const sessionIdStr = localStorage.getItem('trustloop_session_id');
  const sessionId = sessionIdStr ? parseInt(sessionIdStr) : 0;
  
  const [trustScore, setTrustScore] = useState(100);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isImpostor, setIsImpostor] = useState(false);
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [contributions, setContributions] = useState<Record<string, number>>({});
  const [radarData, setRadarData] = useState<any[]>([]);
  const [scoreHistory, setScoreHistory] = useState<{time: string, score: number}[]>([]);
  const [alerts, setAlerts] = useState<{timestamp: string, type: string, score: number}[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');

  // Network security telemetry
  const [networkRiskScore, setNetworkRiskScore] = useState<number>(0);
  const [networkSeverity, setNetworkSeverity] = useState<string>('healthy');
  const [networkBreakdown, setNetworkBreakdown] = useState<Record<string, any>>({});
  const [latencyStats, setLatencyStats] = useState<{ avg_latency_ms: number; jitter_ms: number }>({
    avg_latency_ms: 12.0,
    jitter_ms: 1.5
  });
  
  const [liveMetrics, setLiveMetrics] = useState<BehavioralMetrics>({
    avgDwell: 110,
    avgFlight: 140,
    mouseVelocity: 450,
    mouseCurvature: 0.25
  });
  
  const [baselineMetrics, setBaselineMetrics] = useState<BehavioralMetrics>({
    avgDwell: 110,
    avgFlight: 140,
    mouseVelocity: 450,
    mouseCurvature: 0.25
  });

  const isSimulated = localStorage.getItem('trustloop_is_simulated') === 'true';
  const ws = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDestroyed = useRef(false);

  // ─── WebSocket message handler ───────────────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "enroll_update") {
        if (data.status === "model_trained" || data.status === "already_enrolled") {
          setIsEnrolled(true);
          setEnrollmentProgress(1.0);
        } else if (data.progress !== undefined) {
          setEnrollmentProgress(data.progress);
        }
        if (data.baseline_means) {
          setBaselineMetrics(data.baseline_means);
        }
      } else if (data.type === "score_update") {
        const newScore = Math.round(data.trust_score);
        setTrustScore(newScore);
        
        if (data.contributions) setContributions(data.contributions);
        if (data.live_averages) setLiveMetrics(data.live_averages);
        if (data.baseline_means) setBaselineMetrics(data.baseline_means);

        if (data.baseline_means && data.live_averages) {
           setRadarData([
             { subject: 'Dwell Time', A: data.baseline_means.avgDwell, B: data.live_averages.avgDwell, fullMark: Math.max(data.baseline_means.avgDwell, data.live_averages.avgDwell) * 1.2 },
             { subject: 'Flight Time', A: data.baseline_means.avgFlight, B: data.live_averages.avgFlight, fullMark: Math.max(data.baseline_means.avgFlight, data.live_averages.avgFlight) * 1.2 },
             { subject: 'Velocity', A: data.baseline_means.mouseVelocity, B: data.live_averages.mouseVelocity, fullMark: Math.max(data.baseline_means.mouseVelocity, data.live_averages.mouseVelocity) * 1.2 },
             { subject: 'Curvature', A: data.baseline_means.mouseCurvature, B: data.live_averages.mouseCurvature, fullMark: Math.max(data.baseline_means.mouseCurvature, data.live_averages.mouseCurvature) * 1.2 },
           ]);
        }
        
        if (newScore < (data.lock_threshold || 60) && !isLocked) {
          setIsLocked(true);
          setIsImpostor(false);
        }
        
        setScoreHistory(prev => {
          const newHist = [...prev, { time: new Date().toLocaleTimeString([], {hour12:false}), score: newScore }];
          if (newHist.length > 30) return newHist.slice(newHist.length - 30);
          return newHist;
        });

        if (newScore < (data.risk_threshold || 80) && newScore >= (data.lock_threshold || 60)) {
          setAlerts(prev => {
            if (prev.length === 0 || prev[0].type !== 'Elevated Risk Detected') {
               return [{ timestamp: new Date().toLocaleTimeString(), type: 'Elevated Risk Detected', score: newScore }, ...prev];
            }
            return prev;
          });
        } else if (newScore < (data.lock_threshold || 60)) {
          setAlerts(prev => {
             if (prev.length === 0 || prev[0].type !== 'Session Locked') {
               return [{ timestamp: new Date().toLocaleTimeString(), type: 'Session Locked', score: newScore }, ...prev];
             }
             return prev;
          });
        }
      } else if (data.type === "network_update") {
        if (data.network_risk_score !== undefined) setNetworkRiskScore(data.network_risk_score);
        if (data.severity) setNetworkSeverity(data.severity);
        if (data.breakdown) setNetworkBreakdown(data.breakdown);
        if (data.latency_stats) setLatencyStats(data.latency_stats);
      } else if (data.type === "pong") {
        if (data.latency_stats) setLatencyStats(data.latency_stats);
      }
    } catch (e) {
      console.error("WS parse error:", e);
    }
  }, [isLocked]);

  // ─── WebSocket connection with JWT auth & reconnect backoff ──────────────────
  const connect = useCallback(() => {
    if (isDestroyed.current || role !== 'employee' || !sessionId) return;

    setWsStatus(retryCount.current === 0 ? 'connecting' : 'reconnecting');

    const token = localStorage.getItem('trustloop_token') || '';
    const socket = new WebSocket(`${WS_BASE_URL}/ws/session/${sessionId}?token=${encodeURIComponent(token)}`);
    ws.current = socket;

    socket.onopen = () => {
      if (isDestroyed.current) { socket.close(); return; }
      retryCount.current = 0;
      setWsStatus('connected');

      // Send initial device fingerprint telemetry
      const ua = navigator.userAgent;
      socket.send(JSON.stringify({
        action: "device_telemetry",
        device: {
          browser: ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : "Browser",
          os: ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : "Linux",
          screen: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language || "en"
        }
      }));
    };

    socket.onmessage = handleMessage;

    socket.onclose = () => {
      if (isDestroyed.current) return;
      ws.current = null;
      setWsStatus('disconnected');

      if (retryCount.current >= MAX_RETRIES) {
        setWsStatus('failed');
        return;
      }

      const delay = BACKOFF_MS[Math.min(retryCount.current, BACKOFF_MS.length - 1)];
      retryCount.current += 1;
      retryTimer.current = setTimeout(connect, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [role, sessionId, handleMessage]);

  // ─── Fetch sessions + start WS on mount ──────────────────────────────────────
  useEffect(() => {
    if (role !== 'employee' || !sessionId) return;

    isDestroyed.current = false;
    retryCount.current = 0;

    const token = localStorage.getItem('trustloop_token') || '';
    fetch(`${API_BASE_URL}/api/employee/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMySessions(data);
      })
      .catch(console.error);

    connect();

    // Ping interval for RTT latency & jitter measurement
    const pingInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ action: "ping", client_time: Date.now() / 1000 }));
      }
    }, 5000);

    return () => {
      isDestroyed.current = true;
      clearInterval(pingInterval);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [role, sessionId, connect]);

  // ─── Send biometric data over the socket ─────────────────────────────────────
  const handleCapture = (features: any) => {
    if (isLocked) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const modifiedFeatures = isImpostor ? {
        ...features,
        avgDwell: (features.avgDwell || 120) * 4 + 100,
        avgFlight: (features.avgFlight || 150) * 0.2,
        mouseVelocity: (features.mouseVelocity || 0.5) * 5,
        mouseCurvature: (features.mouseCurvature || 0.1) * 8 + 0.5
      } : features;

      ws.current.send(JSON.stringify({
        action: isEnrolled ? "live" : "enroll",
        features: modifiedFeatures
      }));
    }
  };

  useBiometrics(handleCapture);

  const handleReauth = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "reset" }));
      setIsLocked(false);
      setTrustScore(100);
      setAlerts(prev => [{ timestamp: new Date().toLocaleTimeString(), type: 'Re-Authenticated Successfully', score: 100 }, ...prev]);
    }
  };

  return (
    <EmployeeContext.Provider value={{
      trustScore,
      isEnrolled,
      enrollmentProgress,
      isLocked,
      isSimulated,
      isImpostor,
      setIsImpostor,
      mySessions,
      contributions,
      radarData,
      scoreHistory,
      alerts,
      liveMetrics,
      baselineMetrics,
      handleReauth,
      wsStatus,
      networkRiskScore,
      networkSeverity,
      networkBreakdown,
      latencyStats
    }}>
      {children}
      
      {/* Session Lock Screen Overlay */}
      {isLocked && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(16, 24, 40, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '24px'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', border: '1px solid var(--accent-danger)' }}>
            <div style={{ display: 'inline-flex', padding: '16px', backgroundColor: 'rgba(240, 68, 56, 0.1)', borderRadius: '50%', marginBottom: '16px' }}>
              <Lock size={40} color="var(--accent-danger)" />
            </div>
            <h2 className="display-font" style={{ fontSize: '24px', marginBottom: '8px' }}>Session Locked</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Your behavioral biometric trust score fell below the acceptable threshold. To protect company assets, your session has been suspended.
            </p>
            <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current Trust Score</span>
                <span className="mono-font" style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>{trustScore} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Trigger Condition</span>
                <span style={{ fontSize: '12px' }}>Dwell/Flight Pattern Deviation</span>
              </div>
            </div>
            <button 
              className="btn-primary" 
              style={{ width: '100%' }}
              onClick={handleReauth}
            >
              Re-Authenticate (Demo Bypass)
            </button>
          </div>
        </div>
      )}
    </EmployeeContext.Provider>
  );
};
