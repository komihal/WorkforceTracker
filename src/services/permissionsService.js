import { Platform, Alert } from 'react-native';
import { check, request, RESULTS, PERMISSIONS, openSettings } from 'react-native-permissions';

async function ensureIOSAlways() {
  try {
    const alwaysStatus = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (alwaysStatus === RESULTS.GRANTED) {
      return true;
    }

    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    if (whenInUse !== RESULTS.GRANTED) {
      return false;
    }

    const reqAlways = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
    if (reqAlways === RESULTS.GRANTED) {
      return true;
    }

    Alert.alert(
      'Нужно «Геолокация: Всегда»',
      'Откройте настройки и установите «Всегда».',
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
    // Сначала проверяем When-in-use и запрашиваем только при отсутствии
    const fineStatus = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (fineStatus !== RESULTS.GRANTED) {
      const reqFine = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      if (reqFine !== RESULTS.GRANTED) {
        return false;
      }
    }

    // Для Android Q (API 29)+ требуется отдельное разрешение на фон
    const requiresBackground = Platform.Version >= 29;
    if (!requiresBackground) {
      return true;
    }

    const bgStatus = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (bgStatus === RESULTS.GRANTED) {
      return true;
    }

    const reqBg = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    if (reqBg === RESULTS.GRANTED) {
      return true;
    }

    Alert.alert(
      'Нужно «Геолокация: Всегда»',
      'Включите фоновую геолокацию в настройках приложения.',
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


