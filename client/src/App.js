import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TimeProvider } from './contexts/TimeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveBoard from './pages/LiveBoard';
import WorkOrders from './pages/WorkOrders';
import Users from './pages/Users';
import Statistics from './pages/Statistics';
import Settings from './pages/Settings';
import KioskMode from './pages/KioskMode';
import AttendanceTerminal from './pages/AttendanceTerminal';
import SimpleAttendance from './pages/SimpleAttendance';
import WorkOrderTerminal from './pages/WorkOrderTerminal';
import SimpleWorkOrders from './pages/SimpleWorkOrders';

import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Component to redirect employees to kiosk mode
const EmployeeRedirect = () => {
  const { user } = useAuth();
  
  if (user?.role === 'employee') {
    return <Navigate to="/kiosk" replace />;
  } else {
    return <Navigate to="/dashboard" replace />;
  }
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TimeProvider>
          <Router>
            <div className="App">
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 8000,
                  style: {
                    background: '#ffffff',
                    color: '#1f2937',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '16px',
                    padding: '16px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  },
                  success: {
                    duration: 6000,
                    style: {
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                    },
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#ffffff',
                    },
                  },
                  error: {
                    duration: 10000,
                    style: {
                      background: '#fef2f2',
                      color: '#991b1b',
                      border: '1px solid #fecaca',
                    },
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#ffffff',
                    },
                  },
                }}
              />
              
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/kiosk" element={<KioskMode />} />
                <Route path="/anwesenheit" element={<SimpleAttendance />} />
                <Route path="/auftraege" element={<SimpleWorkOrders />} />
                
                {/* Protected routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<EmployeeRedirect />} />
                  
                  {/* Admin/Dispatcher only routes */}
                  <Route path="dashboard" element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatcher']}>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="live-board" element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatcher']}>
                      <LiveBoard />
                    </ProtectedRoute>
                  } />
                  <Route path="work-orders" element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatcher']}>
                      <WorkOrders />
                    </ProtectedRoute>
                  } />
                  <Route path="users" element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatcher']}>
                      <Users />
                    </ProtectedRoute>
                  } />
                  <Route path="statistics" element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatcher']}>
                      <Statistics />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin only routes */}
                  <Route path="settings" element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Settings />
                    </ProtectedRoute>
                  } />
                </Route>

                {/* Catch all */}
                <Route path="*" element={<EmployeeRedirect />} />
              </Routes>
            </div>
          </Router>
        </TimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;