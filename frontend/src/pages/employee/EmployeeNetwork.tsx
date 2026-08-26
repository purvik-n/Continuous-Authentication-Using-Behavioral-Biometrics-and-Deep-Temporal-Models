import React from 'react';
import { Wifi, ShieldCheck, AlertTriangle, Info, Globe, Server, CheckCircle2 } from 'lucide-react';
import { useEmployeeContext } from '../../contexts/EmployeeContext';

export default function EmployeeNetwork() {
  const { isSimulated } = useEmployeeContext();
  const networkIsp = localStorage.getItem('trustloop_network_isp') || 'Unknown Network';
  const initialTrust = parseFloat(localStorage.getItem('trustloop_initial_trust') || '100');
  const networkLogic = localStorage.getItem('trustloop_network_logic') || 'Initial session baseline determined by network reputation.';

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wifi color="var(--accent-primary)" />
          Network Security & Trust Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Current connection metadata, ISP reputation analysis, and starting trust score assignment.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Main Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="card">
            <h2 className="display-font" style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--accent-primary)" /> Connection Parameters
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>INTERNET SERVICE PROVIDER (ISP)</div>
                <div style={{ fontWeight: '600', fontSize: '16px' }}>{networkIsp}</div>
              </div>
              
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>STARTING TRUST SCORE</div>
                <div className="mono-font" style={{ fontWeight: '700', fontSize: '20px', color: initialTrust >= 100 ? 'var(--accent-trust)' : 'var(--accent-warn)' }}>
                  {initialTrust} / 100
                </div>
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'rgba(51, 92, 255, 0.05)', borderRadius: '8px', border: '1px solid rgba(51, 92, 255, 0.2)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: '600', marginBottom: '6px' }}>
                <Info size={16} /> Classification Logic
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0, lineHeight: '1.5' }}>
                {networkLogic}
              </p>
            </div>

            {isSimulated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'rgba(247, 144, 9, 0.08)', borderRadius: '8px', border: '1px solid rgba(247, 144, 9, 0.2)', color: 'var(--accent-warn)', fontSize: '13px' }}>
                <AlertTriangle size={16} />
                <span>Simulated internal corporate network profile for local loopback verification.</span>
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="display-font" style={{ fontSize: '18px', marginBottom: '12px' }}>How Network Security Works in TrustLoop</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
              TrustLoop dynamically assigns your initial trust level when you first log in. Recognized corporate and zero-trust networks start at 100 trust. Remote, public, or unknown networks begin at a conservative 85 baseline.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
              From this initial baseline, our non-invasive machine learning models continuously analyze micro-behavioral timing cues to maintain or adjust your session integrity.
            </p>
          </div>
        </div>

        {/* Status Breakdown Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', backgroundColor: initialTrust >= 100 ? 'rgba(18, 183, 106, 0.1)' : 'rgba(247, 144, 9, 0.1)', marginBottom: '16px' }}>
              {initialTrust >= 100 ? <CheckCircle2 size={36} color="var(--accent-trust)" /> : <AlertTriangle size={36} color="var(--accent-warn)" />}
            </div>
            <h3 className="display-font" style={{ fontSize: '18px', marginBottom: '6px' }}>
              {initialTrust >= 100 ? 'Trusted Network' : 'Unverified Network'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
              {initialTrust >= 100 ? 'Zero security penalties applied to initial session.' : 'Baseline adjusted for unverified external IP connection.'}
            </p>
          </div>

          <div className="card">
            <h3 className="display-font" style={{ fontSize: '15px', marginBottom: '12px' }}>Network Security Policies</h3>
            <ul style={{ paddingLeft: '18px', margin: 0, color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Encrypted TLS 1.3 WebSocket Transport</li>
              <li>Real-time IP Geolocation Tagging</li>
              <li>Zero raw keystroke or coordinate retention</li>
              <li>Dynamic Risk Threshold Adaptation</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
}
