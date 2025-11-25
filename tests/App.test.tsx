import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { App } from '../App';
import { ServiceProvider } from '../contexts/ServiceContext';
import { MockGeminiService, MockHardwareService } from '../services/mockServices';
import { dbService } from '../services/db';
import { errorService } from '../services/errorService';

describe('App Integration', () => {
  it('renders dashboard with mock data', async () => {
    const mockGemini = new MockGeminiService();
    const mockHardware = new MockHardwareService();

    const services = {
      dbService,
      geminiService: mockGemini,
      hardwareService: mockHardware,
      errorService
    };

    render(
      <ServiceProvider services={services}>
        <App />
      </ServiceProvider>
    );

    // Should eventually show the dashboard
    await waitFor(() => {
      expect(screen.getByText(/COMMAND CENTER/i)).toBeInTheDocument();
    });

    // Should load the mock briefing
    await waitFor(() => {
      expect(screen.getByText(/Mock System Online/i)).toBeInTheDocument();
    });
  });
});