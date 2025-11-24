

import { SensorDevice, EnvironmentReading, VpdZone } from '../types';
import { EnvironmentService } from './environmentService';
import { errorService } from './errorService';

type SensorCallback = (deviceId: string, reading: EnvironmentReading) => void;
type Unsubscribe = () => void;

/**
 * HardwareService: Handles "Real IoT" Integration
 * Simulates Bluetooth Low Energy (BLE) scanning and connection.
 * Implements VPD Auto-Pilot for push notifications.
 */
export class HardwareService {
  // Track multiple connected devices by ID
  private connectedDevices: Map<string, SensorDevice> = new Map();
  private listeners: SensorCallback[] = [];
  private simulationInterval: any = null;
  private notificationsEnabled: boolean = true;
  
  // Notification Throttling
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_COOLDOWN = 30 * 60 * 1000; // 30 minutes
  
  // Error Throttling
  private lastErrorTime = 0;
  private readonly ERROR_COOLDOWN = 60 * 1000; // 1 minute to prevent spamming logs

  // Mock known devices for the simulation
  private mockDevices: SensorDevice[] = [
    { id: 'gov-h5075-88a1', name: 'Govee H5075 (Garage)', type: 'Govee', isConnected: false, batteryLevel: 92 },
    { id: 'sp-ht1-b2', name: 'SensorPush HT1 (Tent)', type: 'SensorPush', isConnected: false, batteryLevel: 78 },
  ];

  /**
   * Simulates scanning for BLE devices (e.g. Web Bluetooth API)
   */
  public async scanForDevices(): Promise<SensorDevice[]> {
    errorService.addBreadcrumb('system', 'Scanning for BLE Devices');
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.mockDevices);
      }, 500); // Fast scan for UX
    });
  }

  /**
   * Connects to a specific device and starts the data stream for it
   */
  public async connectToDevice(deviceId: string): Promise<boolean> {
    const device = this.mockDevices.find(d => d.id === deviceId);
    if (device) {
      // Add to connected set
      this.connectedDevices.set(deviceId, { ...device, isConnected: true });
      errorService.addBreadcrumb('system', `Connected to Device: ${device.name}`);
      
      // Ensure stream is running if this is the first device
      if (!this.simulationInterval) {
        this.startDataStream();
      }
      return true;
    }
    
    // Log failure
    errorService.captureError(new Error(`Device Connection Failed: ${deviceId}`), { severity: 'LOW' });
    return false;
  }

  public disconnect(deviceId?: string) {
    if (deviceId) {
      this.connectedDevices.delete(deviceId);
      errorService.addBreadcrumb('system', `Disconnected Device: ${deviceId}`);
    } else {
      this.connectedDevices.clear();
      errorService.addBreadcrumb('system', `Disconnected All Devices`);
    }
    
    if (this.connectedDevices.size === 0 && this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  public getConnectedDevices(): SensorDevice[] {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Subscribes to sensor readings. Returns an unsubscribe function.
   * Callback now includes deviceId to distinguish sources.
   */
  public onReading(callback: SensorCallback): Unsubscribe {
    this.listeners.push(callback);
    // Return cleanup function to prevent memory leaks
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  public setNotificationsEnabled(enabled: boolean) {
    this.notificationsEnabled = enabled;
  }

  public requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  private startDataStream() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    
    // Simulate hardware polling
    this.simulationInterval = setInterval(() => {
      if (this.connectedDevices.size === 0) return;

      const now = Date.now();

      // Iterate through ALL connected devices and emit independent readings
      this.connectedDevices.forEach((device) => {
        try {
            // Create distinct microclimates based on device type
            let tempBase = 75;
            let humBase = 50;

            if (device.type === 'Govee') {
            // Garage environment: Slightly cooler, higher fluctuation
            tempBase = 72; 
            humBase = 45;
            } else if (device.type === 'SensorPush') {
            // Tent environment: Warmer, more humid (transpiration)
            tempBase = 78;
            humBase = 55;
            }

            // Simulate realistic sensor jitter/drift
            const temp = tempBase + (Math.random() * 3 - 1.5);
            const hum = humBase + (Math.random() * 6 - 3);
            
            const reading: EnvironmentReading = {
            temperature: temp,
            humidity: hum,
            ppfd: 850 + (Math.random() * 20 - 10),
            co2: 420 + (Math.random() * 50 - 25),
            timestamp: now
            };

            // Update local state
            device.lastReading = reading;
            
            // Broadcast to app
            this.listeners.forEach(cb => cb(device.id, reading));

            // VPD Auto-Pilot Check (Global)
            this.checkVpdSafety(reading, device.name);
        } catch (e) {
            // Throttle error logging for high-frequency loops
            if (now - this.lastErrorTime > this.ERROR_COOLDOWN) {
                errorService.captureError(e as Error, { severity: 'MEDIUM', metadata: { context: 'SensorLoop', device: device.name } });
                this.lastErrorTime = now;
            }
        }
      });

    }, 3000); // 3 seconds refresh rate for "Live" feel
  }

  private checkVpdSafety(reading: EnvironmentReading, sourceName: string) {
    if (!this.notificationsEnabled) return;

    const metrics = EnvironmentService.processReading(reading);
    const now = Date.now();
    
    // Throttle notifications to prevent spamming (max 1 per 30 mins)
    if (now - this.lastNotificationTime < this.NOTIFICATION_COOLDOWN) return;

    if (metrics.vpdStatus === VpdZone.DANGER || metrics.vpdStatus === VpdZone.LEECHING) {
      this.triggerNotification(
        `CRITICAL VPD (${sourceName})`, 
        `${metrics.vpd.toFixed(2)} kPa - Environment is drifting into ${metrics.vpdStatus}.`
      );
      this.lastNotificationTime = now;
    }
  }

  private triggerNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else {
      console.debug("Notification skipped:", title);
    }
  }
}

export const hardwareService = new HardwareService();
