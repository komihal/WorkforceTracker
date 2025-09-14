import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Platform,
  AppState,
  Button,
  NativeModules,
  Linking,
  Modal,
} from 'react-native';
import { StatusBar } from 'react-native';
import authService from '../services/authService';
import Config from 'react-native-config';
import { postLocationBatch } from '../api';
import punchService from '../services/punchService';
import geoService from '../services/geoService';
import backgroundService from '../services/backgroundService';
import cameraService from '../services/cameraService';
import fileUploadService from '../services/fileUploadService';
import deviceUtils from '../utils/deviceUtils';
import { ensureAlwaysLocationPermission, runSequentialPermissionFlow, forceShowBackgroundPermissionDialog, checkNotificationsPermissionOnAppActive, requestBackgroundLocationTwoClicks } from '../services/permissionsService';
import { canStartShift, humanizeStatus, normalizeStatus, WorkerStatus } from '../helpers/shift';
import ShiftStatusManager from '../services/shiftStatusService';
// import { initLocation } from '../location'; // Отключено - инициализация происходит в App.js
// geo endpoint/test toggles removed
// DebugBgScreen and BgGeoTestScreen removed - no longer needed
import { useShiftStore, setFromServer } from '../store/shiftStore';
import { guardedAlert } from '../ui/alert';

