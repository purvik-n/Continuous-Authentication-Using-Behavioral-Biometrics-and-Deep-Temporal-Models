import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useBiometrics } from '../hooks/useBiometrics';
import { ShieldCheck, Lock } from 'lucide-react';

export interface BehavioralMetrics {
  avgDwell: number;
  avgFlight: number;
  mouseVelocity: number;
  mouseCurvature: number;
}

interface EmployeeContextType {
  trustScore: number;
  isEnrolled: boolean;
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
}

const EmployeeContext = createContext<EmployeeContextType | null>(null);

export const useEmployeeContext = () => {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error("useEmployeeContext must be used within EmployeeProvider");
  return ctx;
};

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const role = localStorage.getItem('trustloop_role');
  const sessionIdStr = localStorage.getItem('trustloop_session_id');
  const sessionId = sessionIdStr ? parseInt(sessionIdStr) : 0;
  
  const [trustScore, setTrustScore] = useState(100);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isImpostor, setIsImpostor] = useState(false);
  const [mySessions, setMySessions] = useState([]);
  const [contributions, setContributions] = useState<Record<string, number>>({});
  const [radarData, setRadarData] = useState<any[]>([]);
  const [scoreHistory, setScoreHistory] = useState<{time: string, score: number}[]>([]);
  const [alerts, setAlerts] = useState<{timestamp: string, type: string, score: number}[]>([]);
  
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

  // Reused from EmployeeOverview
  useEffect(() => {
    if (role !== 'employee' || !sessionId) return;
    
    const uid = localStorage.getItem('trustloop_user_id') || '1';
    fetch(`http://localhost:8000/api/employee/sessions?user_id=${uid}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMySessions(data);
      })
      .catch(console.error);
      
    ws.current = new WebSocket(`ws://localhost:8000/ws/session/${sessionId}`);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "enroll_update") {
        if (data.status === "model_trained" || data.status === "already_enrolled") {
          setIsEnrolled(true);
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
      }
    };
    
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [role, sessionId]);

  const handleCapture = (features: any) => {
    if (isLocked) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const modifiedFeatures = isImpostor ? {
        ...features,
        avgDwell: (features.avgDwell || 120) * 4 + 100,
        avgFlight: (features.avgFlight || 150) * 0.2,
        mouseVelocity: (features.mouseVelocity || 0.5) * 5,
        mouseCurvature: (features.mouseCurvature || 0.2) + 10
      } : features;

      ws.current.send(JSON.stringify({
        action: isEnrolled ? "live" : "enroll",
        features: modifiedFeatures
      }));
    }
  };

  const { startCapture, stopCapture } = useBiometrics(handleCapture);

  useEffect(() => {
    if (role === 'employee' && sessionId && !isLocked) {
      startCapture();
    } else {
      stopCapture();
    }
    return stopCapture;
  }, [role, sessionId, isLocked, startCapture, stopCapture]);

  const handleReauth = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "reset" }));
    }
    setIsLocked(false);
    setTrustScore(100);
    setAlerts(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      type: 'Session Re-Authenticated',
      score: 100
    }, ...prev]);
  };

  return (
    <EmployeeContext.Provider value={{ trustScore, isEnrolled, isLocked, isSimulated, isImpostor, setIsImpostor, mySessions, contributions, radarData, scoreHistory, alerts, liveMetrics, baselineMetrics, handleReauth }}>
      {children}
      
      {/* Global Lock Overlay */}
      {isLocked && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '400px', padding: '32px', border: '1px solid var(--border-subtle)', borderRadius: '12px', backgroundColor: 'var(--bg-surface)' }}>
            <Lock size={48} color="var(--accent-danger)" style={{ marginBottom: '16px' }} />
            <h2 className="display-font" style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--accent-danger)' }}>Session Locked</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Your session was locked due to anomalous behavioral patterns. Please re-authenticate to continue.
            </p>
            <button className="btn-primary" onClick={handleReauth} style={{ width: '100%', padding: '12px', fontSize: '16px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <ShieldCheck size={20} /> Verify Identity
            </button>
          </div>
        </div>
      )}
    </EmployeeContext.Provider>
  );
};
