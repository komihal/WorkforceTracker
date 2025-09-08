import { Platform, Alert, Linking, AppState, InteractionManager } from 'react-native';

let BGGeo = null;
try {
  const BackgroundGeolocation = require('react-native-background-geolocation');
  BGGeo = BackgroundGeolocation.default || BackgroundGeolocation;
} catch {}

let batteryDialogShownAt = 0;
let batteryNavInProgress = false;
let appStateSub = null;

export async function ensureBatteryOptimizationDisabled({ silent = false } = {}) {
  console.log('[Battery] Checking battery optimization status...');
  
  if (Platform.OS !== 'android') {
    console.log('[Battery] Not Android platform, skipping check');
    return true;
  }
  
  if (!BGGeo) {
    console.log('[Battery] BGGeo not available, skipping check');
    return true;
  }

  try {
    console.log('[Battery] Checking if battery optimizations are ignored...');
    const ignored = await BGGeo.deviceSettings.isIgnoringBatteryOptimizations();
    console.log('[Battery] Battery optimizations ignored:', ignored);
    
    if (ignored) {
      console.log('[Battery] Battery optimizations already disabled, no action needed');
      return true;
    }

    if (silent) {
      console.log('[Battery] Silent mode: requesting battery optimization settings');
      try { 
        const request = await BGGeo.deviceSettings.showIgnoreBatteryOptimizations();
        console.log('[Battery] DeviceSettingsRequest received:', request);
        
        // Проверяем, показывали ли уже этот экран пользователю
        if (request.seen) {
          console.log('[Battery] Settings screen already shown to user, skipping');
          return false;
        }
        
        // Сразу открываем настройки
        if (batteryNavInProgress) {
          console.log('[Battery] Navigation to battery settings already in progress, skipping');
          return false;
        }
        try {
          batteryNavInProgress = true;
          // Reset guard when app returns to foreground
          if (!appStateSub) {
            appStateSub = AppState.addEventListener('change', (state) => {
              if (state === 'active') {
                batteryNavInProgress = false;
              }
            });
          }
          await BGGeo.deviceSettings.show(request);
          console.log('[Battery] Battery optimization settings opened successfully');
        } catch (err) {
          console.log('[Battery] Failed to open BGGeo settings:', err?.message || err);
        }
        try { await Linking.openSettings(); } catch {}
      } catch (error) {
        console.log('[Battery] Error opening battery optimization settings:', error.message);
      }
      return false;
    }

    // Debounce UI dialog within 2 minutes
    const now = Date.now();
    if (!silent && now - batteryDialogShownAt < 120000) {
      console.log('[Battery] Battery dialog debounced (<120s), skipping');
      return false;
    }
    console.log('[Battery] Requesting battery optimization settings...');
    try {
      const request = await BGGeo.deviceSettings.showIgnoreBatteryOptimizations();
      console.log('[Battery] DeviceSettingsRequest received:', request);
      
      // Проверяем, показывали ли уже этот экран пользователю
      if (request.seen) {
        console.log('[Battery] Settings screen already shown to user, but showing dialog anyway for testing');
        // Не пропускаем диалог, показываем его всегда для отладки
        // return false;
      }
      
      // Показываем диалог с инструкциями согласно документации Transistorsoft
      const deviceInfo = `Устройство: ${request.manufacturer} ${request.model} @ ${request.version}`;
      const seenInfo = `Показывали ранее? ${request.seen} на ${request.lastSeenAt}`;
      
      return new Promise((resolve) => {
        // Показ диалога после завершения текущих событий UI, чтобы избежать зависаний при возврате из настроек
        InteractionManager.runAfterInteractions(() => {
          try {
            batteryDialogShownAt = Date.now();
            Alert.alert(
              'Настройки оптимизации батареи',
              `Чтобы трекинг работал стабильно в фоне, отключите оптимизацию батареи для приложения.\n\n${deviceInfo}\n${seenInfo}`,
              [
                { text: 'Позже', style: 'cancel', onPress: () => {
                  console.log('[Battery] User chose to skip battery optimization');
                  resolve(false);
                }},
                {
                  text: 'Открыть настройки',
                  onPress: async () => {
                    console.log('[Battery] User chose to open battery optimization settings');
                    if (batteryNavInProgress) {
                      console.log('[Battery] Navigation already in progress, skipping');
                      return resolve(false);
                    }
                    try {
                      batteryNavInProgress = true;
                      if (!appStateSub) {
                        appStateSub = AppState.addEventListener('change', (state) => {
                          if (state === 'active') {
                            batteryNavInProgress = false;
                          }
                        });
                      }
                      await BGGeo.deviceSettings.show(request);
                      console.log('[Battery] Battery optimization settings opened successfully');
                    } catch (error) {
                      console.log('[Battery] Error opening battery optimization settings:', error.message);
                    }
                    try { await Linking.openSettings(); } catch {}
                    resolve(false);
                  },
                },
              ],
              { cancelable: true }
            );
          } catch (error) {
            console.log('[Battery] Error showing alert:', error.message);
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.log('[Battery] Error requesting battery optimization settings:', error.message);
      return false;
    }
  } catch (error) {
    console.log('[Battery] Error checking battery optimization:', error.message);
    return false;
  }
}

export async function openBatteryOptimizationSettings() {
  if (Platform.OS !== 'android' || !BGGeo) return;
  try { 
    const request = await BGGeo.deviceSettings.showIgnoreBatteryOptimizations();
    console.log('[Battery] DeviceSettingsRequest received for manual open:', request);
    await BGGeo.deviceSettings.show(request);
    console.log('[Battery] Battery optimization settings opened manually');
  } catch (error) {
    console.log('[Battery] Error opening battery optimization settings manually:', error.message);
  }
}


