/**
 * usePunchOperation — хук для выполнения punch in / punch out.
 *
 * Объединяет общую логику: проверка статуса → разрешения → селфи → геолокация →
 * загрузка фото + geo → отправка punch → обновление UI / трекинг.
 */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import geoService from '../services/geoService';
import fileUploadService from '../services/fileUploadService';
import deviceUtils from '../utils/deviceUtils';
import backgroundService from '../services/backgroundService';
import { requestBackgroundLocationTwoClicks } from '../services/permissionsService';
import { canStartShift, normalizeStatus, WorkerStatus } from '../helpers/shift';
import { unixSec } from '../utils/dateUtils';

/**
 * @param {Object} deps — зависимости, предоставляемые компонентом:
 *   currentUser, shiftStatusManager, captureSelfie, setIsLoading
 */
export function usePunchOperation({ currentUser, shiftStatusManager, captureSelfie, setIsLoading }) {

  const executePunch = useCallback(async (direction) => {
    const isPunchIn = direction === 'in';
    const statusCode = isPunchIn ? 1 : 0;
    const folder = isPunchIn ? 'start' : 'end';
    const successMsg = isPunchIn ? 'Смена начата!' : 'Смена завершена!';
    const photoRequiredMsg = isPunchIn
      ? 'Для начала смены необходимо сделать фото.'
      : 'Для завершения смены необходимо сделать фото.';
    const permMsg = isPunchIn
      ? 'Для начала смены включите «Разрешать всегда» в настройках.'
      : 'Для завершения смены включите «Разрешать всегда» в настройках.';

    if (!currentUser) {
      Alert.alert('Ошибка', 'Пользователь не найден');
      return;
    }
    if (!shiftStatusManager) {
      Alert.alert('Ошибка', 'Сервис статуса смены не инициализирован');
      return;
    }

    // --- Проверка текущего статуса ---
    try {
      const currentStatus = await shiftStatusManager.getCurrentStatus();
      console.log(`Current status before punch ${direction}:`, currentStatus);

      if (isPunchIn) {
        if (currentStatus.has_active_shift) {
          Alert.alert('Смена уже активна', 'У вас уже есть активная смена');
          return;
        }
        const workerStatus = currentStatus?.worker?.worker_status || currentStatus?.worker_status || 'активен';
        const normalized = normalizeStatus(workerStatus);
        if (normalized === WorkerStatus.BLOCKED) {
          Alert.alert('Доступ заблокирован', 'Ваш пользователь заблокирован администратором. Обратитесь к администратору.');
          return;
        }
        if (normalized === WorkerStatus.FIRED) {
          Alert.alert('Доступ запрещен', 'Ваш пользователь уволен.');
          return;
        }
        if (!canStartShift(normalized)) {
          Alert.alert('Доступ запрещен', 'Ваш статус не позволяет начать смену.');
          return;
        }
      } else {
        if (!currentStatus.has_active_shift) {
          Alert.alert('Нет активной смены', 'У вас нет активной смены для завершения');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking current status:', error);
      Alert.alert('Ошибка', 'Не удалось проверить текущий статус.');
      return;
    }

    // --- Проверка разрешений на геолокацию ---
    try {
      const hasAlways = await requestBackgroundLocationTwoClicks();
      if (!hasAlways) {
        Alert.alert('Фоновая геолокация', permMsg);
        return;
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      Alert.alert('Ошибка разрешений', 'Не удалось проверить/включить фоновую геолокацию.');
      return;
    }

    setIsLoading(true);

    // Pre-start tracking for punch in
    let preStarted = false;
    let ensureTrackingRef = null;
    let stopTrackingRef = null;
    if (isPunchIn) {
      try {
        const loc = require('../location.js');
        ensureTrackingRef = loc.ensureTracking;
        stopTrackingRef = loc.stopTracking;
      } catch {}
      if (currentUser?.user_id && ensureTrackingRef) {
        try {
          await ensureTrackingRef(currentUser.user_id);
          preStarted = true;
        } catch (e) {
          console.log('Pre-start ensureTracking failed:', e?.message || e);
        }
      }
    }

    try {
      // --- Селфи ---
      const selfie = await captureSelfie();
      if (!selfie || !selfie.uri) {
        if (isPunchIn && preStarted && stopTrackingRef) { try { await stopTrackingRef(); } catch {} }
        Alert.alert('Требуется фото', photoRequiredMsg);
        setIsLoading(false);
        return;
      }

      // --- Геолокация + гео-точка ---
      const location = await geoService.getCurrentLocation();
      const altitudeData = geoService.getAccurateAltitudeData(location);
      geoService.addGeoPoint(
        location.latitude,
        location.longitude,
        altitudeData.alt,
        altitudeData.altmsl,
        altitudeData.hasalt,
        altitudeData.hasaltmsl,
        altitudeData.hasaltmslaccuracy,
        altitudeData.mslaccuracyMeters,
      );

      // --- Параллельная загрузка фото + geo, немедленный punch ---
      const tsSec = unixSec();
      const phoneImei = await deviceUtils.getDeviceId();
      const photoName = `punch_${statusCode}_${tsSec}.jpg`;

      const uploadPromise = fileUploadService.uploadShiftPhoto(
        { uri: selfie.uri, type: selfie.type || 'image/jpeg', fileName: photoName },
        currentUser.user_id || 123,
        phoneImei,
        folder,
      ).catch(e => console.log(`Shift ${folder} photo upload exception:`, e?.message || e));

      const saveGeoPromise = geoService.saveGeoData(
        currentUser.user_id || 123,
        1,
        phoneImei,
      ).catch(e => console.log(`saveGeoData (${direction}) error:`, e?.message || e));

      const result = await shiftStatusManager.sendPunch(statusCode, photoName, tsSec);

      if (result.success) {
        Alert.alert('Успех', successMsg);

        // Обновляем UI
        try {
          const { refreshShiftStatusNow } = require('../services/shiftStatusService');
          const updatedStatus = await refreshShiftStatusNow(currentUser.user_id);
          if (shiftStatusManager?.updateUI) {
            shiftStatusManager.updateUI(updatedStatus);
          }
        } catch (e) {
          console.log(`Failed to refresh status after punch ${direction}:`, e?.message || e);
        }

        if (isPunchIn) {
          // Запускаем трекинг и backgroundService
          try {
            const { ensureTracking } = require('../location.js');
            if (currentUser?.user_id) await ensureTracking(currentUser.user_id);
            const imei = await deviceUtils.getDeviceId();
            await backgroundService.initialize(currentUser.user_id, 1, imei, __DEV__);
          } catch (e) {
            console.error('Failed to start tracking on punch in:', e?.message || e);
          }
        } else {
          // Дожидаемся геоданных, затем останавливаем трекинг
          try { await saveGeoPromise; } catch {}
          try {
            const { stopTracking } = require('../location.js');
            await stopTracking();
            console.log('Location tracking stopped on punch out');
          } catch (e) {
            console.error('Failed to stop tracking on punch out:', e?.message || e);
          }
        }
      } else {
        if (isPunchIn && preStarted && stopTrackingRef) { try { await stopTrackingRef(); } catch {} }
        Alert.alert('Ошибка', result.error);
      }

      // Фоновая до-загрузка без блокировки
      Promise.allSettled([uploadPromise, saveGeoPromise]).catch(() => {});
    } catch (error) {
      if (isPunchIn && preStarted && stopTrackingRef) { try { await stopTrackingRef(); } catch {} }
      Alert.alert('Ошибка', isPunchIn ? 'Не удалось начать смену' : 'Не удалось завершить смену');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, shiftStatusManager, captureSelfie, setIsLoading]);

  const handlePunchIn = useCallback(() => executePunch('in'), [executePunch]);
  const handlePunchOut = useCallback(() => executePunch('out'), [executePunch]);

  return { handlePunchIn, handlePunchOut };
}
