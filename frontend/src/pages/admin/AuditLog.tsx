import React, { useEffect, useState } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../../config";
import { FileText, Download, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

export default function AuditLog() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    fetch(API_BASE_URL + '/api/admin/events')
      .then(r => r.json())
      .then(setEvents)
      .catch(console.error);
  }, []);

  const getEventIcon = (type: string) => {
    if (type.includes('Lock') || type.includes('Impostor')) return <AlertTriangle size={16} color="var(--accent-danger)" />;
    if (type.includes('Risk') || type.includes('Elevated')) return <AlertTriangle size={16} color="var(--accent-warn)" />;
    if (type.includes('Login') || type.includes('Re-Auth') || type.includes('Enrollment')) return <CheckCircle size={16} color="var(--accent-trust)" />;
    return <Activity size={16} color="var(--accent-primary)" />;
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp,Event Type,Username,Full Name,Trust Score,Session ID\n'];
    const rows = events.map(e => 
      `${e.timestamp},"${e.event_type}",${e.username},"${e.full_name}",${e.score ?? ''},${e.session_id ?? ''}`
    );
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trustloop_audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText color="var(--accent-primary)" />
            Organization Audit Log
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Comprehensive log of all security events and access anomalies.
          </p>
        </div>
        <button className="btn-primary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
          <Download size={16} /> Export CSV
        </button>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              {['Timestamp', 'Event Type', 'User', 'Score', 'Session ID'].map(h => (
                <th key={h} style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No events recorded yet.
                </td>
              </tr>
            ) : (
              events.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                  <td className="mono-font" style={{ padding: '12px 16px', fontSize: '13px' }}>{e.timestamp}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                    {getEventIcon(e.event_type)}
                    {e.event_type}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{e.full_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{e.username}</div>
                  </td>
                  <td className="mono-font" style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: e.score < 60 ? 'var(--accent-danger)' : (e.score < 80 ? 'var(--accent-warn)' : 'var(--text-primary)') }}>
                    {e.score ?? '—'}
                  </td>
                  <td className="mono-font" style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {e.session_id ? `#${e.session_id}` : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
