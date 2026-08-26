import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Monitor, Wifi, Bell, Settings, LayoutDashboard, LogOut, Briefcase } from 'lucide-react';
import Notifications from '../components/Notifications';
import { EmployeeProvider, useEmployeeContext } from '../contexts/EmployeeContext';

function EmployeeSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const fullName = localStorage.getItem('trustloop_full_name');
  
  const { trustScore } = useEmployeeContext();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const navItems = [
    { name: 'Workspace', path: '/dashboard/workspace', icon: <Briefcase size={18} /> },
    { name: 'Overview', path: '/dashboard/overview', icon: <LayoutDashboard size={18} /> },
    { name: 'My Devices', path: '/dashboard/devices', icon: <Monitor size={18} /> },
    { name: 'Network', path: '/dashboard/network', icon: <Wifi size={18} /> },
    { name: 'Alerts', path: '/dashboard/alerts', icon: <Bell size={18} /> },
    { name: 'Settings', path: '/dashboard/settings', icon: <Settings size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside style={{ width: '260px', backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck color="var(--accent-primary)" size={28} />
          <span className="display-font" style={{ fontSize: '20px', fontWeight: '600' }}>TrustLoop</span>
        </div>

        <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
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

        {/* Persistent Trust Gauge */}
        <div style={{ padding: '16px', margin: '0 12px 12px', backgroundColor: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Live Trust Score</span>
            <span className="mono-font" style={{ color: trustScore >= 80 ? 'var(--accent-trust)' : (trustScore >= 60 ? 'var(--accent-warn)' : 'var(--accent-danger)'), fontWeight: '600' }}>
              {trustScore}
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${trustScore}%`, backgroundColor: trustScore >= 80 ? 'var(--accent-trust)' : (trustScore >= 60 ? 'var(--accent-warn)' : 'var(--accent-danger)'), transition: 'width 0.3s ease-out, background-color 0.3s' }} />
          </div>
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>{fullName}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Employee</div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500', padding: 0 }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
        <div style={{ padding: '12px 24px', fontSize: '11px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-base)' }}>
          Monitored for continuous security. 
          <a href="#" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'block', marginTop: '4px' }}>Privacy Policy</a>
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

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const role = localStorage.getItem('trustloop_role');

  if (role !== 'employee') {
    navigate('/login');
    return null;
  }

  return (
    <EmployeeProvider>
      <EmployeeSidebar />
    </EmployeeProvider>
  );
}
