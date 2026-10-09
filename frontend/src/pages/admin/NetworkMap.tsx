import React, { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../../config";
import { 
  Map, Wifi, CheckCircle2, AlertTriangle, ShieldCheck, ShieldAlert,
  Activity, Globe, Server, RefreshCw, Zap, Play, RotateCcw, Plus, Trash2, X
} from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ZAxis, Cell, LineChart, Line, ReferenceLine 
} from 'recharts';

interface NetworkSession {
  session_id: number;
  user_id: number;
  username: string;
  full_name: string;
  department: string;
  status: string;
  ip_address: string;
  isp: string;
  asn: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  network_risk_score: number;
  severity: string;
  is_vpn: boolean;
  is_tor: boolean;
  is_proxy: boolean;
  is_datacenter: boolean;
  avg_latency_ms: number;
  jitter_ms: number;
  reconnect_count: number;
  breakdown: Record<string, { points: number; weight: number; status: string; reason: string }>;
  started_at: string;
}

interface NetworkEventItem {
  id: number;
  session_id: number;
  user_id: number;
  username: string;
  full_name: string;
  timestamp: string;
  event_type: string;
  severity: string;
  risk_score: number;
  ip_address: string;
  location: string;
  details: string;
}

interface AllowlistEntry {
  id: number;
  entry_type: string;
  value: string;
  description: string;
  created_at: string;
}

