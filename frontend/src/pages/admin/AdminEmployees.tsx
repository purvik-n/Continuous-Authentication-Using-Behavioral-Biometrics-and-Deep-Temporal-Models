import React, { useState, useEffect } from 'react';
import { Users, ShieldCheck, AlertTriangle, Monitor, Power, Zap } from 'lucide-react';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [simulatingMap, setSimulatingMap] = useState<Record<number, boolean>>({});

  const fetchEmployees = () => {
    fetch('http://localhost:8000/api/admin/employees')
      .then(res => res.json())
      .then(data => setEmployees(data))
      .catch(err => console.error("Failed to load employees:", err));
  };

  useEffect(() => {
    fetchEmployees();
    const interval = setInterval(fetchEmployees, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleImpostor = async (sessionId: number) => {
    const nextState = !simulatingMap[sessionId];
    try {
      await fetch(`http://localhost:8000/api/admin/simulate/${sessionId}?active=${nextState}`, { method: 'POST' });
      setSimulatingMap(prev => ({ ...prev, [sessionId]: nextState }));
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForceLogout = async (sessionId: number) => {
    try {
      await fetch(`http://localhost:8000/api/admin/sessions/${sessionId}/terminate`, { method: 'POST' });
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users color="var(--accent-primary)" />
          Employee Directory & Session Monitor
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Real-time roster of monitored staff, active biometric sessions, and direct admin intervention controls.
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>EMPLOYEE</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>DEPARTMENT</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>ACTIVE SESSIONS</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>LIVE TRUST SCORE</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>STATUS</th>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No employees found in directory.
                </td>
              </tr>
            ) : (
              employees.map(emp => {
                const activeSession = emp.sessions?.find((s: any) => s.status === 'active');
                const latestSession = emp.sessions?.[0];
                const sessionToControl = activeSession || latestSession;
                const score = sessionToControl?.trust_score ?? 100;
                const isLocked = sessionToControl?.status === 'locked';
                const hasActive = !!activeSession;

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{emp.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {emp.username}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                      <span style={{ backgroundColor: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        {emp.department || 'Engineering'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                      {hasActive ? (
                        <span style={{ color: 'var(--accent-trust)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-trust)' }}></span>
                          1 Active
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>Idle</span>
                      )}
                    </td>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '15px', fontWeight: '700', color: score < 60 ? 'var(--accent-danger)' : (score < 80 ? 'var(--accent-warn)' : 'var(--accent-trust)') }}>
                      {hasActive ? `${Math.round(score)}%` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {hasActive ? (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', backgroundColor: isLocked ? 'rgba(240, 68, 56, 0.1)' : 'rgba(18, 183, 106, 0.1)', color: isLocked ? 'var(--accent-danger)' : 'var(--accent-trust)' }}>
                          {isLocked ? 'Locked' : 'Monitoring'}
                        </span>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}>
                          Offline
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {hasActive && activeSession && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleToggleImpostor(activeSession.session_id)}
                            style={{
                              padding: '6px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
                              backgroundColor: simulatingMap[activeSession.session_id] ? 'var(--accent-danger)' : 'rgba(247, 144, 9, 0.1)',
                              color: simulatingMap[activeSession.session_id] ? '#fff' : 'var(--accent-warn)',
                              border: '1px solid var(--border-subtle)', display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <Zap size={13} />
                            {simulatingMap[activeSession.session_id] ? 'Stop Impostor' : 'Simulate Impostor'}
                          </button>
                          <button
                            onClick={() => handleForceLogout(activeSession.session_id)}
                            style={{
                              padding: '6px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
                              backgroundColor: 'rgba(240, 68, 56, 0.08)', color: 'var(--accent-danger)',
                              border: '1px solid rgba(240, 68, 56, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <Power size={13} /> Force Logout
                          </button>
                        </div>
                      )}
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
