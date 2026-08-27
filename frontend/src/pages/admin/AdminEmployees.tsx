import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "../../config";
import { Users, Zap, Power, Plus, Edit2, UserX, Check, X, AlertCircle } from 'lucide-react';

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

  const fetchEmployees = () => {
    fetch(API_BASE_URL + '/api/admin/employees')
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
      await fetch(`${API_BASE_URL}/api/admin/simulate/${sessionId}?active=${nextState}`, { method: 'POST' });
      setSimulatingMap(prev => ({ ...prev, [sessionId]: nextState }));
      fetchEmployees();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForceLogout = async (sessionId: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/admin/sessions/${sessionId}/terminate`, { method: 'POST' });
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: formData.full_name, username: formData.username, department: formData.department })
      });
      if (res.ok) {
        const data = await res.json();
        setTempPassword(data.temp_password);
        fetchEmployees();
      } else {
        alert("Failed to add employee. Username might exist.");
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
        headers: { 'Content-Type': 'application/json' },
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
      await fetch(`${API_BASE_URL}/api/admin/employees/${id}`, { method: 'DELETE' });
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center space-x-2 font-medium transition-colors"
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
                    <td className="mono-font" style={{ padding: '14px 16px', fontSize: '15px', fontWeight: '700', color: emp.is_active ? (score < 60 ? 'var(--accent-danger)' : (score < 80 ? 'var(--accent-warn)' : 'var(--accent-trust)')) : 'var(--text-secondary)', opacity: emp.is_active ? 1 : 0.5 }}>
                      {hasActive ? `${Math.round(score)}%` : '—'}
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
                              {simulatingMap[activeSession.session_id] ? 'Stop Impostor' : 'Simulate'}
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
                        <div className="h-6 w-px bg-slate-700/50 mx-2"></div>
                        <button onClick={() => openEditModal(emp)} className="text-slate-400 hover:text-blue-400 p-1" title="Edit Employee">
                          <Edit2 size={16} />
                        </button>
                        {emp.is_active && (
                          <button onClick={() => handleDeactivate(emp.id)} className="text-slate-400 hover:text-rose-400 p-1" title="Deactivate Employee">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-blue-500"/> Add Employee
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            {tempPassword ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Check className="text-emerald-500 mt-1" size={20} />
                  <div>
                    <h3 className="text-emerald-500 font-semibold mb-1">Employee created!</h3>
                    <p className="text-slate-300 text-sm mb-3">Please copy the temporary password below. It will not be shown again.</p>
                    <div className="font-mono bg-slate-950 p-3 rounded-lg text-emerald-400 text-lg text-center select-all border border-emerald-500/20">
                      {tempPassword}
                    </div>
                  </div>
                </div>
                <button onClick={() => {setIsAddModalOpen(false); setTempPassword(null)}} className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors">Done</button>
              </div>
            ) : (
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                  <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username (ID)</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="emp_03" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
                  <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="Engineering" />
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium text-white flex items-center gap-2">Create Employee</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 size={20} className="text-blue-500"/> Edit Employee
              </h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
            </div>
            {tempPassword ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Check className="text-emerald-500 mt-1" size={20} />
                  <div>
                    <h3 className="text-emerald-500 font-semibold mb-1">Password Reset!</h3>
                    <p className="text-slate-300 text-sm mb-3">Please copy the new temporary password below.</p>
                    <div className="font-mono bg-slate-950 p-3 rounded-lg text-emerald-400 text-lg text-center select-all border border-emerald-500/20">
                      {tempPassword}
                    </div>
                  </div>
                </div>
                <button onClick={() => {setIsEditModalOpen(false); setTempPassword(null)}} className="w-full mt-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors">Done</button>
              </div>
            ) : (
              <form onSubmit={handleEditEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                  <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username (ID)</label>
                  <input type="text" disabled value={formData.username} className="w-full bg-slate-900 border border-white/5 rounded-lg px-4 py-2.5 text-slate-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
                  <input required type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-4">
                  <input type="checkbox" id="reset_pwd" checked={formData.reset_password} onChange={e => setFormData({...formData, reset_password: e.target.checked})} className="w-4 h-4 rounded bg-slate-950 border-white/10 text-amber-500 focus:ring-amber-500/50" />
                  <label htmlFor="reset_pwd" className="text-sm text-amber-500/90 font-medium cursor-pointer">Generate new temporary password</label>
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-medium">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium text-white">Save Changes</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
