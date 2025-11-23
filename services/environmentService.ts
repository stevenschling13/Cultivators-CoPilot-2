
import { EnvironmentReading, CalculatedMetrics, VpdZone } from '../types';

export class EnvironmentService {
  /**
   * Helper to convert Fahrenheit to Celsius for internal calculations
   */
  private static fToC(f: number): number {
    return (f - 32) * 5 / 9;
  }

  /**
   * Calculates SVP (Saturation Vapor Pressure) using the Arrhenius equation (Tetens formula approximation for performance).
   * @param tempC Temperature in Celsius
   * @returns SVP in kPa
   */
  private static calculateSVP(tempC: number): number {
    return 0.61078 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  }

  /**
   * Calculates VPD (Vapor Pressure Deficit).
   * Expects input temperature in Celsius for the formula.
   */
  public static calculateVPD(tempC: number, humidity: number): number {
    const svp = this.calculateSVP(tempC);
    const vp = (humidity / 100) * svp;
    return svp - vp;
  }

  /**
   * Calculates DLI (Daily Light Integral).
   * Assumes a 12 hour photoperiod for Flowering or 18 for Veg. 
   * For this generic calc, we accept photoperiod hours.
   */
  public static calculateDLI(ppfd: number, hours: number = 18): number {
    // DLI = PPFD * hours * 3600 / 1,000,000
    return (ppfd * hours * 3600) / 1000000;
  }

  public static getVpdStatus(vpd: number, isFlower: boolean = false): VpdZone {
    // General cannabis guidelines
    // Clone/Prop: 0.4 - 0.8
    // Veg: 0.8 - 1.1
    // Flower: 1.0 - 1.5
    
    if (vpd < 0.4) return VpdZone.DANGER; // Mold risk
    if (vpd > 1.6) return VpdZone.LEECHING; // Stomata close

    if (isFlower) {
      if (vpd >= 1.0 && vpd <= 1.5) return VpdZone.TRANSPIRATION;
      return VpdZone.DANGER;
    } else {
      // Veg
      if (vpd >= 0.8 && vpd <= 1.2) return VpdZone.TRANSPIRATION;
      return VpdZone.DANGER;
    }
  }

  public static processReading(reading: EnvironmentReading): CalculatedMetrics {
    // Convert F to C for physics calculations
    const tempC = this.fToC(reading.temperature);
    const vpd = this.calculateVPD(tempC, reading.humidity);
    const dli = this.calculateDLI(reading.ppfd, 18); // Defaulting to Veg hours
    const vpdStatus = this.getVpdStatus(vpd);

    return {
      vpd: parseFloat(vpd.toFixed(2)),
      dli: parseFloat(dli.toFixed(2)),
      vpdStatus
    };
  }
}
