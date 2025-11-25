import React, { createContext, useContext, ReactNode } from 'react';
import { dbService } from '../services/db';
import { geminiService } from '../services/geminiService';
import { hardwareService } from '../services/hardwareService';
import { errorService } from '../services/errorService';

// Define the shape of our service container
interface ServiceContainer {
  dbService: typeof dbService;
  geminiService: typeof geminiService;
  hardwareService: typeof hardwareService;
  errorService: typeof errorService;
}

// Default services (Production implementation)
const defaultServices: ServiceContainer = {
  dbService,
  geminiService,
  hardwareService,
  errorService
};

const ServiceContext = createContext<ServiceContainer>(defaultServices);

export const ServiceProvider = ({ children, services = defaultServices }: { children?: ReactNode, services?: ServiceContainer }) => {
  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = () => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useServices must be used within a ServiceProvider");
  }
  return context;
};