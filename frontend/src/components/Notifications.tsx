import React, { useState, useEffect } from 'react';
import { API_BASE_URL, WS_BASE_URL } from "../config";
import { Bell, AlertTriangle, CheckCircle, Activity, X } from 'lucide-react';

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchEvents = () => {
    fetch(API_BASE_URL + '/api/admin/events')
      .then(r => r.json())
      .then(data => {
        setEvents(data);
        // Simple unread logic: count events with Risk or Lock
        const alerts = data.filter((e: any) => e.event_type.includes('Risk') || e.event_type.includes('Lock'));
        setUnread(alerts.length);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const getEventIcon = (type: string) => {
    if (type.includes('Lock') || type.includes('Impostor')) return <AlertTriangle size={14} color="var(--accent-danger)" />;
    if (type.includes('Risk') || type.includes('Elevated')) return <AlertTriangle size={14} color="var(--accent-warn)" />;
    if (type.includes('Login') || type.includes('Re-Auth') || type.includes('Enrollment')) return <CheckCircle size={14} color="var(--accent-trust)" />;
    return <Activity size={14} color="var(--accent-primary)" />;
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => { setOpen(!open); setUnread(0); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', position: 'relative', padding: '8px', borderRadius: '50%', backgroundColor: open ? 'var(--bg-elevated)' : 'transparent' }}
      >
        <Bell size={20} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', backgroundColor: 'var(--accent-danger)', borderRadius: '50%' }}></span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '40px', right: '0', width: '320px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="display-font" style={{ fontSize: '14px', margin: 0 }}>Notifications</h3>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {events.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No notifications</div>
            ) : (
              events.slice(0, 10).map((e, i) => (
                <div key={i} style={{ padding: '10px 16px', display: 'flex', gap: '12px', borderBottom: i < 9 ? '1px solid var(--bg-elevated)' : 'none' }}>
                  <div style={{ marginTop: '2px' }}>{getEventIcon(e.event_type)}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{e.event_type}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{e.full_name}</div>
                    <div className="mono-font" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{e.timestamp}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
