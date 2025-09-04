import { Platform, Alert } from 'react-native';
import { check, request, RESULTS, PERMISSIONS, openSettings } from 'react-native-permissions';

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

async function ensureAndroidAlways() {
  try {
    console.log('===== ANDROID PERMISSIONS START =====');
    // Сначала проверяем When-in-use и запрашиваем только при отсутствии
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

    console.log('Requesting ACCESS_BACKGROUND_LOCATION permission...');
    const reqBg = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    console.log('ACCESS_BACKGROUND_LOCATION request result:', reqBg);
    
    if (reqBg === RESULTS.GRANTED) {
      console.log('ACCESS_BACKGROUND_LOCATION granted');
      return true;
    }

    console.log('ACCESS_BACKGROUND_LOCATION permission denied, showing alert...');
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


