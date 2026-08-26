import React from 'react';
import { Monitor, Smartphone, Laptop, Globe, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useEmployeeContext } from '../../contexts/EmployeeContext';

function parseUA(ua: string): { browser: string; os: string; deviceType: string } {
  let browser = 'Unknown';
  let os = 'Unknown';
  let deviceType = 'Desktop';
  
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android') || ua.includes('iPhone')) {
    os = ua.includes('Android') ? 'Android' : 'iOS';
    deviceType = 'Mobile';
  }
  
  return { browser, os, deviceType };
}

export default function MyDevices() {
  const { mySessions } = useEmployeeContext();
  const currentSessionId = localStorage.getItem('trustloop_session_id');

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Monitor color="var(--accent-primary)" />
          My Devices & Active Sessions
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Authorized hardware, recent login locations, and session integrity states.
        </p>
      </header>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Total Sessions Logged</div>
          <div className="display-font" style={{ fontSize: '28px' }}>{mySessions.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Current Active Device</div>
          <div style={{ fontWeight: '600', color: 'var(--accent-trust)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '16px' }}>
            <ShieldCheck size={18} /> Verified Active Session
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Biometric Continuous Mode</div>
          <div style={{ fontWeight: '600', color: 'var(--accent-primary)', fontSize: '16px' }}>
            Active Background Stream
          </div>
        </div>
      </div>

      {/* Session History Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: '600', fontSize: '15px' }}>
          Session History & Device Fingerprints
        </div>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>DEVICE / OS</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>IP ADDRESS</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>NETWORK ISP</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>FIRST SEEN</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>LAST ACTIVE</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {mySessions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No session history available.
                </td>
              </tr>
            ) : (
              mySessions.map((s: any) => {
                const { browser, os, deviceType } = parseUA(s.user_agent || '');
                const isCurrent = String(s.session_id) === String(currentSessionId);
                const sColor = s.status === 'locked' ? 'var(--accent-danger)' : (s.status === 'ended' ? 'var(--text-secondary)' : 'var(--accent-trust)');

                return (
                  <tr key={s.session_id} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: isCurrent ? 'rgba(51, 92, 255, 0.04)' : 'transparent' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {deviceType === 'Mobile' ? <Smartphone size={18} color="var(--accent-primary)" /> : <Laptop size={18} color="var(--accent-primary)" />}
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '14px' }}>
                            {browser} on {os} {isCurrent && <span style={{ marginLeft: '6px', fontSize: '11px', backgroundColor: 'rgba(51, 92, 255, 0.1)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>Current</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: #{s.session_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '13px' }}>{s.ip_address}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>{s.network_isp || 'Unknown'}</td>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '13px' }}>{new Date(s.started_at).toLocaleString()}</td>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '13px' }}>{new Date(s.last_active_at).toLocaleString()}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ color: sColor, fontWeight: '600', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sColor, display: 'inline-block' }}></span>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
