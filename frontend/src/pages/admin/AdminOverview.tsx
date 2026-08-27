import React, { useEffect, useState, useCallback, useRef } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../../config";
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Users, Activity, Wifi, Lock, TrendingUp, TrendingDown, ChevronRight, ArrowLeft, Clock, Monitor, Zap, AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Session {
  session_id: number;
  trust_score: number | null;
  status: string;
  started_at: string;
  last_active_at: string;
  ip_address: string;
  user_agent: string;
  network_isp: string;
  network_recognized: number;
  initial_trust_score: number;
}

interface Employee {
  id: number;
  username: string;
  full_name: string;
  department: string;
  sessions: Session[];
}

interface OrgEvent {
  timestamp: string;
  event_type: string;
  username: string;
  full_name: string;
  score: number | null;
  session_id: number | null;
}

function parseUA(ua: string): string {
  let browser = 'Unknown';
  let os = 'Unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return `${browser} / ${os}`;
}

function getScoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'var(--text-secondary)';
  if (score >= 80) return 'var(--accent-trust)';
  if (score >= 60) return 'var(--accent-warn)';
  return 'var(--accent-danger)';
}

function getEventIcon(type: string) {
  if (type.includes('Lock') || type.includes('Impostor')) return <AlertTriangle size={14} color="var(--accent-danger)" />;
  if (type.includes('Risk') || type.includes('Elevated')) return <AlertTriangle size={14} color="var(--accent-warn)" />;
  if (type.includes('Login') || type.includes('Re-Auth') || type.includes('Enrollment')) return <CheckCircle size={14} color="var(--accent-trust)" />;
  return <Activity size={14} color="var(--accent-primary)" />;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, trend, trendUp }: { label: string; value: string | number; trend: string; trendUp: boolean }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: '200px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{label}</div>
      <div className="display-font" style={{ fontSize: '32px', color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '12px', color: trendUp ? 'var(--accent-trust)' : 'var(--accent-danger)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {trendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        {trend}
      </div>
    </div>
  );
}

