
import { GeminiService } from './geminiService';
import { HardwareService } from './hardwareService';
import { FacilityBriefing, SensorDevice } from '../types';

export class MockGeminiService extends GeminiService {
  async generateFacilityBriefing(): Promise<FacilityBriefing> {
    return {
      status: 'OPTIMAL',
      summary: 'Mock System Online. All systems nominal.',
      actionItems: [
        { task: 'Check pH', dueDate: 'Today', priority: 'High' },
        { task: 'Inspect runoff', dueDate: 'Tomorrow', priority: 'Medium' }
      ],
      weatherAlert: 'None',
      timestamp: Date.now()
    };
  }
}

export class MockHardwareService extends HardwareService {
  async scanForDevices(): Promise<SensorDevice[]> {
    return [
      { id: 'mock-1', name: 'Mock Sensor', type: 'Generic', connectionType: 'BLE', isConnected: true, batteryLevel: 100 }
    ];
  }
}
