

import { SensorDevice, EnvironmentReading, VpdZone } from '../types';
import { EnvironmentService } from './environmentService';

type SensorCallback = (reading: EnvironmentReading) => void;
type Unsubscribe = () => void;

/**
 * HardwareService: Handles "Real IoT" Integration
 * Simulates Bluetooth Low Energy (BLE) scanning and connection.
 * Implements VPD Auto-Pilot for push notifications.
 */
export class HardwareService {
  private connectedDevice: SensorDevice | null = null;
  private listeners: SensorCallback[] = [];
  private simulationInterval: any = null;
  private notificationsEnabled: boolean = true;
  
  // Notification Throttling
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_COOLDOWN = 30 * 60 * 1000; // 30 minutes

  // Mock known devices for the simulation
  private mockDevices: SensorDevice[] = [
    { id: 'gov-h5075-88a1', name: 'Govee H5075 (Garage)', type: 'Govee', isConnected: false, batteryLevel: 92 },
    { id: 'sp-ht1-b2', name: 'SensorPush HT1 (Tent)', type: 'SensorPush', isConnected: false, batteryLevel: 78 },
  ];

  /**
   * Simulates scanning for BLE devices (e.g. Web Bluetooth API)
   */
  public async scanForDevices(): Promise<SensorDevice[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.mockDevices);
      }, 1500);
    });
  }

  /**
   * Connects to a specific device and starts the data stream
   */
  public async connectToDevice(deviceId: string): Promise<boolean> {
    const device = this.mockDevices.find(d => d.id === deviceId);
    if (device) {
      this.connectedDevice = { ...device, isConnected: true };
      this.startDataStream();
      return true;
    }
    return false;
  }

  public disconnect() {
    this.connectedDevice = null;
    if (this.simulationInterval) clearInterval(this.simulationInterval);
  }

  public getConnectedDevice(): SensorDevice | null {
    return this.connectedDevice;
  }

  /**
   * Subscribes to sensor readings. Returns an unsubscribe function.
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
    
    // Simulate 1-minute hardware polling
    this.simulationInterval = setInterval(() => {
      if (!this.connectedDevice) return;

      // Simulate realistic sensor drift
      const temp = 75 + (Math.random() * 4 - 2); // 73-77F
      const hum = 50 + (Math.random() * 10 - 5); // 45-55%
      
      const reading: EnvironmentReading = {
        temperature: temp,
        humidity: hum,
        ppfd: 850 + (Math.random() * 20 - 10),
        co2: 420,
        timestamp: Date.now()
      };

      this.connectedDevice.lastReading = reading;
      
      // Broadcast to app
      this.listeners.forEach(cb => cb(reading));

      // VPD Auto-Pilot Check
      this.checkVpdSafety(reading);

    }, 5000); // 5 seconds for demo purposes (would be 60s in prod)
  }

  private checkVpdSafety(reading: EnvironmentReading) {
    if (!this.notificationsEnabled) return;

    const metrics = EnvironmentService.processReading(reading);
    const now = Date.now();
    
    // Throttle notifications to prevent spamming (max 1 per 30 mins)
    if (now - this.lastNotificationTime < this.NOTIFICATION_COOLDOWN) return;

    if (metrics.vpdStatus === VpdZone.DANGER || metrics.vpdStatus === VpdZone.LEECHING) {
      this.triggerNotification(
        `CRITICAL VPD ALERT: ${metrics.vpd} kPa`, 
        `Environment is drifting into ${metrics.vpdStatus}. Check equipment immediately.`
      );
      this.lastNotificationTime = now;
    }
  }

  private triggerNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    } else {
      console.log("Notification skipped:", title);
    }
  }
}

export const hardwareService = new HardwareService();