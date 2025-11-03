import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';

import { TimeProvider } from './contexts/TimeContext';

// Terminal Pages (NO AUTH)
import Login from './pages/Login';
import KioskMode from './pages/KioskMode';
import AttendanceTerminal from './pages/AttendanceTerminal';

import './index.css';

// Separate QueryClient for terminals
const terminalQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const TerminalApp = () => {
  return (
    <QueryClientProvider client={terminalQueryClient}>
      <TimeProvider>
        <div className="TerminalApp">
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
            <Route path="/login" element={<Login />} />
            <Route path="/kiosk" element={<KioskMode />} />
            <Route path="/m/anwesenheit" element={<AttendanceTerminal />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </TimeProvider>
    </QueryClientProvider>
  );
};

export default TerminalApp;