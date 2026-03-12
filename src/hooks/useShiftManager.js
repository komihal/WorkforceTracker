/**
 * useShiftManager — хук для управления состоянием смены.
 * Инкапсулирует инициализацию ShiftStatusManager, callback обновления UI
 * и синхронизацию с shiftStore.
 *
 * Использование:
 *   const { shiftStatusManager, userStatus, shiftStart, lastRequestAt, shiftDuration } = useShiftManager(currentUser);
 */
import { useState, useRef, useCallback } from 'react';
import ShiftStatusManager from '../services/shiftStatusService';
import { setFromServer } from '../store/shiftStore';
import { normalizeStatus, WorkerStatus } from '../helpers/shift';
import deviceUtils from '../utils/deviceUtils';

export function useShiftManager(currentUser) {
  const [shiftStatusManager, setShiftStatusManager] = useState(null);
  const [userStatus, setUserStatus] = useState(WorkerStatus.READY_TO_WORK);
  const [shiftStart, setShiftStart] = useState(null);
  const [lastRequestAt, setLastRequestAt] = useState(null);
  const [shiftDuration, setShiftDuration] = useState(null);

  const onStatusUpdate = useCallback(async (data) => {
    try { setFromServer(data); } catch {}

    const hasActiveShift = data.has_active_shift || false;
    const workerStatus = data?.worker?.worker_status || data?.worker_status || 'активен';

    try {
      const activeStart = data?.active_shift?.shift_start || null;
      const lastStart = data?.last_shift?.shift_start || null;
      const s = hasActiveShift ? activeStart : (activeStart || lastStart);
      setShiftStart(s || null);
    } catch {}

    try {
      const lrServer = data?.worker?.last_geo_timestamp || data?.last_request || null;
      setLastRequestAt(lrServer || null);
    } catch {}

    try {
      const startTime = hasActiveShift ? (data?.active_shift?.shift_start || null) : null;
      const lastTime = data?.worker?.last_geo_timestamp || data?.last_request || null;
      if (startTime && lastTime) {
        const start = new Date(startTime).getTime();
        const last = new Date(lastTime).getTime();
        if (!isNaN(start) && !isNaN(last) && last > start) {
          setShiftDuration((last - start) / (1000 * 60 * 60));
        } else {
          setShiftDuration(null);
        }
      } else {
        setShiftDuration(null);
      }
    } catch {}

    setUserStatus(normalizeStatus(workerStatus));

    try {
      const { ensureTracking, stopTracking } = require('../location.js');
      if (hasActiveShift) {
        const userId = currentUser?.user_id || data.worker?.user_id;
        if (userId) await ensureTracking(userId);
      } else {
        await stopTracking();
      }
    } catch {}
  }, [currentUser]);

  const initManager = useCallback(async (user) => {
    const deviceId = await deviceUtils.getDeviceId();
    const manager = new ShiftStatusManager(user.user_id || 123, deviceId);
    manager.setStatusUpdateCallback(onStatusUpdate);

    try {
      const initialStatus = await manager.getCurrentStatus();
      manager.updateUI(initialStatus);
    } catch {}

    setShiftStatusManager(manager);
    return manager;
  }, [onStatusUpdate]);

  return {
    shiftStatusManager,
    userStatus,
    shiftStart,
    lastRequestAt,
    shiftDuration,
    initManager,
  };
}
