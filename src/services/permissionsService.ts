import { PermissionsAndroid, Platform } from 'react-native';

export async function requestAllPermissions() {
  if (Platform.OS !== 'android') return true;

  // Android 10+ — детекция активности помогает надёжно входить в режим движения
  if (Platform.Version >= 29) {
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[perm] ACTIVITY_RECOGNITION denied');
      } else {
        console.log('[perm] ACTIVITY_RECOGNITION granted');
      }
    } catch (e) {
      console.warn('[perm] ACTIVITY_RECOGNITION error', e);
    }
  }

  // Запрашиваем разрешения на геолокацию
  try {
    const fineLocation = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    
    if (fineLocation !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('[perm] ACCESS_FINE_LOCATION denied');
      return false;
    }

    // Запрашиваем фоновую геолокацию для Android 10+
    if (Platform.Version >= 29) {
      const backgroundLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
      );
      
      if (backgroundLocation !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('[perm] ACCESS_BACKGROUND_LOCATION denied');
        return false;
      }
    }

    console.log('[perm] All location permissions granted');
    return true;
  } catch (error) {
    console.error('[perm] Error requesting permissions:', error);
    return false;
  }
}

export async function checkPermissions() {
  if (Platform.OS !== 'android') return true;

  try {
    const fineLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    
    const backgroundLocation = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );

    const activityRecognition = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION
    );

    return {
      fineLocation,
      backgroundLocation,
      activityRecognition,
      allGranted: fineLocation && backgroundLocation && activityRecognition
    };
  } catch (error) {
    console.error('[perm] Error checking permissions:', error);
    return {
      fineLocation: false,
      backgroundLocation: false,
      activityRecognition: false,
      allGranted: false
    };
  }
}
