import { Platform, Alert, AppState } from 'react-native';
import { check, request, RESULTS, PERMISSIONS, openSettings } from 'react-native-permissions';
import { ensureBatteryOptimizationDisabled } from '../utils/batteryOptimization';

async function ensureIOSAlways() {
  try {
    const alwaysStatus = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (alwaysStatus === RESULTS.GRANTED) {
      return true;
    }

    console.log('Requesting LOCATION_WHEN_IN_USE permission...');
    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (whenInUse !== RESULTS.GRANTED) {
      Alert.alert(
        'Разрешение на геолокацию',
        'Для работы приложения необходимо разрешение на доступ к местоположению. Это позволит отслеживать ваше местоположение во время работы.',
        [
          { text: 'Открыть настройки', onPress: () => openSettings() },
          { text: 'Отмена', style: 'cancel' },
        ],
      );
      return false;
    }

    console.log('Requesting LOCATION_ALWAYS permission...');
    const reqAlways = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (reqAlways === RESULTS.GRANTED) {
      return true;
    }

    Alert.alert(
      'Фоновая геолокация',
      'Для корректной работы приложения необходимо разрешение на фоновую геолокацию. Это позволит приложению отслеживать ваше местоположение даже когда оно закрыто, что важно для точного учета рабочего времени.',
      [
        { text: 'Открыть настройки', onPress: () => openSettings() },
        { text: 'Отмена', style: 'cancel' },
      ],
    );
    return false;
  } catch (e) {
    console.error('ensureIOSAlways error:', e);
    return false;
  }
}

let bgRequestShownThisSession = false;

async function ensureAndroidAlways() {
  try {
    console.log('===== ANDROID PERMISSIONS START =====');
    
    // Сначала проверяем все разрешения без запроса
    const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    console.log('ACCESS_FINE_LOCATION status:', fineStatus);
    
    if (fineStatus !== RESULTS.GRANTED) {
      console.log('Requesting ACCESS_FINE_LOCATION permission...');
      const reqFine = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      console.log('ACCESS_FINE_LOCATION request result:', reqFine);
      
      if (reqFine !== RESULTS.GRANTED) {
        console.log('ACCESS_FINE_LOCATION permission denied, showing alert...');
        Alert.alert(
          'Разрешение на геолокацию',
          'Для работы приложения необходимо разрешение на доступ к местоположению. Это позволит отслеживать ваше местоположение во время работы.',
          [
            { text: 'Открыть настройки', onPress: () => openSettings() },
            { text: 'Отмена', style: 'cancel' },
          ],
        );
        return false;
      }
    } else {
      console.log('ACCESS_FINE_LOCATION already granted');
    }

    // Для Android Q (API 29)+ требуется отдельное разрешение на фон
    const requiresBackground = Platform.Version >= 29;
    console.log('Requires background permission:', requiresBackground, 'Platform.Version:', Platform.Version);
    
    if (!requiresBackground) {
      console.log('Background permission not required for this Android version');
      return true;
    }

    const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    console.log('ACCESS_BACKGROUND_LOCATION status:', bgStatus);
    
    if (bgStatus === RESULTS.GRANTED) {
      console.log('ACCESS_BACKGROUND_LOCATION already granted');
      return true;
    }

    // Если разрешения уже есть, не показываем диалог
    if (fineStatus === RESULTS.GRANTED && bgStatus === RESULTS.GRANTED) {
      console.log('All location permissions already granted');
      return true;
    }

    // Разрешение на фон: только в foreground и не чаще 1 раза за сессию
    if (AppState.currentState !== 'active') {
      console.log('AppState not active; skipping ACCESS_BACKGROUND_LOCATION request');
      return false;
    }
    if (bgRequestShownThisSession) {
      console.log('ACCESS_BACKGROUND_LOCATION request already shown this session; skipping');
      return false;
    }
    console.log('Requesting ACCESS_BACKGROUND_LOCATION permission...');
    const reqBg = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    console.log('ACCESS_BACKGROUND_LOCATION request result:', reqBg);
    
    if (reqBg === RESULTS.GRANTED) {
      console.log('ACCESS_BACKGROUND_LOCATION granted');
      return true;
    }

    console.log('ACCESS_BACKGROUND_LOCATION permission denied or blocked, showing settings prompt...');
    bgRequestShownThisSession = true;
    Alert.alert(
      'Фоновая геолокация',
      'Для корректной работы приложения необходимо разрешение на фоновую геолокацию. Это позволит приложению отслеживать ваше местоположение даже когда оно закрыто, что важно для точного учета рабочего времени.',
      [
        { text: 'Открыть настройки', onPress: () => openSettings() },
        { text: 'Отмена', style: 'cancel' },
      ],
    );
    return false;
  } catch (e) {
    console.error('ensureAndroidAlways error:', e);
    return false;
  }
}