export default function NetworkMap() {
  const [sessions, setSessions] = useState<NetworkSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [events, setEvents] = useState<NetworkEventItem[]>([]);
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<{ time: string; latency: number; jitter: number }[]>([]);
  
  const [showAllowlistModal, setShowAllowlistModal] = useState(false);
  const [newEntryType, setNewEntryType] = useState('ISP');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [newEntryDesc, setNewEntryDesc] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const adminToken = () => localStorage.getItem('trustloop_token') || '';
  const adminHeaders = () => ({
    'Authorization': `Bearer ${adminToken()}`,
    'Content-Type': 'application/json'
  });

  const fetchData = useCallback(() => {
    fetch(`${API_BASE_URL}/api/admin/network/operations`, { headers: adminHeaders() })
      .then(r => r.json())
      .then((data: NetworkSession[]) => {
        if (Array.isArray(data)) {
          setSessions(data);
          if (data.length > 0 && selectedSessionId === null) {
            setSelectedSessionId(data[0].session_id);
          }
          // Update latency history from active session
          const activeSess = selectedSessionId 
            ? data.find(s => s.session_id === selectedSessionId) || data[0]
            : data[0];
          if (activeSess) {
            setLatencyHistory(prev => {
              const entry = {
                time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
                latency: activeSess.avg_latency_ms || 12,
                jitter: activeSess.jitter_ms || 1.5
              };
              const updated = [...prev, entry];
              return updated.length > 20 ? updated.slice(updated.length - 20) : updated;
            });
          }
        }
      })
      .catch(console.error);

    fetch(`${API_BASE_URL}/api/admin/network/events`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setEvents(data); })
      .catch(console.error);

    fetch(`${API_BASE_URL}/api/admin/network/allowlist`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllowlist(data); })
      .catch(console.error);
  }, [selectedSessionId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Selected session object
  const currentSession = sessions.find(s => s.session_id === selectedSessionId) || sessions[0] || null;

  // Threat Simulation Handler
  const handleSimulateThreat = async (threatType: string) => {
    if (!currentSession) return;
    setIsSimulating(true);
    try {
      await fetch(`${API_BASE_URL}/api/admin/network/simulate_threat/${currentSession.session_id}`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ threat_type: threatType })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Allowlist Management Handlers
  const handleAddAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntryValue) return;
    try {
      await fetch(`${API_BASE_URL}/api/admin/network/allowlist`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({
          entry_type: newEntryType,
          value: newEntryValue,
          description: newEntryDesc
        })
      });
      setNewEntryValue('');
      setNewEntryDesc('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAllowlist = async (id: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/admin/network/allowlist/${id}`, {
        method: 'DELETE',
        headers: adminHeaders()
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Severity color helper
  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical': return { bg: 'rgba(240, 68, 56, 0.15)', color: 'var(--accent-danger)', border: 'var(--accent-danger)' };
      case 'high': return { bg: 'rgba(247, 144, 9, 0.15)', color: 'var(--accent-warn)', border: 'var(--accent-warn)' };
      case 'medium': return { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '#eab308' };
      default: return { bg: 'rgba(18, 183, 106, 0.15)', color: 'var(--accent-trust)', border: 'var(--accent-trust)' };
    }
  };

  const activeCount = sessions.filter(s => s.status === 'active').length;
  const criticalCount = sessions.filter(s => s.severity === 'critical' || s.severity === 'high').length;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* Header & KPI Summary */}
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity color="var(--accent-primary)" />
            Network Operations Center (NOC)
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '14px' }}>
            Real-time session connection monitoring, impossible travel detection, and threat reputation analysis.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn-secondary"
            onClick={() => setShowAllowlistModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <ShieldCheck size={16} /> Corporate Allowlist ({allowlist.length})
          </button>
          <button 
            className="btn-secondary"
            onClick={fetchData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {/* KPI Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>ACTIVE SESSIONS</div>
          <div className="mono-font" style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{activeCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--accent-trust)', marginTop: '4px' }}>Continuous 5s telemetry</div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>ELEVATED RISK SESSIONS</div>
          <div className="mono-font" style={{ fontSize: '28px', fontWeight: 700, color: criticalCount > 0 ? 'var(--accent-danger)' : 'var(--accent-trust)', marginTop: '4px' }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Requires security audit</div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>TOR & PROXY RELAYS</div>
          <div className="mono-font" style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>
            {sessions.filter(s => s.is_tor || s.is_vpn || s.is_proxy).length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Active exit-node cache</div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>AUDIT NETWORK EVENTS</div>
          <div className="mono-font" style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>{events.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Logged to network_events</div>
        </div>
      </div>

      {/* Threat Simulation Controller */}
      {currentSession && (
        <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="var(--accent-warn)" />
                Live Anomaly & Threat Simulator
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Simulate attack vectors on session #{currentSession.session_id} ({currentSession.full_name}) to verify real-time alert triggers
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={() => handleSimulateThreat('impossible_travel')}
                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--accent-danger)' }}
              >
                ✈ Impossible Travel (SF → London)
              </button>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={() => handleSimulateThreat('ip_jump')}
                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--accent-warn)' }}
              >
                🔀 Mid-Session IP Hijack
              </button>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={() => handleSimulateThreat('tor_relay')}
                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--accent-danger)' }}
              >
                🧅 Tor Exit Node
              </button>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={() => handleSimulateThreat('vpn_proxy')}
                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--accent-warn)' }}
              >
                🛡 VPN/Proxy
              </button>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={() => handleSimulateThreat('high_jitter')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                ⚡ High Latency / Jitter
              </button>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={() => handleSimulateThreat('restore_healthy')}
                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--accent-trust)' }}
              >
                <RotateCcw size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Restore Clean State
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left (Geo-Map + Latency Chart), Right (Risk Breakdown) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Geo-Map Scatter Visualization */}
          <div className="card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 className="display-font" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} color="var(--accent-primary)" />
                Session Geolocation Coordinate Plane
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Click node to inspect session</span>
            </div>

            <div style={{ flex: 1, backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-subtle)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis type="number" dataKey="lon" name="Longitude" domain={[-180, 180]} hide />
                  <YAxis type="number" dataKey="lat" name="Latitude" domain={[-90, 90]} hide />
                  <ZAxis type="number" range={[120, 360]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                            <div style={{ fontWeight: 600 }}>{data.full_name} (#{data.session_id})</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{data.city}, {data.country}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>IP: {data.ip_address}</div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: data.network_risk_score > 30 ? 'var(--accent-danger)' : 'var(--accent-trust)', marginTop: '4px' }}>
                              Risk Score: {data.network_risk_score} / 100 ({data.severity.toUpperCase()})
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    data={sessions} 
                    onClick={(node: any) => setSelectedSessionId(node?.session_id || node?.payload?.session_id || null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {sessions.map((entry, index) => {
                      const isSelected = entry.session_id === selectedSessionId;
                      let fill = 'var(--accent-trust)';
                      if (entry.severity === 'critical') fill = 'var(--accent-danger)';
                      else if (entry.severity === 'high') fill = 'var(--accent-warn)';
                      else if (entry.severity === 'medium') fill = '#eab308';
                      return <Cell key={`cell-${index}`} fill={fill} stroke={isSelected ? '#101828' : 'none'} strokeWidth={isSelected ? 3 : 0} />;
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Real-Time WebSocket Latency & Jitter Chart */}
          <div className="card" style={{ height: '280px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 className="display-font" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} color="var(--accent-primary)" />
                Round-Trip WebSocket Ping Latency & Jitter (ms)
              </h2>
              <div style={{ fontSize: '12px', display: 'flex', gap: '12px' }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>● Latency (ms)</span>
                <span style={{ color: 'var(--accent-warn)', fontWeight: 600 }}>● Jitter (ms)</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyHistory} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={11} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }} />
                  <ReferenceLine y={400} stroke="var(--accent-danger)" strokeDasharray="3 3" label={{ value: 'Relay Threshold (400ms)', fill: 'var(--accent-danger)', fontSize: 10 }} />
                  <Line type="monotone" dataKey="latency" stroke="var(--accent-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="jitter" stroke="var(--accent-warn)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Right Column: Explainable Risk Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {currentSession ? (
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 className="display-font" style={{ fontSize: '18px' }}>
                    Risk Score: {currentSession.network_risk_score} / 100
                  </h2>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {currentSession.full_name} ({currentSession.username}) • Session #{currentSession.session_id}
                  </div>
                </div>

                {(() => {
                  const style = getSeverityStyle(currentSession.severity);
                  return (
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '16px', 
                      backgroundColor: style.bg, 
                      color: style.color, 
                      fontSize: '12px', 
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {currentSession.severity}
                    </span>
                  );
                })()}
              </div>

              {/* Quick Specs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
                <div><strong>IP Address:</strong> {currentSession.ip_address}</div>
                <div><strong>ISP:</strong> {currentSession.isp}</div>
                <div><strong>ASN:</strong> {currentSession.asn}</div>
                <div><strong>Location:</strong> {currentSession.city}, {currentSession.country}</div>
              </div>

              {/* Explainable Factor Breakdown */}
              <h3 className="display-font" style={{ fontSize: '14px', marginBottom: '12px' }}>Explainable Factor Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, maxHeight: '420px' }}>
                {Object.entries(currentSession.breakdown || {}).map(([key, factor]) => {
                  const isFail = factor.status === 'FAIL';
                  const isWarn = factor.status === 'WARN';
                  const badgeColor = isFail ? 'var(--accent-danger)' : isWarn ? 'var(--accent-warn)' : 'var(--accent-trust)';
                  const badgeBg = isFail ? 'rgba(240, 68, 56, 0.1)' : isWarn ? 'rgba(247, 144, 9, 0.1)' : 'rgba(18, 183, 106, 0.1)';

                  return (
                    <div key={key} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {key.replace('_', ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>+{factor.points} pts (wt {factor.weight})</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: badgeColor, backgroundColor: badgeBg, padding: '2px 6px', borderRadius: '4px' }}>
                            {factor.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {factor.reason}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              No session selected.
            </div>
          )}
        </div>

      </div>

      {/* Live Network Event Feed (Audit Table) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="display-font" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} color="var(--accent-primary)" />
            Real-Time Network Event Feed & Audit Log
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Stored in database table `network_events`</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px' }}>Timestamp</th>
                <th style={{ padding: '10px 12px' }}>User</th>
                <th style={{ padding: '10px 12px' }}>Event Type</th>
                <th style={{ padding: '10px 12px' }}>Severity</th>
                <th style={{ padding: '10px 12px' }}>Risk</th>
                <th style={{ padding: '10px 12px' }}>IP / Location</th>
                <th style={{ padding: '10px 12px' }}>Details & Explanation</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 15).map(evt => {
                const sevStyle = getSeverityStyle(evt.severity);
                return (
                  <tr key={evt.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono-font" style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{evt.timestamp}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{evt.full_name}</td>
                    <td className="mono-font" style={{ padding: '10px 12px', fontSize: '12px' }}>{evt.event_type}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        color: sevStyle.color, 
                        backgroundColor: sevStyle.bg, 
                        padding: '3px 8px', 
                        borderRadius: '12px',
                        textTransform: 'uppercase'
                      }}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="mono-font" style={{ padding: '10px 12px', fontWeight: 600 }}>{evt.risk_score}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div>{evt.ip_address}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{evt.location}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', maxWidth: '380px' }}>
                      {evt.details}
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No network events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Corporate Allowlist Management Modal */}
      {showAllowlistModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(16, 24, 40, 0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px'
        }}>
          <div className="card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 className="display-font" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck color="var(--accent-primary)" /> Corporate Network Allowlist
              </h2>
              <button 
                onClick={() => setShowAllowlistModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              Traffic from allowlisted Autonomous Systems (ASNs), corporate ISPs, or internal subnets receive zero baseline penalties.
            </p>

            {/* Add New Entry Form */}
            <form onSubmit={handleAddAllowlist} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <select 
                value={newEntryType} 
                onChange={e => setNewEntryType(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
              >
                <option value="ISP">ISP</option>
                <option value="ASN">ASN</option>
                <option value="IP">IP</option>
              </select>

              <input 
                type="text" 
                placeholder="Value (e.g. Acme Corp, AS15169)" 
                value={newEntryValue} 
                onChange={e => setNewEntryValue(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
                required
              />

              <input 
                type="text" 
                placeholder="Description" 
                value={newEntryDesc} 
                onChange={e => setNewEntryDesc(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}
              />

              <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={16} /> Add
              </button>
            </form>

            {/* Current Entries Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px' }}>Type</th>
                  <th style={{ padding: '8px' }}>Value</th>
                  <th style={{ padding: '8px' }}>Description</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {allowlist.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono-font" style={{ padding: '8px', fontWeight: 600 }}>{item.entry_type}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{item.value}</td>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{item.description}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDeleteAllowlist(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
