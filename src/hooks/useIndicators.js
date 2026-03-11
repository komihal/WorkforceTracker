/**
 * useIndicators — хук для обновления индикаторов состояния системы
 * (GPS, сеть, батарея, разрешения, уведомления).
 *
 * Использование:
 *   const { indicators, refreshIndicators } = useIndicators();
 */
import { useState, useCallback } from 'react';
import { Platform } from 'react-native';

const DEFAULT_INDICATORS = {
  gps: false,
  network: false,
  battery: true,
  permission: false,
  notifications: true,
};

export function useIndicators() {
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);

  const refreshIndicators = useCallback(async () => {
    try {
      const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
      let hasLocationPermission = false;
      let hasBackgroundPermission = false;
      let hasNotificationPermission = true;
      let hasBatteryOptimization = true;

      if (Platform.OS === 'android') {
        const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
        hasLocationPermission = fine === RESULTS.GRANTED;
        hasBackgroundPermission = bg === RESULTS.GRANTED;

        if (Platform.Version >= 33) {
          const notif = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          hasNotificationPermission = notif === RESULTS.GRANTED;
        }

        try {
          const { getBatteryWhitelistStatus } = require('../location.js');
          const status = await getBatteryWhitelistStatus();
          hasBatteryOptimization = !!status?.ignored;
        } catch {}
      } else {
        const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
        hasLocationPermission = whenInUse === RESULTS.GRANTED;
        hasBackgroundPermission = always === RESULTS.GRANTED;
      }

      setIndicators({
        gps: hasLocationPermission,
        network: true,
        battery: hasBatteryOptimization,
        permission: hasBackgroundPermission,
        notifications: hasNotificationPermission,
      });
    } catch {}
  }, []);

  return { indicators, refreshIndicators, setIndicators };
}
