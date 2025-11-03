import React, { createContext, useContext } from 'react';

const TimeContext = createContext();

export const TimeProvider = ({ children }) => {
  const value = {
    // Time-related functionality will be added here
  };

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
};

export const useTime = () => {
  const context = useContext(TimeContext);
  if (!context) {
    throw new Error('useTime must be used within a TimeProvider');
  }
  return context;
};