import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// Deutsche Übersetzungen für API-Fehler
const translateError = (error) => {
  const translations = {
    'Too many authentication attempts, please try again later.': 'Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.',
    'Invalid credentials': 'Ungültige Anmeldedaten',
    'User not found or inactive': 'Benutzer nicht gefunden oder inaktiv',
    'Login failed': 'Anmeldung fehlgeschlagen',
    'Network Error': 'Netzwerkfehler',
    'Internal server error': 'Interner Serverfehler'
  };
  
  return translations[error] || error;
};

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const result = await login(formData);
      
      if (result && result.success) {
        // Erfolg - wird automatisch weitergeleitet
      } else {
        const germanError = translateError(result?.error || 'Anmeldung fehlgeschlagen');
        toast.error(germanError);
      }
    } catch (error) {
      toast.error('Unerwarteter Fehler beim Anmelden');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Auftragsuhr
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Bitte melden Sie sich an
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          
          <div>
            <label htmlFor="email" className="form-label">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="form-input"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label htmlFor="password" className="form-label">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="form-input"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn btn-primary"
          >
            {isLoading ? 'Anmeldung...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;