import React from 'react';
import { useEmployeeContext } from '../../contexts/EmployeeContext';
import { ShieldCheck, Target, AlertTriangle, Lock, Wifi, Monitor, Clock, Info, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

function parseUA(ua: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return { browser, os };
}

export default function EmployeeOverview() {
  const { 
    trustScore, isEnrolled, isSimulated, isImpostor, setIsImpostor, 
    mySessions, contributions, radarData, scoreHistory, alerts,
    liveMetrics, baselineMetrics
  } = useEmployeeContext();
  
  const network_isp = localStorage.getItem('trustloop_network_isp') || 'Unknown';
  const initial_trust = parseFloat(localStorage.getItem('trustloop_initial_trust') || '100');
  const network_logic = localStorage.getItem('trustloop_network_logic') || '';

  const getStatusColor = (score: number) => {
    if (score >= 80) return 'var(--accent-trust)';
    if (score >= 60) return 'var(--accent-warn)';
    return 'var(--accent-danger)';
  };

  const getStatusText = (score: number) => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Elevated Risk';
    return 'Session Locked';
  };

  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (trustScore / 100) * circumference;
  const statusColor = getStatusColor(trustScore);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px' }}>Session Overview</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isEnrolled && (
            <button 
              className="btn-primary"
              style={{ 
                backgroundColor: isImpostor ? 'var(--bg-elevated)' : 'rgba(240, 68, 56, 0.08)',
                color: 'var(--accent-danger)',
                border: '1px solid var(--accent-danger)'
              }}
              onClick={() => setIsImpostor(!isImpostor)}
            >
              {isImpostor ? 'Stop Impostor' : 'Simulate Impostor'}
            </button>
          )}
        </div>
      </header>

      {!isEnrolled ? (
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <Target size={48} color="var(--accent-warn)" style={{ margin: '0 auto' }} />
            <h2 className="display-font" style={{ marginTop: '16px', fontSize: '24px' }}>Baseline Enrollment</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              We need to learn your unique typing and mouse patterns. Please go to the Workspace tab and use the mock apps naturally.
            </p>
          </div>
          <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '24px', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '24px', textAlign: 'left', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <p className="mono-font">To enroll, simply navigate to the "Workspace" tab in the sidebar and interact with the mock email or kanban board until the baseline is established.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Main Dashboard Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
            {/* Left Column: Gauge + Network */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Trust Gauge */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
                <div style={{ position: 'relative', width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="220" height="220" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                    <circle cx="110" cy="110" r={radius} stroke="var(--bg-elevated)" strokeWidth="12" fill="none" />
                    <circle 
                      cx="110" cy="110" r={radius} 
                      stroke={statusColor} 
                      strokeWidth="12" 
                      fill="none" 
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.6s ease' }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ textAlign: 'center', zIndex: 1 }}>
                    <div className="display-font" style={{ fontSize: '64px', color: 'var(--text-primary)' }}>
                      {trustScore}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-4px' }}>Live Score</div>
                  </div>
                </div>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <h3 className="display-font" style={{ color: statusColor, fontSize: '18px', transition: 'color 0.6s ease' }}>
                    {getStatusText(trustScore)}
                  </h3>
                </div>

                {/* Compact Live Behavioral Metrics Table */}
                <div style={{ width: '100%', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Live Behavioral Metrics</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>Updates ~2s</span>
                  </div>

                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '6px 4px', fontWeight: '600' }}>METRIC</th>
                        <th style={{ padding: '6px 4px', fontWeight: '600' }}>LIVE</th>
                        <th style={{ padding: '6px 4px', fontWeight: '600' }}>BASELINE</th>
                        <th style={{ padding: '6px 4px', fontWeight: '600', textAlign: 'right' }}>DRIFT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Dwell Time', live: `${liveMetrics.avgDwell} ms`, base: `${baselineMetrics.avgDwell} ms`, lVal: liveMetrics.avgDwell, bVal: baselineMetrics.avgDwell },
                        { label: 'Flight Time', live: `${liveMetrics.avgFlight} ms`, base: `${baselineMetrics.avgFlight} ms`, lVal: liveMetrics.avgFlight, bVal: baselineMetrics.avgFlight },
                        { label: 'Mouse Velocity', live: `${liveMetrics.mouseVelocity} px/s`, base: `${baselineMetrics.mouseVelocity} px/s`, lVal: liveMetrics.mouseVelocity, bVal: baselineMetrics.mouseVelocity },
                        { label: 'Mouse Curvature', live: `${liveMetrics.mouseCurvature}`, base: `${baselineMetrics.mouseCurvature}`, lVal: liveMetrics.mouseCurvature, bVal: baselineMetrics.mouseCurvature },
                      ].map((m, idx) => {
                        const b = m.bVal || 1;
                        const diffPct = Math.round(((m.lVal - m.bVal) / b) * 100);
                        const absDiff = Math.abs(diffPct);
                        const driftColor = absDiff > 40 ? 'var(--accent-danger)' : (absDiff > 20 ? 'var(--accent-warn)' : 'var(--accent-trust)');
                        const arrow = diffPct > 0 ? '↑' : (diffPct < 0 ? '↓' : '•');

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
                            <td style={{ padding: '8px 4px', color: 'var(--text-primary)', fontWeight: '500' }}>{m.label}</td>
                            <td className="mono-font" style={{ padding: '8px 4px', fontWeight: '600' }}>{m.live}</td>
                            <td className="mono-font" style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>{m.base}</td>
                            <td className="mono-font" style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '600', color: driftColor }}>
                              {arrow} {absDiff}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Network Info Card */}
              <div className="card">
                <h3 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wifi size={16} color="var(--accent-primary)" /> Network Context
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>ISP</span>
                    <span className="mono-font" style={{ fontWeight: '500' }}>{network_isp}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Network Trust</span>
                    <span className="mono-font" style={{ fontWeight: '600', color: initial_trust >= 100 ? 'var(--accent-trust)' : 'var(--accent-warn)' }}>{initial_trust}</span>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-elevated)', padding: '12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} color="var(--accent-primary)" />
                    {network_logic}
                  </div>
                  {isSimulated && (
                    <div style={{ fontSize: '12px', color: 'var(--accent-warn)', fontStyle: 'italic' }}>
                      ⚠ Simulated network profile for local testing
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Network trust sets the starting score. Behavioral analysis adjusts the live score from there.
                  </div>
                </div>
              </div>
            </div>

            {/* Explainability Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', gridColumn: '1 / -1' }}>
              <div className="card">
                <h3 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} color="var(--accent-primary)" /> Risk Factor Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.entries(contributions).map(([key, value]) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{key.replace('avg', '').replace('mouse', 'Mouse ')} Deviation</span>
                        <span className="mono-font">{value}%</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${value}%`, height: '100%', backgroundColor: value > 30 ? 'var(--accent-danger)' : (value > 15 ? 'var(--accent-warn)' : 'var(--accent-trust)') }} />
                      </div>
                    </div>
                  ))}
                  {Object.keys(contributions).length === 0 && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>Waiting for anomaly data...</div>
                  )}
                </div>
              </div>

              <div className="card">
                <h3 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={16} color="var(--accent-primary)" /> Biometric Fingerprint
                </h3>
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="var(--border-subtle)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                      <Radar name="Baseline" dataKey="A" stroke="var(--accent-trust)" fill="var(--accent-trust)" fillOpacity={0.2} />
                      <Radar name="Live" dataKey="B" stroke="var(--accent-warn)" fill="var(--accent-warn)" fillOpacity={0.5} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '12px', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent-trust)', borderRadius: '2px' }}></span> Baseline (Enrolled)</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', backgroundColor: 'var(--accent-warn)', borderRadius: '2px' }}></span> Live Data</span>
                </div>
              </div>
            </div>

            {/* Right Column: Chart + Alerts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card" style={{ height: '300px' }}>
                <h2 className="display-font" style={{ marginBottom: '16px', fontSize: '18px' }}>Real-time Trust Trajectory</h2>
                <ResponsiveContainer width="100%" height="85%">
                  <LineChart data={scoreHistory}>
                    <XAxis dataKey="time" stroke="var(--border-subtle)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                    <YAxis domain={[0, 100]} stroke="var(--border-subtle)" tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--accent-primary)' }}
                    />
                    <ReferenceLine y={60} stroke="var(--accent-danger)" strokeDasharray="3 3" />
                    <ReferenceLine y={initial_trust} stroke="var(--text-secondary)" strokeDasharray="5 5" label={{ value: `Network Baseline: ${initial_trust}`, position: 'right', fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="var(--accent-primary)" 
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card" style={{ flex: 1 }}>
                <h2 className="display-font" style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="var(--text-secondary)" />
                  Security Alert Log
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Time</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Event</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((alert, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
                          <td className="mono-font" style={{ padding: '12px 8px', fontSize: '13px' }}>{alert.timestamp}</td>
                          <td style={{ padding: '12px 8px', fontSize: '14px', color: alert.type.includes('Locked') ? 'var(--accent-danger)' : (alert.type.includes('Risk') ? 'var(--accent-warn)' : 'var(--text-primary)') }}>
                            {alert.type}
                          </td>
                          <td className="mono-font" style={{ padding: '12px 8px', fontSize: '13px' }}>{alert.score}</td>
                        </tr>
                      ))}
                      {alerts.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No anomalies detected in this session.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* My Devices Panel */}
          <div className="card">
            <h2 className="display-font" style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={18} color="var(--text-secondary)" />
              My Devices & Sessions
            </h2>
            {mySessions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '16px' }}>No session history available.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>IP Address</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Browser / OS</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Network</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>First Seen</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Last Active</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', fontSize: '13px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySessions.map(s => {
                      const { browser, os } = parseUA(s.user_agent || '');
                      const sColor = s.status === 'locked' ? 'var(--accent-danger)' : (s.status === 'ended' ? 'var(--text-secondary)' : 'var(--accent-trust)');
                      return (
                        <tr key={s.session_id} style={{ borderBottom: '1px solid var(--bg-elevated)' }}>
                          <td className="mono-font" style={{ padding: '12px 8px', fontSize: '13px' }}>{s.ip_address}</td>
                          <td style={{ padding: '12px 8px', fontSize: '13px' }}>{browser} / {os}</td>
                          <td style={{ padding: '12px 8px', fontSize: '13px' }}>{s.network_isp}</td>
                          <td className="mono-font" style={{ padding: '12px 8px', fontSize: '13px' }}>{new Date(s.started_at).toLocaleString()}</td>
                          <td className="mono-font" style={{ padding: '12px 8px', fontSize: '13px' }}>{new Date(s.last_active_at).toLocaleString()}</td>
                          <td style={{ padding: '12px 8px', fontSize: '13px' }}>
                            <span style={{ color: sColor, fontWeight: '600', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sColor, display: 'inline-block' }}></span>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