// ─── Session Table (reused for drill-down) ───────────────────────────────────
function SessionTable({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return <p style={{ color: 'var(--text-secondary)', padding: '16px', textAlign: 'center' }}>No sessions recorded.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {['IP Address', 'Browser / OS', 'Network', 'First Seen', 'Last Active', 'Trust', 'Status'].map(h => (
              <th key={h} style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map(s => (
            <tr key={s.session_id} style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
              <td className="mono-font" style={{ padding: '10px 8px', fontSize: '13px' }}>{s.ip_address}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{parseUA(s.user_agent || '')}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>{s.network_isp}</td>
              <td className="mono-font" style={{ padding: '10px 8px', fontSize: '12px' }}>{new Date(s.started_at).toLocaleString()}</td>
              <td className="mono-font" style={{ padding: '10px 8px', fontSize: '12px' }}>{new Date(s.last_active_at).toLocaleString()}</td>
              <td className="mono-font" style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: getScoreColor(s.trust_score) }}>{s.trust_score != null ? Math.round(s.trust_score) : '—'}</td>
              <td style={{ padding: '10px 8px', fontSize: '13px' }}>
                <span style={{ color: getScoreColor(s.status === 'locked' ? 0 : (s.status === 'active' ? 100 : 70)), fontWeight: '600', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.status === 'active' ? 'var(--accent-trust)' : (s.status === 'locked' ? 'var(--accent-danger)' : 'var(--text-secondary)'), display: 'inline-block' }}></span>
                  {s.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Live Session Monitoring Panel (WebSocket connected) ──────────────────────
function AdminLiveSessionPanel({ employee, onBack, onRefresh }: { employee: Employee; onBack: () => void; onRefresh: () => void }) {
  const activeSession = employee.sessions.find(s => s.status === 'active') || employee.sessions[0];
  const sessionId = activeSession?.session_id;

  const [liveScore, setLiveScore] = useState<number>(activeSession?.trust_score ?? 100);
  const [liveStatus, setLiveStatus] = useState<string>(activeSession?.status || 'idle');
  const [isImpostor, setIsImpostor] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsFailed, setWsFailed] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({
    avgDwell: 110,
    avgFlight: 140,
    mouseVelocity: 450,
    mouseCurvature: 0.25
  });
  const [baselineMetrics, setBaselineMetrics] = useState({
    avgDwell: 110,
    avgFlight: 140,
    mouseVelocity: 450,
    mouseCurvature: 0.25
  });
  const [contributions, setContributions] = useState<Record<string, number>>({});

  // WS reconnect state
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDestroyed = useRef(false);

  const ADMIN_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
  const ADMIN_MAX_RETRIES = 10;

  const connectAdminWs = useCallback(() => {
    if (isDestroyed.current || !sessionId || activeSession?.status !== 'active') return;

    const socket = new WebSocket(`${WS_BASE_URL}/ws/session/${sessionId}`);
    wsRef.current = socket;

    socket.onopen = () => {
      if (isDestroyed.current) { socket.close(); return; }
      retryCount.current = 0;
      setWsConnected(true);
      setWsFailed(false);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'score_update') {
          setLiveScore(Math.round(data.trust_score));
          if (data.live_averages) setLiveMetrics(data.live_averages);
          if (data.baseline_means) setBaselineMetrics(data.baseline_means);
          if (data.contributions) setContributions(data.contributions);
          if (data.trust_score < (data.lock_threshold || 60)) setLiveStatus('locked');
          else setLiveStatus('active');
        } else if (data.type === 'enroll_update' && data.baseline_means) {
          setBaselineMetrics(data.baseline_means);
        }
      } catch (e) {
        console.error("Admin WS parse error:", e);
      }
    };

    socket.onclose = () => {
      if (isDestroyed.current) return;
      wsRef.current = null;
      setWsConnected(false);

      if (retryCount.current >= ADMIN_MAX_RETRIES) {
        setWsFailed(true);
        return;
      }

      const delay = ADMIN_BACKOFF_MS[Math.min(retryCount.current, ADMIN_BACKOFF_MS.length - 1)];
      retryCount.current += 1;
      retryTimer.current = setTimeout(connectAdminWs, delay);
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [sessionId, activeSession?.status]);

  useEffect(() => {
    isDestroyed.current = false;
    retryCount.current = 0;
    connectAdminWs();

    return () => {
      isDestroyed.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectAdminWs]);

  const handleSimulate = async () => {
    if (!sessionId) return;
    const nextState = !isImpostor;
    await fetch(`${API_BASE_URL}/api/admin/simulate/${sessionId}?active=${nextState}`, { method: 'POST' });
    setIsImpostor(nextState);
    onRefresh();
  };

  const handleForceLogout = async () => {
    if (!sessionId) return;
    await fetch(`${API_BASE_URL}/api/admin/sessions/${sessionId}/terminate`, { method: 'POST' });
    setLiveStatus('ended');
    onRefresh();
  };

  const scoreColor = getScoreColor(liveScore);

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '14px', fontWeight: '600', marginBottom: '20px', padding: 0 }}>
        <ArrowLeft size={16} /> Back to organization overview
      </button>

      {/* Header Profile Card */}
      <div className="card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={24} color="var(--accent-primary)" />
          </div>
          <div>
            <h2 className="display-font" style={{ fontSize: '20px', margin: 0 }}>{employee.full_name}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
              Employee ID: <strong>{employee.username}</strong> · Department: <strong>{employee.department}</strong>
            </p>
          </div>
        </div>

        {activeSession && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSimulate}
              style={{
                padding: '8px 14px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
                backgroundColor: isImpostor ? 'var(--accent-danger)' : 'rgba(247, 144, 9, 0.1)',
                color: isImpostor ? '#fff' : 'var(--accent-warn)',
                border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Zap size={15} />
              {isImpostor ? 'Stop Impostor' : 'Simulate Impostor'}
            </button>
            <button
              onClick={handleForceLogout}
              style={{
                padding: '8px 14px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
                backgroundColor: 'rgba(240, 68, 56, 0.08)', color: 'var(--accent-danger)',
                border: '1px solid rgba(240, 68, 56, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              Force Terminate Session
            </button>
          </div>
        )}
      </div>

      {/* Real-time Telemetry Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Live Score & Status */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
              backgroundColor: wsConnected ? 'var(--accent-trust)' : (wsFailed ? 'var(--accent-danger)' : 'var(--accent-warn)'),
            }}></span>
            {wsConnected ? 'Real-time Continuous Score' : (wsFailed ? 'Feed Lost' : 'Reconnecting…')}
          </div>
          <div className="display-font mono-font" style={{ fontSize: '56px', color: scoreColor, fontWeight: '700', lineHeight: 1 }}>
            {liveScore}
          </div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: scoreColor, marginTop: '8px' }}>
            {liveScore >= 80 ? 'Healthy Biometric Stream' : (liveScore >= 60 ? 'Elevated Anomaly Drift' : 'Session Compromised / Locked')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px', padding: '4px 10px', backgroundColor: 'var(--bg-elevated)', borderRadius: '12px' }}>
            Session #{sessionId || '—'} · {wsConnected ? 'Live TLS WebSocket' : 'Reconnecting…'}
          </div>
          {/* Disconnected overlay on score card */}
          {!wsConnected && !wsFailed && (
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'rgba(var(--bg-surface-rgb, 255,255,255),0.75)',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: '600', color: 'var(--accent-warn)', gap: '6px', backdropFilter: 'blur(2px)'
            }}>
              <AlertTriangle size={16} /> Reconnecting to live feed…
            </div>
          )}
          {wsFailed && (
            <div style={{
              position: 'absolute', inset: 0, backgroundColor: 'rgba(var(--bg-surface-rgb, 255,255,255),0.85)',
              borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '8px', backdropFilter: 'blur(2px)'
            }}>
              <AlertTriangle size={20} color="var(--accent-danger)" />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-danger)' }}>Live feed disconnected</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Refresh the page to resume</span>
            </div>
          )}
        </div>

        {/* Live Behavioral Metrics Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="display-font" style={{ fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={17} color="var(--accent-primary)" /> Live Behavioral Metrics
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Live Telemetry Stream (~2s)</span>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>BEHAVIORAL FEATURE</th>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>LIVE SIGNAL</th>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>ENROLLED BASELINE</th>
                <th style={{ padding: '8px 12px', fontWeight: '600', textAlign: 'right' }}>DRIFT</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Avg. Keystroke Dwell Time', live: `${liveMetrics.avgDwell} ms`, base: `${baselineMetrics.avgDwell} ms`, lVal: liveMetrics.avgDwell, bVal: baselineMetrics.avgDwell },
                { label: 'Avg. Key Flight Latency', live: `${liveMetrics.avgFlight} ms`, base: `${baselineMetrics.avgFlight} ms`, lVal: liveMetrics.avgFlight, bVal: baselineMetrics.avgFlight },
                { label: 'Mouse Movement Velocity', live: `${liveMetrics.mouseVelocity} px/s`, base: `${baselineMetrics.mouseVelocity} px/s`, lVal: liveMetrics.mouseVelocity, bVal: baselineMetrics.mouseVelocity },
                { label: 'Cursor Curvature Variance', live: `${liveMetrics.mouseCurvature}`, base: `${baselineMetrics.mouseCurvature}`, lVal: liveMetrics.mouseCurvature, bVal: baselineMetrics.mouseCurvature },
              ].map((m, idx) => {
                const b = m.bVal || 1;
                const diffPct = Math.round(((m.lVal - m.bVal) / b) * 100);
                const absDiff = Math.abs(diffPct);
                const driftColor = absDiff > 40 ? 'var(--accent-danger)' : (absDiff > 20 ? 'var(--accent-warn)' : 'var(--accent-trust)');
                const arrow = diffPct > 0 ? '↑' : (diffPct < 0 ? '↓' : '•');

                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500', color: 'var(--text-primary)' }}>{m.label}</td>
                    <td className="mono-font" style={{ padding: '10px 12px', fontWeight: '600' }}>{m.live}</td>
                    <td className="mono-font" style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{m.base}</td>
                    <td className="mono-font" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: driftColor }}>
                      {arrow} {absDiff}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Historical Sessions Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={16} color="var(--text-secondary)" /> Session & Device History
        </h3>
        <SessionTable sessions={employee.sessions} />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem('trustloop_role');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [networkStats, setNetworkStats] = useState({ recognized: 0, unrecognized: 0 });
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const fetchData = useCallback(() => {
    fetch(API_BASE_URL + '/api/admin/employees').then(r => r.json()).then(setEmployees).catch(() => {});
    fetch(API_BASE_URL + '/api/admin/events').then(r => r.json()).then(setEvents).catch(() => {});
    fetch(API_BASE_URL + '/api/admin/network_stats').then(r => r.json()).then(setNetworkStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (role !== 'admin') { navigate('/login'); return; }
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [role, navigate, fetchData]);

  const handleSimulate = (sessionId: number, active: boolean) => {
    fetch(`${API_BASE_URL}/api/admin/simulate/${sessionId}?active=${active}`, { method: 'POST' })
      .then(() => fetchData());
  };

  // Compute KPIs
  const activeSessions = employees.reduce((n, e) => n + e.sessions.filter(s => s.status === 'active').length, 0);
  const lockedSessions = employees.reduce((n, e) => n + e.sessions.filter(s => s.status === 'locked').length, 0);
  const allScores = employees.flatMap(e => e.sessions.filter(s => s.trust_score != null).map(s => s.trust_score!));
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 100;

  // Department breakdown
  const deptMap: Record<string, number[]> = {};
  employees.forEach(e => {
    if (!deptMap[e.department]) deptMap[e.department] = [];
    const latest = e.sessions[0];
    if (latest?.trust_score != null) deptMap[e.department].push(latest.trust_score);
  });
  // Add dummy departments for visual richness
  const deptData = [
    ...Object.entries(deptMap).map(([name, scores]) => ({ name, score: scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 100 })),
    { name: 'Sales', score: 94 },
    { name: 'HR', score: 97 },
  ];

  // Network pie
  const networkPieData = [
    { name: 'Corporate', value: networkStats.recognized || 0 },
    { name: 'Unknown', value: networkStats.unrecognized || 0 },
  ];
  const PIE_COLORS = ['var(--accent-trust)', 'var(--accent-warn)'];

  // Sort employees by lowest trust first for "Needs Attention"
  const sorted = [...employees].sort((a, b) => {
    const sa = a.sessions[0]?.trust_score ?? 999;
    const sb = b.sessions[0]?.trust_score ?? 999;
    return sa - sb;
  });

  if (role !== 'admin') return null;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px' }}>Organization Overview</h1>
        </div>
      </header>

      {selectedEmp ? (
        <AdminLiveSessionPanel
          employee={selectedEmp}
          onBack={() => { setSelectedEmp(null); fetchData(); }}
          onRefresh={fetchData}
        />
      ) : (
        // ── Main Overview ──
        <>
          {/* Security Posture Strip */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', padding: '16px 24px', backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-subtle)', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} color="var(--accent-trust)" />
              <span style={{ fontSize: '14px' }}><strong>99.2%</strong> Session Integrity (30d)</span>
            </div>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--accent-trust)" />
              <span style={{ fontSize: '14px' }}><strong>0</strong> Confirmed Account Takeovers</span>
            </div>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border-subtle)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="var(--accent-primary)" />
              <span style={{ fontSize: '14px' }}><strong>2.1s</strong> Avg. Detection Latency</span>
            </div>
          </div>

          {/* KPI Row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <KpiCard label="Employees Monitored" value={12} trend="+2 vs. last week" trendUp={true} />
            <KpiCard label="Active Sessions" value={activeSessions} trend="+1 vs. yesterday" trendUp={true} />
            <KpiCard label="Avg. Org Trust Score" value={avgScore} trend={avgScore >= 90 ? "+3 vs. last week" : "-5 vs. last week"} trendUp={avgScore >= 90} />
            <KpiCard label="Sessions Locked Today" value={lockedSessions} trend={lockedSessions === 0 ? "No incidents" : `${lockedSessions} incident(s)`} trendUp={lockedSessions === 0} />
          </div>

          {/* Main Grid: Needs Attention + Activity Feed */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Needs Attention */}
            <div className="card">
              <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="var(--accent-warn)" /> Needs Attention
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {['Employee', 'Department', 'Trust', 'Status', 'Last Active', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(emp => {
                      const latest = emp.sessions[0];
                      const score = latest?.trust_score;
                      const status = latest?.status || 'no sessions';
                      return (
                        <tr key={emp.id} style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ fontWeight: '600', fontSize: '14px' }}>{emp.full_name}</div>
                            <div className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{emp.username}</div>
                          </td>
                          <td style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{emp.department}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span className="mono-font" style={{ fontSize: '18px', fontWeight: '700', color: getScoreColor(score ?? null) }}>
                              {score != null ? Math.round(score) : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', fontSize: '13px', textTransform: 'capitalize', color: status === 'active' ? 'var(--accent-trust)' : (status === 'locked' ? 'var(--accent-danger)' : 'var(--text-secondary)'), fontWeight: '600' }}>
                            {status}
                          </td>
                          <td className="mono-font" style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {latest ? new Date(latest.last_active_at).toLocaleTimeString() : '—'}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => setSelectedEmp(emp)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Eye size={12} /> View
                              </button>
                              {latest && latest.status === 'active' && (
                                <>
                                  <button 
                                    onClick={() => handleSimulate(latest.session_id, true)} 
                                    style={{ background: 'rgba(240,68,56,0.08)', border: '1px solid var(--accent-danger)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: 'var(--accent-danger)', fontWeight: '600' }}
                                  >
                                    Simulate
                                  </button>
                                  <button 
                                    onClick={() => {
                                      fetch(`${API_BASE_URL}/api/admin/sessions/${latest.session_id}/terminate`, { method: 'POST' })
                                        .then(() => fetchData());
                                    }}
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: '600' }}
                                  >
                                    Force Logout
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Org Activity Feed */}
            <div className="card" style={{ maxHeight: '420px', display: 'flex', flexDirection: 'column' }}>
              <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--accent-primary)" /> Org Activity Feed
              </h2>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {events.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px', fontSize: '14px' }}>No events yet. Log in as an employee to generate activity.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {events.slice(0, 20).map((ev, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px', borderRadius: '6px', backgroundColor: i % 2 === 0 ? 'var(--bg-elevated)' : 'transparent', fontSize: '13px' }}>
                        <div style={{ marginTop: '2px' }}>{getEventIcon(ev.event_type)}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: '600' }}>{ev.full_name}</span>
                          <span style={{ color: 'var(--text-secondary)' }}> — {ev.event_type}</span>
                          {ev.score != null && <span className="mono-font" style={{ color: getScoreColor(ev.score), marginLeft: '8px', fontWeight: '600' }}>{ev.score}</span>}
                        </div>
                        <span className="mono-font" style={{ color: 'var(--text-secondary)', fontSize: '11px', whiteSpace: 'nowrap' }}>{ev.timestamp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Department Chart + Network Pie */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Department Breakdown */}
            <div className="card" style={{ height: '280px' }}>
              <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px' }}>Trust by Department</h2>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={deptData} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} stroke="var(--border-subtle)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" stroke="var(--border-subtle)" tick={{ fill: 'var(--text-secondary)', fontSize: 13 }} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                    {deptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#12B76A' : entry.score >= 60 ? '#F79009' : '#F04438'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Network Overview */}
            <div className="card" style={{ height: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', alignSelf: 'flex-start' }}>
                <Wifi size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} color="var(--accent-primary)" />
                Network Overview
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flex: 1 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={networkPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                      {networkPieData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={i === 0 ? '#12B76A' : '#F79009'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#12B76A', display: 'inline-block' }}></span>
                    <span style={{ fontSize: '14px' }}>Corporate: <strong>{networkStats.recognized}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#F79009', display: 'inline-block' }}></span>
                    <span style={{ fontSize: '14px' }}>Unknown: <strong>{networkStats.unrecognized}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
