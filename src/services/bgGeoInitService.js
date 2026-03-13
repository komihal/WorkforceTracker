/**
 * bgGeoInitService — синглтон для идемпотентной инициализации BGGeo и трекинга.
 * Все вызовы initBgGeo / startTracking / backgroundService.initialize
 * должны проходить через этот модуль, чтобы избежать многократного запуска.
 */
import { initBgGeo, startTracking } from '../location';
import backgroundService from './backgroundService';
import deviceUtils from '../utils/deviceUtils';

let initPromise = null;
let lastInitUserId = null;

/**
 * Инициализирует BGGeo + backgroundService один раз для данного userId.
 * Повторные вызовы с тем же userId возвращают существующий промис.
 */
export async function initBgGeoForUser(userId) {
  if (initPromise && lastInitUserId === userId) {
    return initPromise;
  }
  lastInitUserId = userId;
  initPromise = _doInit(userId);
  try {
    return await initPromise;
  } catch (e) {
    // Сброс, чтобы следующий вызов мог повторить попытку
    initPromise = null;
    lastInitUserId = null;
    throw e;
  }
}

async function _doInit(userId) {
  console.log('[bgGeoInit] Initializing for user:', userId);
  await initBgGeo();
  await startTracking(userId);
  const phoneImei = await deviceUtils.getDeviceId();
  await backgroundService.initialize(userId, 1, phoneImei, __DEV__);
  console.log('[bgGeoInit] Initialization complete');
}

/**
 * Сбрасывает состояние (для logout).
 */
export function resetBgGeoInit() {
  initPromise = null;
  lastInitUserId = null;
}