export async function ensureAlwaysLocationPermission() {
  return Platform.OS === 'ios' ? ensureIOSAlways() : ensureAndroidAlways();
}

// Дополнительные разрешения для спортивных/фитнес функций
export async function requestActivityRecognitionPermission() {
  try {
    if (Platform.OS === 'android') {
      const activityStatus = await check(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
      if (activityStatus !== RESULTS.GRANTED) {
        console.log('Requesting ACTIVITY_RECOGNITION permission...');
        const reqActivity = await request(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
        if (reqActivity !== RESULTS.GRANTED) {
          Alert.alert(
            'Разрешение на распознавание активности',
            'Это разрешение позволит приложению определять тип вашей активности (ходьба, бег, вождение) для более точного отслеживания.',
            [
              { text: 'Открыть настройки', onPress: () => openSettings() },
              { text: 'Пропустить', style: 'cancel' },
            ],
          );
          return false;
        }
      }
      return true;
    }
    // iOS не требует отдельного разрешения для ACTIVITY_RECOGNITION
    return true;
  } catch (e) {
    console.error('requestActivityRecognitionPermission error:', e);
    return false;
  }
}

// Запрос всех необходимых разрешений
export async function requestAllPermissions() {
  console.log('===== REQUEST ALL PERMISSIONS START =====');
  console.log('Requesting all necessary permissions...');
  
  console.log('Step 1: Requesting location permission...');
  const locationPermission = await ensureAlwaysLocationPermission();
  if (!locationPermission) {
    console.log('Location permission denied');
    return false;
  }
  console.log('Step 1: Location permission granted');
  
  console.log('Step 2: Requesting activity recognition permission...');
  const activityPermission = await requestActivityRecognitionPermission();
  if (!activityPermission) {
    console.log('Activity recognition permission denied (optional)');
  } else {
    console.log('Step 2: Activity recognition permission granted');
  }
  
  console.log('===== ALL PERMISSIONS REQUESTED SUCCESSFULLY =====');
  return true;
}

// ANDROID 13+ уведомления
export async function ensureNotificationsPermission() {
  try {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;
    const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (status === RESULTS.GRANTED) return true;
    const req = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    return req === RESULTS.GRANTED;
  } catch (e) {
    console.log('ensureNotificationsPermission error:', e?.message || e);
    return false;
  }
}

let sequentialFlowShownThisSession = false;
export async function runSequentialPermissionFlow() {
  try {
    if (sequentialFlowShownThisSession) {
      console.log('[PERM FLOW] Already run this session, skipping.');
      return;
    }
    if (AppState.currentState !== 'active') {
      console.log('[PERM FLOW] AppState not active, skipping.');
      return;
    }
    sequentialFlowShownThisSession = true;

    // 1) Геолокация (Always)
    const locOk = await ensureAlwaysLocationPermission();
    if (!locOk) {
      Alert.alert(
        'Геолокация',
        'Включите «Разрешать всегда» для стабильной работы в фоне.',
        [{ text: 'Открыть настройки', onPress: () => openSettings() }, { text: 'Позже', style: 'cancel' }]
      );
    }

    // 2) Уведомления (Android 13+)
    const notifOk = await ensureNotificationsPermission();
    if (!notifOk) {
      Alert.alert(
        'Уведомления',
        'Разрешите уведомления, чтобы видеть статус трекинга.',
        [{ text: 'Открыть настройки', onPress: () => openSettings() }, { text: 'Позже', style: 'cancel' }]
      );
    }

    // 3) Оптимизация батареи
    try {
      await ensureBatteryOptimizationDisabled({ silent: false });
    } catch {}

    // 4) Мониторинг физ. активности (опционально)
    await requestActivityRecognitionPermission();
  } catch (e) {
    console.log('runSequentialPermissionFlow error:', e?.message || e);
  }
}


