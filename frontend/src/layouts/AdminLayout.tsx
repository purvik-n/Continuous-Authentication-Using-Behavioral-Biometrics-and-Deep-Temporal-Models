import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Users, Activity, Map, Settings, LayoutDashboard, LogOut, FileText, Bell } from 'lucide-react';
import Notifications from '../components/Notifications';
import { useAuth } from '../contexts/AuthContext';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const fullName = localStorage.getItem('trustloop_full_name');
  const auth = useAuth();

  const handleLogout = () => {
    auth.logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Overview', path: '/admin/overview', icon: <LayoutDashboard size={18} /> },
    { name: 'Employees', path: '/admin/employees', icon: <Users size={18} /> },
    { name: 'Network Map', path: '/admin/network', icon: <Map size={18} /> },
    { name: 'Audit Log', path: '/admin/audit', icon: <FileText size={18} /> },
    { name: 'Policy Settings', path: '/admin/policy', icon: <Settings size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck color="var(--accent-primary)" size={28} />
          <span className="display-font" style={{ fontSize: '20px', fontWeight: '600' }}>TrustLoop Admin</span>
        </div>

        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.name}
                to={item.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                  borderRadius: '8px', textDecoration: 'none',
                  backgroundColor: isActive ? 'rgba(51, 92, 255, 0.08)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? '600' : '500',
                  transition: 'all 0.2s'
                }}
              >
                {item.icon}
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: '24px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{fullName}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Security Administrator</div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500', padding: 0 }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
        <div style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-base)' }}>
          System operating under Policy ID-829. 
          <a href="#" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'block', marginTop: '4px' }}>View Compliance Framework</a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <header style={{ height: '64px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Notifications />
          </div>
        </header>

        {/* Dynamic Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
