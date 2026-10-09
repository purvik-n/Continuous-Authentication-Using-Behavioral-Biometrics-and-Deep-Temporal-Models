import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from "../../config";
import { Settings, Save, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function PolicySettings() {
  const [lockThreshold, setLockThreshold] = useState<number>(60);
  const [riskThreshold, setRiskThreshold] = useState<number>(80);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('trustloop_token') || '';
    fetch(API_BASE_URL + '/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setLockThreshold(data.lock_threshold || 60);
        setRiskThreshold(data.risk_threshold || 80);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    const token = localStorage.getItem('trustloop_token') || '';
    try {
      const res = await fetch(API_BASE_URL + '/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          lock_threshold: lockThreshold,
          risk_threshold: riskThreshold
        })
      });
      if (res.ok) {
        setMessage('Settings saved successfully.');
      } else {
        setMessage('Failed to save settings.');
      }
    } catch (err) {
      setMessage('Error saving settings.');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings color="var(--accent-primary)" />
          Security Policy Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Configure organizational trust thresholds and security policies. Changes apply immediately to all active sessions.
        </p>
      </header>

      <div className="card">
        <h2 className="display-font" style={{ fontSize: '18px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="var(--accent-primary)" />
          Trust Score Thresholds
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '500' }}>
              <span>Elevated Risk Threshold</span>
              <span className="mono-font" style={{ color: 'var(--accent-warn)' }}>{riskThreshold}</span>
            </label>
            <input 
              type="range" 
              min="10" 
              max="95" 
              value={riskThreshold} 
              onChange={(e) => setRiskThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-warn)' }}
            />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Scores below this value will trigger an "Elevated Risk" alert in the organization feed, but will not lock the session.
            </p>
          </div>

          <div style={{ paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '500' }}>
              <span>Session Lock Threshold</span>
              <span className="mono-font" style={{ color: 'var(--accent-danger)' }}>{lockThreshold}</span>
            </label>
            <input 
              type="range" 
              min="10" 
              max="95" 
              value={lockThreshold} 
              onChange={(e) => setLockThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-danger)' }}
            />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Scores falling below this critical threshold will instantly terminate access and lock the user's screen.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: message.includes('success') ? 'var(--accent-trust)' : 'var(--accent-danger)', fontSize: '14px', fontWeight: '500' }}>
              {message}
            </div>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Policies'}
            </button>
          </div>
        </div>
      </div>
      
      <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(240, 68, 56, 0.05)', borderRadius: '8px', border: '1px solid rgba(240, 68, 56, 0.2)', display: 'flex', gap: '12px' }}>
        <AlertTriangle size={20} color="var(--accent-danger)" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--accent-danger)', display: 'block', marginBottom: '4px' }}>Warning: Threshold Tuning</strong>
          Setting the lock threshold too high may result in false positives and disrupt legitimate employee work. Setting it too low increases the window of vulnerability during an account takeover.
        </div>
      </div>
    </div>
  );
}
