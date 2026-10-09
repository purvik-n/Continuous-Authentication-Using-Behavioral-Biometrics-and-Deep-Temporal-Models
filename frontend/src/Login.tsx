import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from "./config";
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, User, Key, Users } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

interface Employee {
  username: string;
  full_name: string;
}

export default function Login() {
  const [mode, setMode] = useState<'employee' | 'admin'>('employee');
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  const [selectedEmp, setSelectedEmp] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    // Fetch seeded employees on mount
    fetch(API_BASE_URL + '/api/auth/users')
      .then(res => res.json())
      .then(data => setEmployees(data))
      .catch(err => console.error("Failed to fetch users:", err));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const username = mode === 'employee' ? selectedEmp : adminUser;
    
    if (!username) {
      setError('Please select an ID or enter a username.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(API_BASE_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      
      // Delegate all storage + state updates to AuthContext
      auth.login(data);

      if (data.role === 'admin') {
        navigate('/admin/overview');
      } else {
        navigate('/dashboard/workspace');
      }
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const selectedFullName = employees.find(e => e.username === selectedEmp)?.full_name || '';

  return (
    <div className="premium-gradient-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card glass-panel relative-z-1" style={{ maxWidth: '420px', width: '100%', border: '1px solid rgba(255,255,255,0.6)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', backgroundColor: 'rgba(51, 92, 255, 0.08)', borderRadius: '16px', marginBottom: '16px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)' }}>
            <ShieldCheck size={36} color="var(--accent-primary)" strokeWidth={2.5} />
          </div>
          <h1 className="display-font" style={{ fontSize: '28px', marginBottom: '8px', background: 'linear-gradient(90deg, #101828 0%, #335CFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TrustLoop</h1>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Continuous Authentication Engine</p>
        </div>

        {/* Tab Toggle */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
          <button 
            type="button"
            onClick={() => { setMode('employee'); setError(''); }}
            style={{
              flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
              backgroundColor: mode === 'employee' ? 'var(--bg-surface)' : 'transparent',
              boxShadow: mode === 'employee' ? '0 1px 3px rgba(16,24,40,0.1)' : 'none',
              color: mode === 'employee' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: mode === 'employee' ? '600' : '500',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Users size={16} /> Employee
          </button>
          <button 
            type="button"
            onClick={() => { setMode('admin'); setError(''); }}
            style={{
              flex: 1, padding: '8px', borderRadius: '6px', border: 'none',
              backgroundColor: mode === 'admin' ? 'var(--bg-surface)' : 'transparent',
              boxShadow: mode === 'admin' ? '0 1px 3px rgba(16,24,40,0.1)' : 'none',
              color: mode === 'admin' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: mode === 'admin' ? '600' : '500',
              cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Key size={16} /> Admin
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(240, 68, 56, 0.1)', color: 'var(--accent-danger)', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {mode === 'employee' ? (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Employee ID</label>
                <select 
                  className="input-field"
                  value={selectedEmp}
                  onChange={(e) => setSelectedEmp(e.target.value)}
                  required
                >
                  <option value="" disabled>Select your Employee ID...</option>
                  {employees.map(emp => (
                    <option key={emp.username} value={emp.username}>{emp.username}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Identity Confirmation</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', color: selectedFullName ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  <User size={18} color={selectedFullName ? "var(--accent-primary)" : "var(--text-secondary)"} />
                  <span style={{ fontWeight: '500' }}>{selectedFullName || 'Awaiting ID selection...'}</span>
                </div>
              </div>
            </>
          ) : (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Admin Username</label>
              <input 
                type="text" 
                className="input-field" 
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                placeholder="e.g. admin"
                required
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'employee' ? 'Log In as Employee' : 'Log In as Admin')}
          </button>
        </form>
      </div>
    </div>
  );
}
