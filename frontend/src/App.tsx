import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Employee Routes */}
        <Route path="/dashboard" element={<EmployeeLayout />}>
          <Route path="workspace" element={<Workspace />} />
          <Route path="overview" element={<EmployeeOverview />} />
          <Route path="devices" element={<MyDevices />} />
          <Route path="network" element={<EmployeeNetwork />} />
          <Route path="alerts" element={<EmployeeAlerts />} />
          <Route path="settings" element={<EmployeeSettings />} />
          <Route index element={<Navigate to="workspace" replace />} />
        </Route>
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="overview" element={<AdminOverview />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="network" element={<NetworkMap />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="policy" element={<PolicySettings />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>
        
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