const MainScreen = ({ onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showAlwaysBanner, setShowAlwaysBanner] = useState(false);
  const isShiftActive = useShiftStore(s => s.isActive);
  const [currentUser, setCurrentUser] = useState(null);
  const [userStatus, setUserStatus] = useState(WorkerStatus.READY_TO_WORK);
  const currentUserIdRef = useRef(null);
  // endpoint & test toggles removed
  const [shiftStatusManager, setShiftStatusManager] = useState(null);
  const [indicators, setIndicators] = useState({ gps: false, network: false, battery: true, permission: false, notifications: true });
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [shiftStart, setShiftStart] = useState(null);
  const [lastRequestAt, setLastRequestAt] = useState(null);
  const [onSite, setOnSite] = useState(null);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [selectedAccessKey, setSelectedAccessKey] = useState(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [monthlyRecorded, setMonthlyRecorded] = useState(null);
  const [monthlyApproved, setMonthlyApproved] = useState(null);
  const [monthlyApprovedHours, setMonthlyApprovedHours] = useState(null);
  const [monthlyAppCount, setMonthlyAppCount] = useState(null);
  const [monthlySuspicious, setMonthlySuspicious] = useState(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [showHeaderBadges, setShowHeaderBadges] = useState(false);
  // Селфи-модал отключен, используем image-picker

  const captureSelfie = async () => {
    try {
      let photoResult = await cameraService.takePhoto({ cameraType: 'front' });
      if (!photoResult.success && __DEV__) {
        const galleryResult = await cameraService.selectPhoto();
        if (galleryResult.success) photoResult = galleryResult;
      }
      if (photoResult.success) {
        return {
          uri: photoResult.data?.uri,
          type: photoResult.data?.type || 'image/jpeg',
          fileName: photoResult.data?.fileName || `selfie_${Date.now()}.jpg`,
        };
      }
      return null;
    } catch {
      return null;
    }
  };
  
  // Guards для предотвращения повторных вызовов
  const batteryOptimizationRequested = useRef(false);
  const locationPermissionsRequested = useRef(false);

  useEffect(() => {
    const loadUserData = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('Loaded currentUser:', user);
        setCurrentUser(user);
        currentUserIdRef.current = user.user_id;
        
        // Инициализируем ShiftStatusManager
        const deviceId = await deviceUtils.getDeviceId();
        
        // ВРЕМЕННО ОТКЛЮЧАЕМ ShiftStatusManager для стабилизации
        const { DISABLE_POLLING, disabledShiftStatusManager } = require('../../disable_polling_websockets');
        const manager = DISABLE_POLLING ? disabledShiftStatusManager : new ShiftStatusManager(user.user_id || 123, deviceId);
        
        // Принудительно сбрасываем BGGeo конфигурацию для исправления locationTemplate
        try {
          const { forceResetBGGeo, checkBGGeoConfig } = require('../../force_reset_bggeo');
          console.log('🔄 Проверяем конфигурацию BGGeo...');
          const config = await checkBGGeoConfig();
          if (config.hasMathFloor) {
            console.log('🔧 Обнаружена старая конфигурация, выполняем сброс...');
            await forceResetBGGeo();
          }
        } catch (e) {
          console.log('❌ Ошибка сброса BGGeo:', e);
        }
        
        // Устанавливаем callback для обновления UI
        manager.setStatusUpdateCallback(async (data) => {
          console.log('=== SHIFT STATUS UPDATE ===');
          console.log('Received data:', data);
          try { setFromServer(data); } catch {}
          
          const hasActiveShift = data.has_active_shift || false;
          const workerStatus = (data?.worker?.worker_status) || data?.worker_status || 'активен';

          // Вытаскиваем начало смены и "последний запрос" (если сервер вернул)
          try {
            const activeStart = data?.active_shift?.shift_start || null;
            const lastStart = data?.last_shift?.shift_start || null;
            const s = hasActiveShift ? activeStart : (activeStart || lastStart);
            setShiftStart(s || null);
          } catch {}
          try {
            // Последний запрос к /api/db_save/ — берём время последнего локального успешного аплоада, fallback к серверному
            // const lrLocal = global?.__LAST_DB_SAVE_AT__ || null;
            const lrServer = data?.worker?.last_geo_timestamp || data?.last_request || null;
            // setLastRequestAt(lrLocal || lrServer || null);
             setLastRequestAt(lrServer || null);
          } catch {}
          
          setUserStatus(normalizeStatus(workerStatus));
          
          console.log('Updated state:', {
            isShiftActive: hasActiveShift,
            userStatus: workerStatus,
            activeShiftId: data?.active_shift?.id || data?.active_shift?.shift_id || null,
            sourceOfTruth: 'server'
          });
          
          // Автоматически запускаем/останавливаем отслеживание геолокации
          try {
            const { ensureTracking, stopTracking } = require('../location.js');
            if (hasActiveShift) {
              // Используем user_id из данных смены, если currentUser еще не загружен
              const userId = currentUser?.user_id || data.worker?.user_id;
              if (userId) {
                await ensureTracking(userId);
                console.log('Auto-start tracking based on active shift for user:', userId);
              } else {
                console.log('Cannot start tracking: user_id is not available in currentUser or shift data');
              }
            } else {
              await stopTracking();
              console.log('Auto-stop tracking based on inactive shift');
            }
          } catch (e) {
            console.log('Tracking sync with shift status failed:', e?.message || e);
          }
        });
        
        setShiftStatusManager(manager);
      }
    };
    
    const requestLocationPermissions = async () => {
      if (locationPermissionsRequested.current) {
        console.log('Location permissions already requested, skipping...');
        return;
      }
      
      try {
        console.log('Requesting background location permission...');
        locationPermissionsRequested.current = true;
        const hasAlways = await ensureAlwaysLocationPermission();
        if (hasAlways) {
          console.log('Background location permission granted');
        } else {
          console.log('Background location permission denied');
        }
      } catch (error) {
        console.error('Error requesting location permissions:', error);
        locationPermissionsRequested.current = false; // Reset on error
      }
    };
    
    loadUserData();
    // endpoint/test toggles removed
    requestLocationPermissions();
    // Запускаем последовательный flow при первом входе в экран (foreground-only)
    setTimeout(() => { runSequentialPermissionFlow(); }, 600);
    
    // Автоматически запрашиваем отключение оптимизации батареи (только один раз)
    if (!batteryOptimizationRequested.current) {
      requestBatteryOptimization();
    }

    // Инициализация геолокации отключена - происходит только при входе в приложение
    console.log('Location initialization disabled in MainScreen - handled by App.js on login');
    
    // Отслеживаем AppState для баннера Always + fast refresh с мьютексом
    let _refreshInflight = false;
    const safeRefresh = async (uid, reqId) => {
      if (_refreshInflight) {
        console.log('[Shift] safeRefresh: skip (inflight), reqId=', reqId);
        return;
      }
      _refreshInflight = true;
      try {
        console.log('[Shift] safeRefresh start, reqId=', reqId);
        const { refreshShiftStatusNow } = require('../services/shiftStatusService');
        await refreshShiftStatusNow(uid);
        console.log('[Shift] safeRefresh done, reqId=', reqId);
      } catch (e) {
        console.log('[Shift] safeRefresh failed, reqId=', reqId, e?.message || e);
      } finally {
        _refreshInflight = false;
      }
    };

    const sub = AppState.addEventListener('change', async (state) => {
      console.log('[AppState] MainScreen ->', state);
      if (state === 'active') {
        let uid = currentUserIdRef.current;
        if (!uid) {
          try {
            uid = (await authService.getCurrentUser())?.user_id;
            if (uid) currentUserIdRef.current = uid;
          } catch {}
        }
        if (uid) {
          const reqId = Math.random().toString(36).slice(2, 8);
          await safeRefresh(uid, reqId);
        }
        if (Platform.OS === 'android') {
          try {
            const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
            const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
            setShowAlwaysBanner(bg !== RESULTS.GRANTED);
          } catch {}
        }
      }
    });

    // Cleanup при размонтировании компонента
    return () => {
      if (shiftStatusManager) {
        shiftStatusManager.disconnect();
      }
      sub.remove();
    };
  }, []); // Убираем shiftStatusManager из зависимостей, чтобы избежать бесконечного цикла

  // Индикаторы: GPS / сеть / энергосбережение / разрешения
  const refreshIndicators = useCallback(async () => {
    try {
      let permissionOk = false;
      try {
        const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
        if (Platform.OS === 'android') {
          const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
          const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
          permissionOk = (bg === RESULTS.GRANTED) || (fine === RESULTS.GRANTED);
        } else {
          const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
          const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
          permissionOk = (always === RESULTS.GRANTED) || (whenInUse === RESULTS.GRANTED);
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
        } else {
          notificationsOk = true;
        }
      } catch {}

      let gpsOk = false;
      try {
        gpsOk = await deviceUtils.isLocationAvailable();
      } catch {}

      setIndicators({ gps: !!gpsOk, network: !!networkOk, battery: !!batteryOk, permission: !!permissionOk, notifications: !!notificationsOk });

      // Индикатор "на объекте" (заглушка через env: SITE_LAT, SITE_LON, SITE_RADIUS_M)
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
    } catch (e) {
      // fail-safe: не обновляем state при исключениях
    }
  }, []);

  useEffect(() => {
    // первичное обновление и периодический опрос
    refreshIndicators();
    const timer = setInterval(refreshIndicators, 10000);
    return () => clearInterval(timer);
  }, [refreshIndicators]);

  // Проверка статуса работника и смены
  // Функция checkWorkerStatus удалена - теперь используется ShiftStatusManager

  // Начало смены
  const handlePunchIn = async () => {
    if (!currentUser) {
      Alert.alert('Ошибка', 'Пользователь не найден');
      return;
    }

    if (!shiftStatusManager) {
      Alert.alert('Ошибка', 'Сервис статуса смены не инициализирован');
      return;
    }

    // Устанавливаем состояние загрузки в самом начале
    setIsLoading(true);

    // Проверяем текущий статус через новый сервис
    try {
      const currentStatus = await shiftStatusManager.getCurrentStatus();
      console.log('Current status before punch in:', currentStatus);
      
      if (currentStatus.has_active_shift) {
        Alert.alert('Смена уже активна', 'У вас уже есть активная смена');
        setIsLoading(false);
        return;
      }
      
      // Проверяем статус рабочего
      const workerStatus = (currentStatus?.worker?.worker_status) || currentStatus?.worker_status || 'активен';
      const normalized = normalizeStatus(workerStatus);
      
      if (normalized === WorkerStatus.BLOCKED) {
        Alert.alert('Доступ заблокирован', 'Ваш пользователь заблокирован администратором. Обратитесь к администратору.');
        setIsLoading(false);
        return;
      }
      
      if (normalized === WorkerStatus.FIRED) {
        Alert.alert('Доступ запрещен', 'Ваш пользователь уволен.');
        setIsLoading(false);
        return;
      }
      
      if (!canStartShift(normalized)) {
        Alert.alert('Доступ запрещен', 'Ваш статус не позволяет начать смену.');
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking current status:', error);
      Alert.alert('Ошибка', 'Не удалось проверить текущий статус.');
      setIsLoading(false);
      return;
    }

    // Затем проверяем разрешения на геолокацию (быстрый поток в 2 клика)
    try {
      const hasAlways = await requestBackgroundLocationTwoClicks();
      if (!hasAlways) {
        Alert.alert('Фоновая геолокация', 'Для начала смены включите «Разрешать всегда» в настройках.');
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      Alert.alert('Ошибка разрешений', 'Не удалось проверить/включить фоновую геолокацию.');
      setIsLoading(false);
      return;
    }

    // Предстарт: поднимаем трекинг перед отправкой punch, чтобы иметь активный FG-сервис
    let preStarted = false;
    let ensureTrackingRef = null;
    let stopTrackingRef = null;
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

    try {
      // Селфи через VisionCamera
      const selfie = await captureSelfie();
      if (!selfie || !selfie.uri) {
        if (preStarted && stopTrackingRef) { try { await stopTrackingRef(); } catch {} }
        Alert.alert('Требуется фото', 'Для начала смены необходимо сделать фото.');
        setIsLoading(false);
        return;
      }

      // Получаем текущую геолокацию
      const location = await geoService.getCurrentLocation();

      // Добавляем геопозицию с правильным порядком параметров
      console.log('Adding geo point for punch in:', location);
      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        location.altitude || 0,  // alt
        (typeof location.altitude_msl === 'number' ? location.altitude_msl : (location.altitude || 0)),  // altMsl
        true,                 // hasAlt
        true,                 // hasAltMsl
        false,                // hasAltMslAccuracy
        1.5                   // mslAccuracyMeters
      );
      console.log('Added geo point for punch in:', geoPoint);

      // Параллелим загрузку фото и сохранение геоданных, punch отправляем сразу
      const tsSec = Math.floor(Date.now() / 1000);
      const phoneImeiIn = await deviceUtils.getDeviceId();
      const photoNameIn = `punch_1_${tsSec}.jpg`;

      const uploadInPromise = fileUploadService.uploadShiftPhoto(
        {
          uri: selfie.uri,
          type: selfie.type || 'image/jpeg',
          fileName: photoNameIn,
        },
        currentUser.user_id || 123,
        phoneImeiIn,
        'start'
      ).then((res) => {
        if (!res?.success) {
          console.log('Shift start photo upload failed:', res?.error || res);
        }
        return res;
      }).catch((e) => {
        console.log('Shift start photo upload exception:', e?.message || e);
      });

      const saveGeoInPromise = geoService.saveGeoData(
        currentUser.user_id || 123,
        1,
        phoneImeiIn
      ).catch((e) => console.log('saveGeoData (in) error:', e?.message || e));

      // Отправляем punch немедленно с синхронизированным именем фото и timestamp
      const result = await shiftStatusManager.sendPunch(1, photoNameIn, tsSec); // 1 = начало смены

      if (result.success) {
        Alert.alert('Успех', 'Смена начата!');
        
        // Запускаем отслеживание геолокации при начале смены
        try {
          const { ensureTracking } = require('../location.js');
          if (currentUser?.user_id) {
            await ensureTracking(currentUser.user_id);
            console.log('Location tracking started on punch in for user:', currentUser.user_id);
          } else {
            console.log('Cannot start tracking on punch in: currentUser.user_id is not available');
          }
          
          // Инициализируем backgroundService для фоновой отправки
          console.log('Initializing backgroundService for punch in...');
          const phoneImei = await deviceUtils.getDeviceId();
          await backgroundService.initialize(currentUser.user_id, 1, phoneImei, __DEV__);
          console.log('BackgroundService initialized for punch in');
        } catch (e) {
          console.error('Failed to start tracking on punch in:', e?.message || e);
        }
      } else {
        if (preStarted && stopTrackingRef) { try { await stopTrackingRef(); } catch {} }
        Alert.alert('Ошибка', result.error);
      }

      // Не блокируем UI ожиданием — фоновые операции сами завершатся
      Promise.allSettled([uploadInPromise, saveGeoInPromise]).then(() => {}).catch(() => {});
    } catch (error) {
      if (preStarted && stopTrackingRef) { try { await stopTrackingRef(); } catch {} }
      Alert.alert('Ошибка', 'Не удалось начать смену');
    } finally {
      setIsLoading(false);
    }
  };

  // Завершение смены
  const handlePunchOut = async () => {
    if (!currentUser) {
      Alert.alert('Ошибка', 'Пользователь не найден');
      return;
    }

    if (!shiftStatusManager) {
      Alert.alert('Ошибка', 'Сервис статуса смены не инициализирован');
      return;
    }

    // Проверяем текущий статус через новый сервис
    try {
      const currentStatus = await shiftStatusManager.getCurrentStatus();
      console.log('Current status before punch out:', currentStatus);
      
      if (!currentStatus.has_active_shift) {
        Alert.alert('Нет активной смены', 'У вас нет активной смены для завершения');
        return;
      }
    } catch (error) {
      console.error('Error checking current status:', error);
      Alert.alert('Ошибка', 'Не удалось проверить текущий статус.');
      return;
    }

    // Затем проверяем разрешения на геолокацию (быстрый поток в 2 клика)
    try {
      const hasAlways = await requestBackgroundLocationTwoClicks();
      if (!hasAlways) {
        Alert.alert('Фоновая геолокация', 'Для завершения смены включите «Разрешать всегда» в настройках.');
        return;
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      Alert.alert('Ошибка разрешений', 'Не удалось проверить/включить фоновую геолокацию.');
      return;
    }

    setIsLoading(true);
    try {
      // Селфи через VisionCamera
      const selfie = await captureSelfie();
      if (!selfie || !selfie.uri) {
        Alert.alert('Требуется фото', 'Для завершения смены необходимо сделать фото.');
        setIsLoading(false);
        return;
      }

      // Получаем текущую геолокацию
      const location = await geoService.getCurrentLocation();

      // Добавляем финальную геопозицию с правильным порядком параметров
      console.log('Adding geo point for punch out:', location);
      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        location.altitude || 0,  // alt
        (typeof location.altitude_msl === 'number' ? location.altitude_msl : (location.altitude || 0)),  // altMsl
        true,                 // hasAlt
        true,                 // hasAltMsl
        false,                // hasAltMslAccuracy
        1.5                   // mslAccuracyMeters
      );
      console.log('Added geo point for punch out:', geoPoint);

      // Параллелим загрузку фото и сохранение геоданных, punch отправляем сразу
      const tsSecOut = Math.floor(Date.now() / 1000);
      const phoneImeiOut = await deviceUtils.getDeviceId();
      const photoNameOut = `punch_0_${tsSecOut}.jpg`;

      const uploadOutPromise = fileUploadService.uploadShiftPhoto(
        {
          uri: selfie.uri,
          type: selfie.type || 'image/jpeg',
          fileName: photoNameOut,
        },
        currentUser.user_id || 123,
        phoneImeiOut,
        'end'
      ).then((res) => {
        if (!res?.success) {
          console.log('Shift end photo upload failed:', res?.error || res);
        }
        return res;
      }).catch((e) => {
        console.log('Shift end photo upload exception:', e?.message || e);
      });

      const saveGeoOutPromise = geoService.saveGeoData(
        currentUser.user_id || 123,
        1,
        phoneImeiOut
      ).catch((e) => console.log('saveGeoData (out) error:', e?.message || e));

      // Отправляем punch немедленно с синхронизированным именем фото и timestamp
      const result = await shiftStatusManager.sendPunch(0, photoNameOut, tsSecOut); // 0 = завершение смены

      if (result.success) {
        Alert.alert('Успех', 'Смена завершена!');
        
        // Останавливаем отслеживание геолокации при завершении смены
        try {
          const { stopTracking } = require('../location.js');
          await stopTracking();
          console.log('Location tracking stopped on punch out');
        } catch (e) {
          console.error('Failed to stop tracking on punch out:', e?.message || e);
        }
      } else {
        Alert.alert('Ошибка', result.error);
      }

      // Фоновая до-загрузка без блокировки UI
      Promise.allSettled([uploadOutPromise, saveGeoOutPromise]).then(() => {}).catch(() => {});
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось завершить смену');
    } finally {
      setIsLoading(false);
    }
  };

  // Сохранение геоданных
  const saveGeoData = async () => {
    try {
      const result = await geoService.saveGeoData(
        currentUser.user_id || 123,
        1, // place_id
        await deviceUtils.getDeviceId() // Реальный IMEI
      );

      if (result.success) {
        Alert.alert('Успех', 'Геоданные сохранены!');
      } else {
        Alert.alert('Ошибка', result.error);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить геоданные');
    }
  };

  // (dev test functions removed)


  // Показ количества накопленных точек BGGeo
  const handleShowQueuedPoints = async () => {
    try {
      const BackgroundGeolocation = require('react-native-background-geolocation');
      const BGGeo = BackgroundGeolocation.default || BackgroundGeolocation;
      const count = await BGGeo.getCount();
      Alert.alert('Накопленные точки', String(count));
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось получить количество точек');
    }
  };



  // Функция для запроса игнорирования оптимизации батареи (с guard)
  const requestBatteryOptimization = useCallback(async () => {
    if (batteryOptimizationRequested.current) {
      console.log('[Battery] Already requested, skipping...');
      return;
    }
    
    batteryOptimizationRequested.current = true;
    try {
      const { ensureBatteryWhitelistUI } = require('../location.js');
      await ensureBatteryWhitelistUI();
    } catch (error) {
      console.error('Error requesting battery optimization:', error);
      Alert.alert('Ошибка', 'Не удалось открыть настройки оптимизации батареи');
    }
  }, []);

  // тест геолокации удалён

  // Выход из системы
  const handleLogout = async () => {
    console.log('=== HANDLE LOGOUT CALLED ===');
    console.log('isShiftActive (store):', isShiftActive);
    console.log('currentUser:', currentUser);
    
    try {
      // Перепроверяем при необходимости (без сброса при сетевой ошибке)
      let effectiveActive = !!isShiftActive;
      if (!effectiveActive && currentUser?.user_id) {
        try {
          console.log('[Shift] Verifying active shift before logout...');
          const res = await punchService.getShiftStatus(currentUser.user_id);
          effectiveActive = !!res?.success && !!res.data?.has_active_shift;
          console.log('[Shift] Verify result:', effectiveActive);
        } catch (e) {
          console.log('[Shift] Verify failed, keep current store value. Reason:', e?.message || e);
        }
      }

      if (effectiveActive) {
        console.log('Showing shift interruption alert...');
        guardedAlert(
          'Прерывание смены',
          'У вас активна смена. Вы уверены, что хотите прервать смену и выйти из системы?',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Прервать смену и выйти',
              style: 'destructive',
              onPress: async () => {
                try {
                  console.log('User confirmed shift interruption and logout');
                  if (currentUser && currentUser.user_id) {
                    console.log('Auto-closing shift before logout...');
                    try {
                      const { stopTracking } = require('../location.js');
                      await stopTracking();
                      console.log('Location tracking stopped before logout');
                    } catch (e) {
                      console.error('Failed to stop tracking before logout:', e?.message || e);
                    }
                    const phoneImei = await deviceUtils.getDeviceId();
                    const autoPunchResult = await punchService.autoPunchOut(currentUser.user_id, phoneImei);
                    if (autoPunchResult.success) {
                      console.log('Shift auto-closed successfully before logout');
                      Alert.alert('Смена прервана', 'Смена была автоматически закрыта');
                    } else {
                      console.error('Failed to auto-close shift before logout:', autoPunchResult.error);
                      Alert.alert('Предупреждение', 'Не удалось закрыть смену автоматически. Обратитесь к администратору.');
                    }
                  }
                  await authService.logout();
                  onLogout();
                } catch (error) {
                  console.error('Error during logout with shift closure:', error);
                  Alert.alert('Ошибка', 'Не удалось выйти из системы');
                }
              },
            },
          ]
        );
      } else {
        await authService.logout();
        onLogout();
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти из системы');
    }
  };

  const handleIndicatorPress = useCallback((kind) => {
    const openSettings = async () => {
      try { await Linking.openSettings(); } catch {}
    };
    switch (kind) {
      case 'gps':
        Alert.alert('GPS', indicators.gps ? 'GPS включен' : 'GPS выключен', [
          !indicators.gps ? { text: 'Открыть настройки', onPress: openSettings } : { text: 'OK' }
        ]);
        break;
      case 'network':
        Alert.alert('Сеть', indicators.network ? 'Сеть доступна' : 'Нет соединения', [
          !indicators.network ? { text: 'Открыть настройки', onPress: openSettings } : { text: 'OK' }
        ]);
        break;
      case 'battery':
        Alert.alert('Энергосбережение', indicators.battery ? 'Исключение из оптимизации активировано' : 'Оптимизация батареи включена', [
          !indicators.battery ? { text: 'Открыть', onPress: requestBatteryOptimization } : { text: 'OK' }
        ]);
        break;
      case 'permission':
        Alert.alert('Разрешения геолокации', indicators.permission ? 'Разрешения в порядке' : 'Необходимы фоновые разрешения геолокации', [
          !indicators.permission ? { text: 'Настроить', onPress: requestBackgroundLocationTwoClicks } : { text: 'OK' }
        ]);
        break;
      case 'notifications':
        Alert.alert('Уведомления', indicators.notifications ? 'Разрешены' : 'Запрещены', [
          !indicators.notifications ? { text: 'Разрешить', onPress: checkNotificationsPermissionOnAppActive } : { text: 'OK' }
        ]);
        break;
      default:
        break;
    }
  }, [indicators, requestBatteryOptimization]);

  const displayName = currentUser
    ? [currentUser.user_lname, currentUser.user_fname, currentUser.user_mname]
        .filter(Boolean)
        .join(' ')
    : '';

  const formatIso = (iso) => {
    try {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString();
    } catch { return '—'; }
  };

  useEffect(() => {
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    const getMonthRange = (offset) => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const d = new Date(y, m + offset, 1);
      const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
      const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(endDate)}`;
      const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      return { start, end, label };
    };

    const fetchMonthlyStats = async () => {
      try {
        const userId = currentUser?.user_id;
        if (!userId) return;
        const { API_CONFIG } = require('../config/api');
        const { start, end } = getMonthRange(monthOffset);
        const qs = `?user_id=${userId}&from=${start}&to=${end}`;
        const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.WORKSHIFTS}${qs}`, {
          headers: { 'Content-Type': 'application/json', 'Api-token': API_CONFIG.API_TOKEN },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : []);
        const total = list.length;
        let approved = 0;
        let approvedHours = 0;
        let appCount = 0;
        let suspicious = 0;
        const toHrs = (ms) => ms / (1000 * 60 * 60);
        for (const x of list) {
          const status = (x.status || x.shift_status || '').toString().toLowerCase();
          const isApproved = status.includes('approved') || status.includes('normal') || status.includes('утверж');
          if (isApproved) approved += 1;
          let hrs = x.shift_duration_hours || x.duration_hours || null;
          if (hrs == null && x.shift_start && x.shift_end) {
            const st = new Date(x.shift_start).getTime();
            const en = new Date(x.shift_end).getTime();
            if (!isNaN(st) && !isNaN(en) && en > st) hrs = toHrs(en - st);
          }
          if (isApproved && typeof hrs === 'number') approvedHours += hrs;
          const source = (x.source || x.submitted_via || x.created_by || '').toString().toLowerCase();
          if (source.includes('app') || source.includes('mobile')) appCount += 1;
          if (status.includes('suspicious') || status.includes('аном') || (typeof hrs === 'number' && hrs < 0.25)) suspicious += 1;
        }
        setMonthlyRecorded(total);
        setMonthlyApproved(approved);
        setMonthlyApprovedHours(approvedHours ? Number(approvedHours.toFixed(1)) : 0);
        setMonthlyAppCount(appCount);
        setMonthlySuspicious(suspicious);
      } catch {}
    };
    fetchMonthlyStats();
  }, [currentUser, monthOffset]);

  // Список отсутствующих разрешений/состояний для badge
  const missingBadges = [];
  if (!indicators.permission) missingBadges.push({ key: 'permission', label: 'Гео‑разрешения', onPress: requestBackgroundLocationTwoClicks });
  if (!indicators.gps) missingBadges.push({ key: 'gps', label: 'GPS', onPress: () => Linking.openSettings().catch(() => {}) });
  if (!indicators.network) missingBadges.push({ key: 'network', label: 'Сеть', onPress: () => Linking.openSettings().catch(() => {}) });
  if (!indicators.battery) missingBadges.push({ key: 'battery', label: 'Энергосбережение', onPress: requestBatteryOptimization });
  if (!indicators.notifications) missingBadges.push({ key: 'notifications', label: 'Уведомления', onPress: checkNotificationsPermissionOnAppActive });


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Тёмная полоса под статус-баром: выходит за safe-area и немного ниже */}
        <View style={styles.statusBarStripAbsolute} />
        <View style={styles.statusBarSpacer} />

        <View style={styles.userHeader}>
          <View style={styles.userTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userRoleTop}>{(currentUser?.worker_type || '').toLowerCase() === 'worker' ? 'Рабочий' : (currentUser?.worker_type || 'Пользователь')}</Text>
              <View style={styles.nameWithBadgeRow}>
                {missingBadges.length > 0 && (
                  <TouchableOpacity onPress={() => setShowHeaderBadges(v => !v)} style={[styles.unreadBadge, { marginRight: 6 }]} accessibilityLabel="Проблемы с доступами">
                    <Text style={styles.unreadBadgeText}>!</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.userNameTop}>{currentUser ? (displayName || '—') : 'Загрузка...'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setMenuModalVisible(true)} accessibilityLabel="Меню">
              <Text style={styles.kebabIcon}>⋮</Text>
            </TouchableOpacity>
          </View>
          {/* Показ badges доступов прямо в хедере (по нажатию на ! слева от ФИО) */}
          {showHeaderBadges && missingBadges.length > 0 && (
            <View style={[styles.badgeRow, { paddingHorizontal: 16, marginBottom: 10 }]}>
              {missingBadges.map(b => (
                <View key={b.key} style={styles.badge}>
                  <TouchableOpacity onPress={b.onPress}>
                    <Text style={styles.badgeText}>{b.label}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Статистика перенесена на отдельную вкладку */}

        {/* Короткие индикаторы скрыты */}

        {/* Блок с деталями пользователя удалён (expand убран) */}

        {/* Показываем только badge для отсутствующих доступов */}
        {/* Badges теперь показываются через глаз в шапке пользователя */}

        {/* Модалка меню (три точки) */}
        <Modal visible={menuModalVisible} transparent animationType="none" onRequestClose={() => setMenuModalVisible(false)}>
          <View pointerEvents="box-none" style={styles.modalOverlayNoShade}>
            <TouchableOpacity style={styles.fill} activeOpacity={1} onPress={() => setMenuModalVisible(false)} />
            <View style={[styles.menuDropdown, { top: 72, right: 24 }]}
              pointerEvents="box-none">
              <TouchableOpacity style={[styles.button, styles.logoutDropdownButton]} onPress={() => { setMenuModalVisible(false); handleLogout(); }}>
                <Text style={styles.logoutDropdownLabel}>Выйти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Модалка доступов (по badge/значку) */}
        <Modal visible={accessModalVisible} transparent animationType="fade" onRequestClose={() => setAccessModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.accessPanel}>
              <View style={styles.accessHeader}>
                <Text style={styles.accessTitle}>Доступы</Text>
                <TouchableOpacity onPress={() => setAccessModalVisible(false)}>
                  <Text style={styles.accessClose}>Закрыть</Text>
                </TouchableOpacity>
              </View>
              {[
                { key: 'permission', label: 'Гео‑разрешения', ok: indicators.permission, action: requestBackgroundLocationTwoClicks },
                { key: 'gps', label: 'GPS', ok: indicators.gps, action: () => Linking.openSettings().catch(() => {}) },
                { key: 'network', label: 'Сеть', ok: indicators.network, action: () => Linking.openSettings().catch(() => {}) },
                { key: 'battery', label: 'Энергосбережение', ok: indicators.battery, action: requestBatteryOptimization },
                { key: 'notifications', label: 'Уведомления', ok: indicators.notifications, action: checkNotificationsPermissionOnAppActive },
              ].map(item => (
                <View key={item.key} style={styles.accessRow}>
                  <Text style={styles.accessLabel}>{item.label}</Text>
                  <View style={styles.accessRight}>
                    <Text style={[styles.accessStatus, item.ok ? styles.ok : styles.bad]}>{item.ok ? 'ОК' : 'Нет'}</Text>
                    {!item.ok && (
                      <TouchableOpacity onPress={() => { item.action(); }} style={styles.accessBtn}>
                        <Text style={styles.accessBtnText}>Настроить</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Modal>

        <View style={[styles.statusCard, styles.statusCardFullWidth]}>
          <View style={[styles.statusIndicator, isShiftActive ? styles.activeStatus : styles.inactiveStatus]}>
            <Text style={[
              styles.statusText,
              isShiftActive ? styles.statusTextActive : styles.statusTextInactive
            ]}>
              {isShiftActive ? 'Смена активна' : 'Смена не активна'}
            </Text>
          </View>
          <View style={{ marginTop: 12, width: '100%' }}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Начало смены</Text>
              <Text style={styles.detailValue}>{formatIso(shiftStart)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Последний запрос</Text>
              <Text style={styles.detailValue}>{formatIso(lastRequestAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>На объекте</Text>
              <Text style={styles.detailValue}>{onSite === null ? '—' : (onSite ? 'Да' : 'Нет')}</Text>
            </View>
          </View>
          {userStatus === WorkerStatus.BLOCKED && (
            <Text style={{ color: 'crimson', fontSize: 14, marginTop: 10, textAlign: 'center', fontWeight: '600' }}>
              ⚠️ ВНИМАНИЕ: Пользователь заблокирован!
            </Text>
          )}

        </View>

        <View style={styles.actions}>
          {!isShiftActive ? (
            canStartShift(userStatus) ? (
              <View />
            ) : (
              <View>
                <Text style={{ color: 'crimson', textAlign: 'center', marginBottom: 10 }}>
                  {userStatus === WorkerStatus.BLOCKED
                    ? 'Ваш пользователь был заблокирован администратором'
                    : 'Ваш пользователь уволен'}
                </Text>
                {userStatus === WorkerStatus.BLOCKED ? (
                  <TouchableOpacity
                    style={[styles.button, styles.punchInButton, isLoading && styles.buttonDisabled]}
                    onPress={async () => {
                      if (!currentUser) return;
                      setIsLoading(true);
                      try {
                        const res = await punchService.requestUnblock(currentUser.user_id || 123);
                        if (res.success) {
                          Alert.alert('Готово', 'Запрос на разблокировку отправлен');
                          // Статус пользователя обновится автоматически через ShiftStatusManager
                        } else {
                          Alert.alert(
                            'Ошибка отправки запроса', 
                            res.error || 'Не удалось отправить запрос',
                            [
                              { text: 'Повторить', onPress: () => {
                                // Рекурсивно вызываем функцию для повтора
                                setTimeout(() => {
                                  if (currentUser) {
                                    const retryUnblock = async () => {
                                      setIsLoading(true);
                                      try {
                                        const retryRes = await punchService.requestUnblock(currentUser.user_id || 123);
                                        if (retryRes.success) {
                                          Alert.alert('Готово', 'Запрос на разблокировку отправлен');
                                          // Статус пользователя обновится автоматически через ShiftStatusManager
                                        } else {
                                          Alert.alert('Ошибка', retryRes.error || 'Не удалось отправить запрос');
                                        }
                                      } catch (e) {
                                        Alert.alert('Ошибка', 'Не удалось отправить запрос. Повторите позже.');
                                      } finally {
                                        setIsLoading(false);
                                      }
                                    };
                                    retryUnblock();
                                  }
                                }, 100);
                              }},
                              { text: 'Отмена', style: 'cancel' }
                            ]
                          );
                        }
                      } catch (e) {
                        console.error('Request unblock error:', e);
                        Alert.alert(
                          'Ошибка сети', 
                          'Не удалось отправить запрос. Проверьте интернет-соединение.',
                          [
                            { text: 'Повторить', onPress: () => {
                              // Рекурсивно вызываем функцию для повтора
                              setTimeout(() => {
                                if (currentUser) {
                                  const retryUnblock = async () => {
                                    setIsLoading(true);
                                    try {
                                      const retryRes = await punchService.requestUnblock(currentUser.user_id || 123);
                                      if (retryRes.success) {
                                        Alert.alert('Готово', 'Запрос на разблокировку отправлен');
                                        // Статус пользователя обновится автоматически через ShiftStatusManager
                                      } else {
                                        Alert.alert('Ошибка', retryRes.error || 'Не удалось отправить запрос');
                                      }
                                    } catch (e) {
                                      Alert.alert('Ошибка', 'Не удалось отправить запрос. Повторите позже.');
                                    } finally {
                                      setIsLoading(false);
                                    }
                                  };
                                  retryUnblock();
                                }
                              }, 100);
                            }},
                            { text: 'Отмена', style: 'cancel' }
                          ]
                        );
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Отправить запрос на разблокировку</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            )
          ) : (
            <View />
          )}
        </View>

        {/* Кнопка показа количества накопленных точек под блоком смены */}
        <View style={{ marginBottom: 16 }}>
          <TouchableOpacity
            style={[styles.button, styles.queuedButton]}
            onPress={handleShowQueuedPoints}
            accessibilityLabel="Показать количество накопленных точек"
          >
            <Text style={styles.buttonText}>Накопленные точки</Text>
          </TouchableOpacity>
        </View>

        {/* Кнопка выхода перенесена в шапку */}
      </ScrollView>
      {/* Селфи-модал отключен */}

      {/* Фиксированные нижние кнопки открытия/закрытия смены */}
      {!isShiftActive && canStartShift(userStatus) && (
        <View style={styles.fabContainer} pointerEvents={isLoading ? 'none' : 'auto'}>
          <TouchableOpacity
            style={[styles.fabButton, isLoading && styles.fabButtonDisabled]}
            onPress={handlePunchIn}
            disabled={isLoading}
            accessibilityLabel="Открыть смену"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />)
              : (<Text style={styles.fabText}>Открыть смену</Text>)}
          </TouchableOpacity>
        </View>
      )}
      {isShiftActive && (
        <View style={styles.fabContainer} pointerEvents={isLoading ? 'none' : 'auto'}>
          <TouchableOpacity
            style={[styles.fabButtonClose, isLoading && styles.fabButtonDisabled]}
            onPress={handlePunchOut}
            disabled={isLoading}
            accessibilityLabel="Закрыть смену"
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />)
              : (<Text style={styles.fabText}>Закрыть смену</Text>)}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBarSpacer: {
    height: Platform.OS === 'ios' ? 16 : 12,
  },
  statusBarStripAbsolute: {
    position: 'absolute',
    top: -100,
    left: -1000,
    right: -1000,
    height: Platform.OS === 'ios' ? 160 : 120,
    backgroundColor: '#1f1f1f',
    zIndex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72, // немного выше таб-бара
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fabButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabButtonClose: {
    backgroundColor: '#F44336',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 220,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabButtonDisabled: {
    backgroundColor: '#8AB4F8',
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  header: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 30,
  },
  headerArea: {
    alignItems: 'center',
    paddingTop: 76,
    paddingBottom: 12,
  },
  topBar: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userTopRow: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userHeader: {
    marginHorizontal: -1000,
    paddingHorizontal: 1000,
    backgroundColor: '#e6eef6',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  userQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  kebabIcon: {
    fontSize: 22,
    color: '#333',
    padding: 8,
  },
  metricsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  metricsText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  shiftStatsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  shiftStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    textTransform: 'capitalize',
  },
  monthChevron: {
    fontSize: 28,
    color: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shiftStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#f7f9fc',
    borderRadius: 10,
    padding: 12,
  },
  statLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  statValue: {
    color: '#1d1d1f',
    fontSize: 18,
    fontWeight: '800',
  },
  statSub: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  statsCardDark: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 12,
    paddingBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  pill: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  pillActive: {
    backgroundColor: '#fff',
  },
  pillText: {
    color: '#fff',
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#1d1d1f',
  },
  statsAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sbList: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  sbItem: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sbItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sbIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sbIconText: { color: '#1d1d1f', fontWeight: '800' },
  sbTitle: { color: '#fff', fontWeight: '700' },
  sbSub: { color: '#98989F', fontSize: 12, fontWeight: '600' },
  sbValue: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalOverlayNoShade: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingRight: 12,
  },
  fill: { flex: 1, alignSelf: 'stretch' },
  menuDropdown: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
    minWidth: undefined,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  logoutDropdownButton: {
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  logoutDropdownLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  userMenu: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  userRoleTop: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  userNameTop: {
    fontSize: 20,
    color: '#333',
    fontWeight: '800',
  },
  nameWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF9800',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    marginTop: -1,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  logoLetterSmall: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  appNameInline: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  userCardChevron: {
    fontSize: 16,
    color: '#666',
  },
  userName: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  userDetails: {
    gap: 10,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  detailLabel: {
    flex: 1,
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    marginRight: 6,
    fontWeight: '700',
  },
  ok: { color: '#2e7d32' },
  bad: { color: '#c62828' },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  statusCardFullWidth: {
    alignSelf: 'stretch',
    marginHorizontal: -20,
    borderRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 20,
  },
  indicatorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 16,
  },
  indicatorItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  indicatorOk: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  indicatorBad: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  indicatorLabel: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  badgeText: {
    color: '#7A4F00',
    fontSize: 12,
    fontWeight: '700',
  },
  accessPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  accessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  accessTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  accessClose: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 14,
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  accessLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  accessRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accessStatus: {
    fontWeight: '700',
  },
  accessBtn: {
    backgroundColor: '#FF9800',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  accessBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  statusIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeStatus: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 1)',
  },
  inactiveStatus: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 1)',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#2E7D32',
  },
  statusTextInactive: {
    color: '#B71C1C',
  },
  actions: {
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  punchInButton: {
    backgroundColor: '#007AFF',
  },
  punchOutButton: {
    backgroundColor: '#F44336',
  },
  logoutButton: {
    backgroundColor: '#9E9E9E',
  },
  logoutTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  logoutTopLabel: {
    color: '#1d1d1f',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButtonSmall: {
    backgroundColor: '#9E9E9E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  logoutIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9E9E9E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoutIconText: {
    color: '#9E9E9E',
    fontSize: 20,
    fontWeight: '800',
    marginTop: -1,
  },
  logoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#9E9E9E',
  },
  logoutEmoji: {
    color: '#9E9E9E',
    fontSize: 18,
    fontWeight: '800',
    marginTop: -1,
  },
  logoutLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '700',
  },
  testButton: {
    backgroundColor: '#2196F3',
  },

  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },

  bottomButtons: {
    flexDirection: 'column',
    gap: 10,
  },
  endpointToggleSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  endpointToggleButton: {
    backgroundColor: '#2196F3',
    marginBottom: 10,
  },
  endpointDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  banner: {
    backgroundColor: '#FFF7E6',
    borderColor: '#FFC107',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  bannerText: {
    color: '#7A5D00',
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600'
  },
  bannerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  testButton: {
    backgroundColor: '#FF9800',
  },
  testButtonActive: {
    backgroundColor: '#4CAF50',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 76,
    paddingBottom: 12,
    paddingHorizontal: 8,
  },
  logoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutEmoji: {
    fontSize: 24,
    color: '#9E9E9E',
  },
  logoutLabel: {
    fontSize: 16,
    color: '#9E9E9E',
  },

});

export default MainScreen;