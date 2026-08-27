import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { Loader2 } from 'lucide-react';

export interface AuthUser {
  user_id: number;
  username: string;
  role: 'employee' | 'admin';
  full_name: string;
  session_id: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: Record<string, any>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.clear();
    setUser(null);
  }, []);

  const login = useCallback((data: Record<string, any>) => {
    // Persist everything to localStorage (same keys as before)
    localStorage.setItem('trustloop_token', data.access_token);
    localStorage.setItem('trustloop_session_id', String(data.session_id));
    localStorage.setItem('trustloop_user_id', String(data.user_id ?? '1'));
    localStorage.setItem('trustloop_role', data.role);
    localStorage.setItem('trustloop_full_name', data.full_name);
    localStorage.setItem('trustloop_network_isp', data.network_isp ?? '');
    localStorage.setItem('trustloop_initial_trust', String(data.initial_trust ?? 85));
    localStorage.setItem('trustloop_network_logic', data.network_logic ?? '');
    localStorage.setItem('trustloop_is_simulated', data.is_simulated ? 'true' : 'false');

    setUser({
      user_id: data.user_id,
      username: data.username ?? '',
      role: data.role,
      full_name: data.full_name,
      session_id: data.session_id,
    });
  }, []);

  // On every app mount: verify the stored token with the backend
  useEffect(() => {
    const token = localStorage.getItem('trustloop_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Token invalid or expired');
        return res.json();
      })
      .then((data: AuthUser) => {
        setUser(data);
      })
      .catch(() => {
        // Token is bad — clear everything so the guard redirects cleanly
        localStorage.clear();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // While we're verifying the token, show a full-screen spinner so no page
  // content flashes before we know whether the user is authenticated.
  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)',
      }}>
        <Loader2 size={48} color="var(--accent-primary)" className="animate-spin" />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Verifying session…
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
