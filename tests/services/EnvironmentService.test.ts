
import { describe, it, expect } from 'vitest';
import { EnvironmentService } from '../../services/environmentService';
import { VpdZone } from '../../types';

describe('EnvironmentService Physics Engine', () => {
  describe('calculateVPD', () => {
    it('calculates VPD correctly for standard Veg conditions', () => {
      // 82F, 65% RH -> Expect ~0.9 - 1.1 kPa
      const tempF = 82;
      const rh = 65;
      const tempC = (tempF - 32) * 5 / 9;
      
      const vpd = EnvironmentService.calculateVPD(tempC, rh, -2); // -2 leaf offset
      expect(vpd).toBeGreaterThan(0.8);
      expect(vpd).toBeLessThan(1.2);
    });

    it('identifies danger zones (High Humidity)', () => {
      // 75F, 80% RH (Late Flower Rot Risk)
      const tempF = 75;
      const rh = 80;
      const tempC = (tempF - 32) * 5 / 9;
      
      const vpd = EnvironmentService.calculateVPD(tempC, rh, -2);
      // SVP at 23.8C is ~2.9kPa. 
      // Leaf Temp 22.7C (SVP ~2.7kPa).
      // Air VP = 0.8 * 2.9 = 2.32
      // VPD = 2.7 - 2.32 = 0.38
      expect(vpd).toBeLessThan(0.6);
    });
  });

  describe('getVpdStatus', () => {
    it('returns TRANSPIRATION for optimal flower range', () => {
      const status = EnvironmentService.getVpdStatus(1.3, true); // Flower
      expect(status).toBe(VpdZone.TRANSPIRATION);
    });

    it('returns DANGER for mold risk in flower', () => {
      const status = EnvironmentService.getVpdStatus(0.5, true); // Flower
      expect(status).toBe(VpdZone.DANGER);
    });

    it('returns LEECHING for dry conditions', () => {
      const status = EnvironmentService.getVpdStatus(1.8, false);
      expect(status).toBe(VpdZone.LEECHING);
    });
  });

  describe('calculateDLI', () => {
    it('calculates Daily Light Integral correctly', () => {
      // 1000 PPFD for 12 hours
      // (1000 * 12 * 3600) / 1,000,000 = 43.2
      const dli = EnvironmentService.calculateDLI(1000, 12);
      expect(dli).toBeCloseTo(43.2, 1);
    });
  });
});
