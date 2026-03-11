import { Platform, AppState } from 'react-native';
import { check, request, RESULTS, PERMISSIONS, openSettings } from 'react-native-permissions';
import { ensureBatteryOptimizationDisabled } from '../utils/batteryOptimization';
import { showPermissionAlert } from '../utils/permissionAlert';

let bgRequestShownThisSession = false;
let locationPermissionRequestInProgress = false;

export function resetBackgroundPermissionDialog() {
  bgRequestShownThisSession = false;
  locationPermissionRequestInProgress = false;
}

let appStateListener = null;

export function initAppStateListener() {
  if (appStateListener) return;

  appStateListener = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      bgRequestShownThisSession = false;
      locationPermissionRequestInProgress = false;
      setTimeout(() => {
        checkNotificationsPermissionOnAppActive();
      }, 1000);
    }
  });
}

export function cleanupAppStateListener() {
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }
}

export async function checkNotificationsPermissionOnAppActive() {
  try {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;

    const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (status === RESULTS.GRANTED) return true;

    const req = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (req === RESULTS.GRANTED) return true;

    showPermissionAlert(
      'Уведомления',
      'Для корректной работы приложения необходимо разрешение на уведомления. Это позволит видеть статус трекинга и получать важные уведомления о работе.',
    );
    return false;
  } catch (e) {
    console.error('[NOTIF CHECK] checkNotificationsPermissionOnAppActive error:', e);
    return false;
  }
}

export async function forceShowBackgroundPermissionDialog() {
  if (Platform.OS !== 'android') return false;

  try {
    resetBackgroundPermissionDialog();
    const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (bgStatus === RESULTS.GRANTED) return true;

    const reqBg = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (reqBg === RESULTS.GRANTED) return true;

    showPermissionAlert(
      'Фоновая геолокация',
      'Для корректной работы приложения необходимо разрешение на фоновую геолокацию. Это позволит приложению отслеживать ваше местоположение даже когда оно закрыто, что важно для точного учета рабочего времени.',
      'Отмена',
    );
    return false;
  } catch (e) {
    console.error('forceShowBackgroundPermissionDialog error:', e);
    return false;
  }
}

export async function requestBackgroundLocationTwoClicks() {
  if (Platform.OS !== 'android') return true;

  try {
    const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fineStatus !== RESULTS.GRANTED) {
      const reqFine = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      if (reqFine !== RESULTS.GRANTED) {
        showPermissionAlert(
          'Геолокация',
          'Нужно разрешить доступ к местоположению. Откройте настройки и включите доступ.',
          'Отмена',
        );
        return false;
      }
    }

    if (Platform.Version >= 29) {
      const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      if (bgStatus === RESULTS.GRANTED) return true;

      const reqBg = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
      if (reqBg === RESULTS.GRANTED) return true;

      showPermissionAlert(
        'Фоновая геолокация',
        'Откройте: Разрешения → Местоположение → Разрешать всегда. Это нужно для точного учёта смены.',
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error('requestBackgroundLocationTwoClicks error:', e);
    try { openSettings(); } catch {}
    return false;
  }
}

async function ensureIOSAlways() {
  try {
    if (locationPermissionRequestInProgress) return false;
    locationPermissionRequestInProgress = true;

    const alwaysStatus = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (alwaysStatus === RESULTS.GRANTED) return true;

    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (whenInUse !== RESULTS.GRANTED) {
      showPermissionAlert(
        'Разрешение на геолокацию',
        'Для работы приложения необходимо разрешение на доступ к местоположению. Это позволит отслеживать ваше местоположение во время работы.',
        'Отмена',
      );
      return false;
    }

    const reqAlways = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (reqAlways === RESULTS.GRANTED) return true;

    showPermissionAlert(
      'Фоновая геолокация',
      'Для корректной работы приложения необходимо разрешение на фоновую геолокацию. Это позволит приложению отслеживать ваше местоположение даже когда оно закрыто, что важно для точного учета рабочего времени.',
      'Отмена',
    );
    return false;
  } catch (e) {
    console.error('ensureIOSAlways error:', e);
    return false;
  } finally {
    locationPermissionRequestInProgress = false;
  }
}

async function ensureAndroidAlways() {
  try {
    if (locationPermissionRequestInProgress) return false;
    locationPermissionRequestInProgress = true;

    const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fineStatus !== RESULTS.GRANTED) {
      const reqFine = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      if (reqFine !== RESULTS.GRANTED) {
        showPermissionAlert(
          'Разрешение на геолокацию',
          'Для работы приложения необходимо разрешение на доступ к местоположению. Это позволит отслеживать ваше местоположение во время работы.',
          'Отмена',
        );
        return false;
      }
    }

    if (Platform.Version < 29) return true;

    const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (bgStatus === RESULTS.GRANTED) return true;

    if (AppState.currentState !== 'active') return false;
    if (bgRequestShownThisSession) return false;

    const reqBg = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (reqBg === RESULTS.GRANTED) return true;

    bgRequestShownThisSession = true;
    showPermissionAlert(
      'Фоновая геолокация',
      'Для корректной работы приложения необходимо разрешение на фоновую геолокацию. Это позволит приложению отслеживать ваше местоположение даже когда оно закрыто, что важно для точного учета рабочего времени.',
      'Отмена',
    );
    return false;
  } catch (e) {
    console.error('ensureAndroidAlways error:', e);
    return false;
  } finally {
    locationPermissionRequestInProgress = false;
  }
}

export async function ensureAlwaysLocationPermission() {
  return Platform.OS === 'ios' ? ensureIOSAlways() : ensureAndroidAlways();
}

export async function requestActivityRecognitionPermission() {
  try {
    if (Platform.OS === 'android') {
      const activityStatus = await check(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
      if (activityStatus !== RESULTS.GRANTED) {
        const reqActivity = await request(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
        if (reqActivity !== RESULTS.GRANTED) {
          showPermissionAlert(
            'Разрешение на распознавание активности',
            'Это разрешение позволит приложению определять тип вашей активности (ходьба, бег, вождение) для более точного отслеживания.',
            'Пропустить',
          );
          return false;
        }
      }
      return true;
    }
    return true;
  } catch (e) {
    console.error('requestActivityRecognitionPermission error:', e);
    return false;
  }
}

export async function requestAllPermissions() {
  const locationPermission = await ensureAlwaysLocationPermission();
  if (!locationPermission) return false;

  await requestActivityRecognitionPermission();
  return true;
}

export async function ensureNotificationsPermission() {
  try {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;
    const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (status === RESULTS.GRANTED) return true;
    const req = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    return req === RESULTS.GRANTED;
  } catch (e) {
    console.warn('ensureNotificationsPermission error:', e?.message || e);
    return false;
  }
}

let sequentialFlowShownThisSession = false;

export async function runSequentialPermissionFlow() {
  try {
    if (sequentialFlowShownThisSession) return;
    if (AppState.currentState !== 'active') return;
    sequentialFlowShownThisSession = true;

    const locOk = await ensureAlwaysLocationPermission();
    if (!locOk) {
      showPermissionAlert(
        'Геолокация',
        'Включите «Разрешать всегда» для стабильной работы в фоне.',
      );
    }

    const notifOk = await ensureNotificationsPermission();
    if (!notifOk) {
      showPermissionAlert(
        'Уведомления',
        'Разрешите уведомления, чтобы видеть статус трекинга.',
      );
    }

    try {
      await ensureBatteryOptimizationDisabled({ silent: false });
    } catch {}

    await requestActivityRecognitionPermission();
  } catch (e) {
    console.warn('runSequentialPermissionFlow error:', e?.message || e);
  }
}
