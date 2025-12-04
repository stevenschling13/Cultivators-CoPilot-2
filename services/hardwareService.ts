
import { SensorDevice, EnvironmentReading, VpdZone } from '../types';
import { EnvironmentService } from './environmentService';
import { errorService } from './errorService';

type SensorCallback = (deviceId: string, reading: EnvironmentReading) => void;
type Unsubscribe = () => void;

/**
 * HardwareService: Handles "Real IoT" Integration
 * Simulates Bluetooth Low Energy (BLE) scanning and Cloud API connections.
 * Implements VPD Auto-Pilot for push notifications.
 */
export class HardwareService {
  // Track multiple connected devices by ID
  private connectedDevices: Map<string, SensorDevice> = new Map();
  private listeners: SensorCallback[] = [];
  private simulationInterval: ReturnType<typeof setInterval> | null = null;
  private notificationsEnabled: boolean = true;
  
  // Notification Throttling
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_COOLDOWN = 30 * 60 * 1000; // 30 minutes
  
  // Error Throttling
  private lastErrorTime = 0;
  private readonly ERROR_COOLDOWN = 60 * 1000; // 1 minute to prevent spamming logs

  // Mock known devices for the simulation
  private mockDevices: SensorDevice[] = [
    { id: 'aci-69-pro-x1', name: 'AC Infinity Controller 69 Pro', type: 'AC Infinity', connectionType: 'WiFi', isConnected: false, batteryLevel: 100 },
    { id: 'gov-h5075-88a1', name: 'Govee H5075 (Garage)', type: 'Govee', connectionType: 'BLE', isConnected: false, batteryLevel: 92 },
    { id: 'sp-ht1-b2', name: 'SensorPush HT1 (Tent)', type: 'SensorPush', connectionType: 'BLE', isConnected: false, batteryLevel: 78 },
    { id: 'pulse-one-x9', name: 'Pulse One (Main)', type: 'Pulse', connectionType: 'WiFi', isConnected: false, batteryLevel: 100 },
    { id: 'gen-ble-04', name: 'Generic BLE Hygrometer', type: 'Generic', connectionType: 'BLE', isConnected: false, batteryLevel: 45 },
  ];

  /**
   * Simulates scanning for BLE devices (e.g. Web Bluetooth API)
   * Returns the list for UI selection.
   */
  public async scanForDevices(): Promise<SensorDevice[]> {
    errorService.addBreadcrumb('system', 'Scanning for Devices (BLE + Cloud)');
    // Return immediately to avoid UI blocking
    return this.mockDevices;
  }

  /**
   * Returns known devices without triggering a new scan (synchronous access to cache)
   */
  public getKnownDevices(): SensorDevice[] {
      return this.mockDevices;
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

  /**
   * Forces an immediate sensor read. 
   * Useful when app returns to foreground after browser throttled background timers.
   */
  public wakeUp() {
    if (this.connectedDevices.size > 0) {
        // Clear existing interval to reset the clock
        if (this.simulationInterval) clearInterval(this.simulationInterval);
        
        // Immediate read
        this.emitReadings();
        
        // Restart interval
        this.startDataStream();
    }
  }

  private emitReadings() {
      const now = Date.now();
      
      this.connectedDevices.forEach((device) => {
        try {
            if (!device.id) throw new Error("Invalid Device ID");

            let tempBase = 75;
            let humBase = 50;

            if (device.type === 'Govee') {
                tempBase = 72; 
                humBase = 45;
            } else if (device.type === 'SensorPush') {
                tempBase = 78;
                humBase = 55;
            } else if (device.type === 'Pulse') {
                tempBase = 80;
                humBase = 60;
            } else if (device.type === 'AC Infinity') {
                tempBase = 76; // Very stable
                humBase = 58;
            }

            // Simulate noise and drift
            const temp = tempBase + (Math.random() * 3 - 1.5);
            const hum = humBase + (Math.random() * 6 - 3);
            
            const reading: EnvironmentReading = {
                temperature: temp,
                humidity: hum,
                ppfd: 850 + (Math.random() * 20 - 10),
                co2: 420 + (Math.random() * 50 - 25),
                timestamp: now
            };

            device.lastReading = reading;
            
            // Safe broadcast
            this.listeners.forEach(cb => {
                try {
                    cb(device.id, reading);
                } catch (e) {
                    console.warn(`Hardware listener failed for ${device.id}`, e);
                }
            });
            
            this.checkVpdSafety(reading, device.name);
        } catch (e) {
            // Error handling logic
            console.error("Error emitting reading for device", device.id, e);
        }
      });
  }

  private startDataStream() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.simulationInterval = setInterval(() => {
      this.emitReadings();
    }, 3000); 
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
