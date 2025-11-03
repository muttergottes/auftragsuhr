import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  token: localStorage.getItem('token'),
};

function authReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      localStorage.setItem('token', action.payload.token);
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'TOKEN_VALIDATED':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'TOKEN_INVALID':
      localStorage.removeItem('token');
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Validate token on app start (skip for terminal routes)
  useEffect(() => {
    const validateToken = async () => {
      // Skip token validation for terminal routes
      if (window.location.pathname === '/anwesenheit' ||
          window.location.pathname === '/auftraege' ||
          window.location.pathname === '/kiosk' ||
          window.location.pathname === '/login') {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      if (!state.token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const response = await authAPI.validateToken();
        dispatch({ type: 'TOKEN_VALIDATED', payload: response.data });
      } catch (error) {
        console.error('Token validation failed:', error);
        dispatch({ type: 'TOKEN_INVALID' });
      }
    };

    validateToken();
  }, [state.token]);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      dispatch({ type: 'LOGIN_SUCCESS', payload: response.data });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      console.log('LOGIN ERROR in AuthContext:', errorMessage);
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const kioskLogin = async (credentials) => {
    try {
      const response = await authAPI.kioskLogin(credentials);
      // For kiosk mode, we don't store token, just return user info
      return { success: true, user: response.data.user };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Kiosk login failed' 
      };
    }
  };

  const scanLogin = async (credentials) => {
    try {
      const response = await authAPI.scanLogin(credentials);
      return { success: true, user: response.data.user };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Scan login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'LOGOUT' });
    }
  };

  const hasRole = (requiredRoles) => {
    if (!state.user) return false;
    if (typeof requiredRoles === 'string') {
      return state.user.role === requiredRoles;
    }
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.includes(state.user.role);
    }
    return false;
  };

  const canViewCosts = () => {
    return hasRole(['admin', 'dispatcher']);
  };

  const value = {
    ...state,
    login,
    kioskLogin,
    scanLogin,
    logout,
    hasRole,
    canViewCosts,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};