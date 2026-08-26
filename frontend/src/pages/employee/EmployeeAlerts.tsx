import React, { useState } from 'react';
import { Bell, AlertTriangle, ShieldCheck, Lock, Filter, Activity } from 'lucide-react';
import { useEmployeeContext } from '../../contexts/EmployeeContext';

export default function EmployeeAlerts() {
  const { alerts } = useEmployeeContext();
  const [filter, setFilter] = useState<'all' | 'risk' | 'locked'>('all');

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'risk') return a.type.toLowerCase().includes('risk') || a.type.toLowerCase().includes('elevated');
    if (filter === 'locked') return a.type.toLowerCase().includes('lock');
    return true;
  });

  const getAlertIcon = (type: string) => {
    if (type.toLowerCase().includes('lock')) return <Lock size={16} color="var(--accent-danger)" />;
    if (type.toLowerCase().includes('risk')) return <AlertTriangle size={16} color="var(--accent-warn)" />;
    return <ShieldCheck size={16} color="var(--accent-trust)" />;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell color="var(--accent-primary)" />
            Security Alerts & Events
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Historical record of real-time behavioral anomaly detections and authentication events.
          </p>
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', padding: '4px', gap: '4px' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              backgroundColor: filter === 'all' ? 'var(--bg-surface)' : 'transparent',
              color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: filter === 'all' ? '600' : '500',
              boxShadow: filter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            All Events ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('risk')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              backgroundColor: filter === 'risk' ? 'var(--bg-surface)' : 'transparent',
              color: filter === 'risk' ? 'var(--accent-warn)' : 'var(--text-secondary)',
              fontWeight: filter === 'risk' ? '600' : '500',
              boxShadow: filter === 'risk' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Risk Warnings
          </button>
          <button
            onClick={() => setFilter('locked')}
            style={{
              padding: '6px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              backgroundColor: filter === 'locked' ? 'var(--bg-surface)' : 'transparent',
              color: filter === 'locked' ? 'var(--accent-danger)' : 'var(--text-secondary)',
              fontWeight: filter === 'locked' ? '600' : '500',
              boxShadow: filter === 'locked' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Session Locks
          </button>
        </div>
      </header>

      {/* Alerts Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>TIMESTAMP</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>EVENT TYPE</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>TRUST SCORE AT EVENT</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>SEVERITY</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No security alerts matching this filter.
                </td>
              </tr>
            ) : (
              filteredAlerts.map((a, i) => {
                const isLocked = a.type.toLowerCase().includes('lock');
                const isRisk = a.type.toLowerCase().includes('risk') || a.type.toLowerCase().includes('elevated');
                const severity = isLocked ? 'Critical' : (isRisk ? 'Warning' : 'Info');
                const severityColor = isLocked ? 'var(--accent-danger)' : (isRisk ? 'var(--accent-warn)' : 'var(--accent-trust)');

                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '13px' }}>{a.timestamp}</td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getAlertIcon(a.type)}
                        <span>{a.type}</span>
                      </div>
                    </td>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '600', color: severityColor }}>
                      {a.score}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: `${severityColor}15`, color: severityColor }}>
                        {severity}
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
