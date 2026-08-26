import React, { useState } from 'react';
import { Settings, ShieldCheck, Bell, Eye, Lock, CheckCircle2, UserCheck } from 'lucide-react';
import { useEmployeeContext } from '../../contexts/EmployeeContext';

export default function EmployeeSettings() {
  const { isEnrolled } = useEmployeeContext();
  const fullName = localStorage.getItem('trustloop_full_name') || 'Employee User';
  const role = localStorage.getItem('trustloop_role') || 'employee';

  const [desktopAlerts, setDesktopAlerts] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [continuousScoreBadge, setContinuousScoreBadge] = useState(true);
  const [explainabilityTooltips, setExplainabilityTooltips] = useState(true);

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings color="var(--accent-primary)" />
          Employee Security Preferences
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Manage your biometric profile status, notification alerts, and accessibility options.
        </p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Baseline Profile Status */}
        <div className="card">
          <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={18} color="var(--accent-primary)" /> Biometric Profile Status
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)' }}>{fullName}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Role: {role} • Department: Engineering</div>
            </div>
            <div>
              {isEnrolled ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(18, 183, 106, 0.1)', color: 'var(--accent-trust)', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}>
                  <CheckCircle2 size={16} /> Baseline Model Enrolled
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(247, 144, 9, 0.1)', color: 'var(--accent-warn)', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Awaiting Baseline Training
                </span>
              )}
            </div>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Your biometric baseline captures keystroke dynamics and mouse trajectory kinematics. Feature vectors are processed in memory and never stored as raw input.
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="card">
          <h2 className="display-font" style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--accent-primary)" /> Security Notifications
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>In-App Security Alerts</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Show warnings when trust drops below standard baseline</div>
              </div>
              <input 
                type="checkbox" 
                checked={desktopAlerts} 
                onChange={(e) => setDesktopAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>Audible Warning Tones</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Play sound when session risk is elevated</div>
              </div>
              <input 
                type="checkbox" 
                checked={soundAlerts} 
                onChange={(e) => setSoundAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>Persistent Sidebar Gauge</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Display real-time trust score bar in navigation sidebar</div>
              </div>
              <input 
                type="checkbox" 
                checked={continuousScoreBadge} 
                onChange={(e) => setContinuousScoreBadge(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>Explainability Insights</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Provide detailed radar charts explaining anomaly contributions</div>
              </div>
              <input 
                type="checkbox" 
                checked={explainabilityTooltips} 
                onChange={(e) => setExplainabilityTooltips(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
