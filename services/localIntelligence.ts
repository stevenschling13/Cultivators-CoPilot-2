
import { 
  Room, 
  PlantBatch, 
  FacilityBriefing, 
  BriefingAction, 
  GrowLog, 
  AlertLevel 
} from '../types';
import { STAGE_INFO, MOCK_ROOMS } from '../constants';

/**
 * LocalIntelligence: Deterministic Rule Engine
 * Provides INSTANT status reports while the AI warms up.
 * Zero-latency, runs purely on the client.
 */
export class LocalIntelligence {

  public static generateBriefing(rooms: Room[], batches: PlantBatch[], logs: GrowLog[]): FacilityBriefing {
    const actions: BriefingAction[] = [];
    let criticalCount = 0;
    let warningCount = 0;
    let status: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL' = 'OPTIMAL';

    // 1. Analyze Environments
    rooms.forEach(room => {
      const { metrics, name } = room;
      
      // Check staleness (older than 30 mins)
      const isStale = Date.now() - metrics.lastUpdated > 30 * 60 * 1000;
      
      if (metrics.status === 'CRITICAL' || (metrics.vpd > 1.6 || metrics.vpd < 0.4)) {
        criticalCount++;
        actions.push({
          task: `${name}: Critical VPD (${metrics.vpd} kPa). Check Humidifier/AC.`,
          priority: 'High',
          dueDate: 'Immediate'
        });
      } else if (metrics.status === 'WARNING' || isStale) {
        warningCount++;
        actions.push({
          task: `${name}: Environment drifting. Inspect sensors.`,
          priority: 'Medium',
          dueDate: 'Today'
        });
      }
    });

    // 2. Analyze Batches (Schedule)
    batches.filter(b => b.isActive).forEach(batch => {
      const daysInStage = Math.floor((Date.now() - batch.startDate) / (1000 * 60 * 60 * 24));
      
      // Generic Rule: Defoliation every 21 days in Veg or Day 1/21 Flower
      if (batch.currentStage === 'Flowering' && (daysInStage === 20 || daysInStage === 21)) {
        actions.push({
          task: `${batch.strain}: Day 21 Heavy Defoliation due.`,
          priority: 'High',
          dueDate: 'Today'
        });
      }
    });

    // 3. Determine Global Status
    if (criticalCount > 0) status = 'CRITICAL';
    else if (warningCount > 0) status = 'ATTENTION';

    // 4. Construct Summary
    const activeRoomCount = rooms.length;
    const activeBatchCount = batches.filter(b => b.isActive).length;
    
    let summary = `System Nominal. Monitoring ${activeRoomCount} active environments and ${activeBatchCount} genetic cohorts.`;
    
    if (status === 'CRITICAL') {
      summary = `ALERT: ${criticalCount} Critical environmental issues detected. Immediate intervention required.`;
    } else if (status === 'ATTENTION') {
      summary = `Attention needed. ${warningCount} warnings flagged in current telemetry scan.`;
    }

    return {
      status,
      summary,
      actionItems: actions.sort((a, b) => (a.priority === 'High' ? -1 : 1)), // High priority first
      timestamp: Date.now()
    };
  }
}
