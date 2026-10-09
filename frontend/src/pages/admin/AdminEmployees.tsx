import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../config";
import { Users, Zap, Power, Plus, Edit2, UserX, Check, X, AlertCircle, ShieldCheck } from 'lucide-react';

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [simulatingMap, setSimulatingMap] = useState<Record<number, boolean>>({});
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  
  // Form states
  const [formData, setFormData] = useState({ full_name: '', username: '', department: '', reset_password: false });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const adminHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('trustloop_token') || ''}`,
    'Content-Type': 'application/json'
  });

  const fetchEmployees = () => {
    fetch(API_BASE_URL + '/api/admin/employees', { headers: adminHeaders() })
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
      await fetch(`${API_BASE_URL}/api/admin/simulate/${sessionId}?active=${nextState}`, { method: 'POST', headers: adminHeaders() });
      setSimulatingMap(prev => ({ ...prev, [sessionId]: nextState }));
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForceLogout = async (sessionId: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/admin/sessions/${sessionId}/terminate`, { method: 'POST', headers: adminHeaders() });
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ full_name: formData.full_name, username: formData.username, department: formData.department })
      });
      if (res.ok) {
        const data = await res.json();
        setTempPassword(data.temp_password);
        fetchEmployees();
      } else {
        alert("Failed to add employee. Username might already exist.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/employees/${editingEmp.id}`, {
        method: 'PUT',
        headers: adminHeaders(),
        body: JSON.stringify({ full_name: formData.full_name, department: formData.department, reset_password: formData.reset_password })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.temp_password) {
          setTempPassword(data.temp_password);
        } else {
          setIsEditModalOpen(false);
          setEditingEmp(null);
        }
        fetchEmployees();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Are you sure you want to deactivate this employee? They will no longer be able to log in.")) return;
    try {
      await fetch(`${API_BASE_URL}/api/admin/employees/${id}`, { method: 'DELETE', headers: adminHeaders() });
      fetchEmployees();
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setFormData({ full_name: '', username: '', department: '', reset_password: false });
    setTempPassword(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (emp: any) => {
    setFormData({ full_name: emp.full_name, username: emp.username, department: emp.department, reset_password: false });
    setTempPassword(null);
    setEditingEmp(emp);
    setIsEditModalOpen(true);
  };

  // ─── Shared modal overlay style ───────────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(16,24,40,0.5)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 9999, padding: '16px'
  };
  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
    borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%',
    boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)'
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '6px', fontSize: '14px',
    fontWeight: '500', color: 'var(--text-secondary)'
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="display-font" style={{ fontSize: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users color="var(--accent-primary)" />
            Employee Directory & Session Monitor
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Real-time roster of monitored staff, active biometric sessions, and direct admin intervention controls.
          </p>
        </div>
        <button 
          onClick={openAddModal}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          <span>Add Employee</span>
        </button>
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
                const scoreColor = score < 60 ? 'var(--accent-danger)' : (score < 80 ? 'var(--accent-warn)' : 'var(--accent-trust)');

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 16px', opacity: emp.is_active ? 1 : 0.5 }}>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{emp.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>ID: {emp.username}</div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', opacity: emp.is_active ? 1 : 0.5 }}>
                      <span style={{ backgroundColor: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        {emp.department || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', opacity: emp.is_active ? 1 : 0.5 }}>
                      {hasActive ? (
                        <span style={{ color: 'var(--accent-trust)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-trust)' }}></span>
                          1 Active
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>Idle</span>
                      )}
                    </td>
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '15px', fontWeight: '700', color: emp.is_active ? scoreColor : 'var(--text-secondary)', opacity: emp.is_active ? 1 : 0.5 }}>
                      {hasActive ? `${Math.round(score)}` : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {!emp.is_active ? (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}>
                           Deactivated
                        </span>
                      ) : hasActive ? (
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
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {emp.is_active && hasActive && activeSession && (
                          <>
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
                              {simulatingMap[activeSession.session_id] ? 'Stop' : 'Simulate'}
                            </button>
                            <button
                              onClick={() => handleForceLogout(activeSession.session_id)}
                              style={{
                                padding: '6px 10px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
                                backgroundColor: 'rgba(240, 68, 56, 0.08)', color: 'var(--accent-danger)',
                                border: '1px solid rgba(240, 68, 56, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Power size={13} /> Logout
                            </button>
                          </>
                        )}
                        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }}></div>
                        <button
                          onClick={() => openEditModal(emp)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', borderRadius: '4px' }}
                          title="Edit Employee"
                        >
                          <Edit2 size={16} />
                        </button>
                        {emp.is_active && (
                          <button
                            onClick={() => handleDeactivate(emp.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', borderRadius: '4px' }}
                            title="Deactivate Employee"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="display-font" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="var(--accent-primary)" /> Add New Employee
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            {tempPassword ? (
              <div style={{ backgroundColor: 'rgba(18, 183, 106, 0.08)', border: '1px solid rgba(18, 183, 106, 0.3)', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} color="var(--accent-trust)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ color: 'var(--accent-trust)', fontWeight: '600', marginBottom: '6px' }}>Employee Created!</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Copy the temporary password below. It will NOT be shown again.</p>
                    <div className="mono-font" style={{ backgroundColor: 'var(--bg-base)', padding: '12px', borderRadius: '8px', color: 'var(--accent-trust)', fontSize: '18px', textAlign: 'center', border: '1px solid rgba(18,183,106,0.2)', letterSpacing: '0.1em', userSelect: 'all' }}>
                      {tempPassword}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setIsAddModalOpen(false); setTempPassword(null); }}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="input-field" placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <label style={labelStyle}>Username (Employee ID)</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="input-field" placeholder="e.g. emp_03" />
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="input-field" placeholder="e.g. Engineering" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                  <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', fontWeight: '500', color: 'var(--text-primary)' }}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} /> Create Employee
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="display-font" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={20} color="var(--accent-primary)" /> Edit Employee
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            {tempPassword ? (
              <div style={{ backgroundColor: 'rgba(18, 183, 106, 0.08)', border: '1px solid rgba(18, 183, 106, 0.3)', borderRadius: '10px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <ShieldCheck size={20} color="var(--accent-trust)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h3 style={{ color: 'var(--accent-trust)', fontWeight: '600', marginBottom: '6px' }}>Password Reset!</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Copy the new temporary password below.</p>
                    <div className="mono-font" style={{ backgroundColor: 'var(--bg-base)', padding: '12px', borderRadius: '8px', color: 'var(--accent-trust)', fontSize: '18px', textAlign: 'center', border: '1px solid rgba(18,183,106,0.2)', letterSpacing: '0.1em', userSelect: 'all' }}>
                      {tempPassword}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setIsEditModalOpen(false); setTempPassword(null); }}
                  className="btn-primary"
                  style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleEditEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label style={labelStyle}>Username (Employee ID)</label>
                  <input type="text" disabled value={formData.username} className="input-field" style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={labelStyle}>Department</label>
                  <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="input-field" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: 'rgba(247, 144, 9, 0.06)', borderRadius: '8px', border: '1px solid rgba(247,144,9,0.25)' }}>
                  <input type="checkbox" id="reset_pwd" checked={formData.reset_password} onChange={e => setFormData({...formData, reset_password: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-warn)' }} />
                  <label htmlFor="reset_pwd" style={{ fontSize: '13px', color: 'var(--accent-warn)', fontWeight: '500', cursor: 'pointer' }}>Generate new temporary password on save</label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px' }}>
                  <button type="button" onClick={() => setIsEditModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', cursor: 'pointer', fontWeight: '500', color: 'var(--text-primary)' }}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
