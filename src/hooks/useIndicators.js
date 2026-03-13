/**
 * useIndicators — хук для обновления индикаторов состояния системы
 * (GPS, сеть, батарея, разрешения, уведомления) и определения нахождения на объекте.
 *
 * Использование:
 *   const { indicators, onSite, refreshIndicators } = useIndicators();
 */
import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import Config from 'react-native-config';
import deviceUtils from '../utils/deviceUtils';
import geoService from '../services/geoService';

const DEFAULT_INDICATORS = {
  gps: false,
  network: false,
  battery: true,
  permission: false,
  notifications: true,
};

export function useIndicators() {
  const [indicators, setIndicators] = useState(DEFAULT_INDICATORS);
  const [onSite, setOnSite] = useState(null);

  const refreshIndicators = useCallback(async () => {
    try {
      let permissionOk = false;
      try {
        const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
        if (Platform.OS === 'android') {
          const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
          const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
          permissionOk = (bg === RESULTS.GRANTED) && (fine === RESULTS.GRANTED);
        } else {
          const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
          const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
          permissionOk = (always === RESULTS.GRANTED) && (whenInUse === RESULTS.GRANTED);
        }
      } catch {}

      let batteryOk = true;
      try {
        const { getBatteryWhitelistStatus } = require('../location.js');
        const status = await getBatteryWhitelistStatus();
        batteryOk = Platform.OS !== 'android' ? true : !!status?.ignored;
      } catch {}

      let networkOk = false;
      try {
        const net = await deviceUtils.getNetworkInfo();
        networkOk = !!net?.isConnected;
      } catch {}

      let notificationsOk = true;
      try {
        const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          const notif = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          notificationsOk = notif === RESULTS.GRANTED;
        }
      } catch {}

      let gpsOk = false;
      try {
        gpsOk = await deviceUtils.isLocationAvailable();
      } catch {}

      setIndicators({
        gps: !!gpsOk,
        network: !!networkOk,
        battery: !!batteryOk,
        permission: !!permissionOk,
        notifications: !!notificationsOk,
      });

      // Индикатор "на объекте" (через env: SITE_LAT, SITE_LON, SITE_RADIUS_M)
      try {
        const siteLat = parseFloat(Config.SITE_LAT);
        const siteLon = parseFloat(Config.SITE_LON);
        const siteRadius = parseFloat(Config.SITE_RADIUS_M || '150');
        if (!isNaN(siteLat) && !isNaN(siteLon) && !isNaN(siteRadius)) {
          const loc = await geoService.getCurrentLocation();
          const toRad = (d) => (d * Math.PI) / 180;
          const R = 6371000;
          const dLat = toRad((loc.latitude || 0) - siteLat);
          const dLon = toRad((loc.longitude || 0) - siteLon);
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(siteLat)) * Math.cos(toRad(loc.latitude || 0)) * Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          setOnSite(distance <= siteRadius);
        } else {
          setOnSite(null);
        }
      } catch {
        setOnSite(null);
      }
    } catch {}
  }, []);

  return { indicators, onSite, refreshIndicators };
}
