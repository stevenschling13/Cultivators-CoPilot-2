import { useState, useCallback, useRef, useEffect } from 'react';
import { Room } from '../types';
import { dbService } from '../services/db';
import { hardwareService } from '../services/hardwareService';
import { EnvironmentService } from '../services/environmentService';
import { VpdZone } from '../types';
import { MOCK_ROOMS } from '../constants';

export const useRooms = (initialRooms: Room[] = MOCK_ROOMS) => {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const roomsRef = useRef(rooms);

  // Sync ref for effect closure
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  const updateRoom = useCallback((room: Room) => {
    setRooms(prev => {
      const idx = prev.findIndex(r => r.id === room.id);
      if (idx === -1) return [...prev, room];
      const newRooms = [...prev];
      newRooms[idx] = room;
      return newRooms;
    });
  }, []);

  const saveRoom = useCallback(async (room: Room) => {
    await dbService.saveRoom(room);
    updateRoom(room);
    if (room.sensorId) {
      hardwareService.connectToDevice(room.sensorId);
    }
  }, [updateRoom]);

  const deleteRoom = useCallback(async (id: string) => {
    await dbService.deleteRoom(id);
    setRooms(prev => prev.filter(r => r.id !== id));
  }, []);

  // Hardware Subscription Logic
  const subscribeToHardware = useCallback((leafTempOffset: number) => {
    return hardwareService.onReading((deviceId, reading) => {
      const currentRooms = roomsRef.current;
      const targetRoom = currentRooms.find(r => r.sensorId === deviceId);
      
      if (targetRoom) {
        const metrics = EnvironmentService.processReading(reading, leafTempOffset);
        let status: 'NOMINAL' | 'WARNING' | 'CRITICAL' = 'NOMINAL';
        if (metrics.vpdStatus === VpdZone.DANGER) status = 'CRITICAL';
        else if (metrics.vpdStatus === VpdZone.LEECHING) status = 'WARNING';
        
        const newHistory = [...targetRoom.metrics.history, metrics.vpd].slice(-20);
        const updatedRoom: Room = {
          ...targetRoom,
          metrics: {
            ...targetRoom.metrics,
            temp: reading.temperature,
            rh: reading.humidity,
            co2: reading.co2,
            vpd: metrics.vpd,
            lastUpdated: reading.timestamp,
            status,
            history: newHistory
          }
        };
        updateRoom(updatedRoom);
      }
    });
  }, [updateRoom]);

  return {
    rooms,
    setRooms,
    saveRoom,
    deleteRoom,
    subscribeToHardware
  };
};
