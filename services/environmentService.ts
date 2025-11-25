

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
   * Uses Leaf Surface Temperature if offset is provided, otherwise approximates with Air Temp.
   * Standard Formula: VPD = SVP(Leaf) - (RH/100 * SVP(Air))
   */
  public static calculateVPD(airTempC: number, humidity: number, leafOffsetF: number = 0): number {
    // Convert Offset to Celsius delta (approx 5/9 * F)
    const leafOffsetC = leafOffsetF * (5/9);
    const leafTempC = airTempC + leafOffsetC;

    const svpLeaf = this.calculateSVP(leafTempC);
    const svpAir = this.calculateSVP(airTempC);
    
    const vpAir = (humidity / 100) * svpAir;
    
    // VPD is difference between saturation pressure at LEAF temp and actual vapor pressure of AIR
    return svpLeaf - vpAir;
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

  public static processReading(reading: EnvironmentReading, leafOffsetF: number = -2): CalculatedMetrics {
    // Convert F to C for physics calculations
    const tempC = this.fToC(reading.temperature);
    
    // Use the user-defined offset (default -2F for LEDs)
    const vpd = this.calculateVPD(tempC, reading.humidity, leafOffsetF);
    
    const dli = this.calculateDLI(reading.ppfd, 18); // Defaulting to Veg hours
    const vpdStatus = this.getVpdStatus(vpd);

    return {
      vpd: parseFloat(Math.max(0, vpd).toFixed(2)), // VPD cannot be negative physically in this context
      dli: parseFloat(dli.toFixed(2)),
      vpdStatus
    };
  }
}