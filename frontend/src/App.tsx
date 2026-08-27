import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Landing from './pages/Landing';
import ColdStartLoader from './components/ColdStartLoader';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import EmployeeLayout from './layouts/EmployeeLayout';
import AdminLayout from './layouts/AdminLayout';
import EmployeeOverview from './pages/employee/EmployeeOverview';
import AdminOverview from './pages/admin/AdminOverview';

import PolicySettings from './pages/admin/PolicySettings';
import NetworkMap from './pages/admin/NetworkMap';
import AuditLog from './pages/admin/AuditLog';
import AdminEmployees from './pages/admin/AdminEmployees';

import Workspace from './pages/employee/Workspace';
import MyDevices from './pages/employee/MyDevices';
import EmployeeNetwork from './pages/employee/EmployeeNetwork';
import EmployeeAlerts from './pages/employee/EmployeeAlerts';
import EmployeeSettings from './pages/employee/EmployeeSettings';

// ─── Protected Route Guard ─────────────────────────────────────────────────────
// Renders children only when the user is authenticated AND has the required role.
// AuthProvider already blocks rendering while the /me check is in-flight, so by
// the time ProtectedRoute renders, isLoading is always false.
function ProtectedRoute({ role, children }: { role: 'employee' | 'admin'; children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated || user?.role !== role) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// ─── Login Guard ──────────────────────────────────────────────────────────────
// Redirect already-authenticated users away from the login page.
function LoginRoute() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin/overview' : '/dashboard/workspace'} replace />;
  }
  return <Login />;
}

function App() {
  return (
    <ColdStartLoader>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<LoginRoute />} />

            {/* Employee Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role="employee">
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route path="workspace" element={<Workspace />} />
              <Route path="overview" element={<EmployeeOverview />} />
              <Route path="devices" element={<MyDevices />} />
              <Route path="network" element={<EmployeeNetwork />} />
              <Route path="alerts" element={<EmployeeAlerts />} />
              <Route path="settings" element={<EmployeeSettings />} />
              <Route index element={<Navigate to="workspace" replace />} />
            </Route>

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="overview" element={<AdminOverview />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="network" element={<NetworkMap />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="policy" element={<PolicySettings />} />
              <Route index element={<Navigate to="overview" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ColdStartLoader>
  );
}

export default App;
