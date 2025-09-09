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
} from 'react-native';
import authService from '../services/authService';
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

const MainScreen = ({ onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showAlwaysBanner, setShowAlwaysBanner] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userStatus, setUserStatus] = useState(WorkerStatus.READY_TO_WORK);
  // endpoint & test toggles removed
  const [shiftStatusManager, setShiftStatusManager] = useState(null);
  const [indicators, setIndicators] = useState({ gps: false, network: false, battery: true, permission: false, notifications: true });
  const [showUserDetails, setShowUserDetails] = useState(false);
  
  // Guards для предотвращения повторных вызовов
  const batteryOptimizationRequested = useRef(false);
  const locationPermissionsRequested = useRef(false);

  useEffect(() => {
    const loadUserData = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('Loaded currentUser:', user);
        setCurrentUser(user);
        
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
          
          const hasActiveShift = data.has_active_shift || false;
          const workerStatus = data.worker_status || 'активен';
          
          setIsShiftActive(hasActiveShift);
          setUserStatus(normalizeStatus(workerStatus));
          
          console.log('Updated state:', {
            isShiftActive: hasActiveShift,
            userStatus: workerStatus
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
    
    // Отслеживаем AppState для баннера Always
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && Platform.OS === 'android') {
        try {
          const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
          const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
          setShowAlwaysBanner(bg !== RESULTS.GRANTED);
        } catch {}
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
      const workerStatus = currentStatus.worker_status || 'активен';
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

    try {
      // Требуем фото. Во фронтальную камеру. В dev допускаем выбор из галереи при неудаче
      let photoResult = await cameraService.takePhoto({ cameraType: 'front' });

      if (!photoResult.success && __DEV__) {
        const galleryResult = await cameraService.selectPhoto();
        if (galleryResult.success) {
          photoResult = galleryResult;
        }
      }

      if (!photoResult.success) {
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

      // Сначала загружаем фото согласно требованиям API, затем отправляем punch in
      const phoneImeiIn = await deviceUtils.getDeviceId();
      const uploadIn = await fileUploadService.uploadShiftPhoto(
        {
          uri: photoResult.data?.uri,
          type: photoResult.data?.type,
          fileName: photoResult.data?.fileName || `start_${Date.now()}.jpg`,
        },
        currentUser.user_id || 123,
        phoneImeiIn,
        'start'
      );

      if (!uploadIn.success) {
        Alert.alert('Ошибка', uploadIn.error || 'Не удалось загрузить фото начала смены');
        setIsLoading(false);
        return;
      }

      // Принудительно отправляем стартовую геолокацию
      await geoService.saveGeoData(
        currentUser.user_id || 123,
        1,
        phoneImeiIn
      );

      // Используем новый сервис для отправки punch
      const result = await shiftStatusManager.sendPunch(1); // 1 = начало смены

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
        Alert.alert('Ошибка', result.error);
      }
    } catch (error) {
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
      // Требуем фото. Явно запрашиваем фронтальную камеру
      let photoResult = await cameraService.takePhoto({ cameraType: 'front' });

      if (!photoResult.success && __DEV__) {
        const galleryResult = await cameraService.selectPhoto();
        if (galleryResult.success) {
          photoResult = galleryResult;
        }
      }

      if (!photoResult.success) {
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

      // Сначала загружаем фото согласно требованиям API, затем отправляем punch out
      const phoneImeiOut = await deviceUtils.getDeviceId();
      const uploadOut = await fileUploadService.uploadShiftPhoto(
        {
          uri: photoResult.data?.uri,
          type: photoResult.data?.type,
          fileName: photoResult.data?.fileName || `end_${Date.now()}.jpg`,
        },
        currentUser.user_id || 123,
        phoneImeiOut,
        'end'
      );

      if (!uploadOut.success) {
        Alert.alert('Ошибка', uploadOut.error || 'Не удалось загрузить фото завершения смены');
        setIsLoading(false);
        return;
      }

      // Принудительно отправляем финальную геолокацию
      await geoService.saveGeoData(
        currentUser.user_id || 123,
        1,
        phoneImeiOut
      );

      // Используем новый сервис для отправки punch
      const result = await shiftStatusManager.sendPunch(0); // 0 = завершение смены

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
    console.log('isShiftActive:', isShiftActive);
    console.log('currentUser:', currentUser);
    
    try {
      // Проверяем, активна ли смена
      if (isShiftActive) {
        console.log('Showing shift interruption alert...');
        Alert.alert(
          'Прерывание смены',
          'У вас активна смена. Вы уверены, что хотите прервать смену и выйти из системы?',
          [
            {
              text: 'Отмена',
              style: 'cancel',
            },
            {
              text: 'Прервать смену и выйти',
              style: 'destructive',
              onPress: async () => {
                try {
                  console.log('User confirmed shift interruption and logout');
                  
                  // Автоматически закрываем смену без фото
                  if (currentUser && currentUser.user_id) {
                    console.log('Auto-closing shift before logout...');
                    
                    // Останавливаем отслеживание геолокации
                    try {
                      const { stopTracking } = require('../location.js');
                      await stopTracking();
                      console.log('Location tracking stopped before logout');
                    } catch (e) {
                      console.error('Failed to stop tracking before logout:', e?.message || e);
                    }
                    
                    // Автоматически закрываем смену
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
                  
                  // Выходим из системы
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
        // Если смена не активна, просто выходим
        await authService.logout();
        onLogout();
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти из системы');
    }
  };

  const displayName = currentUser
    ? [currentUser.user_lname, currentUser.user_fname, currentUser.user_mname]
        .filter(Boolean)
        .join(' ')
    : '';


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.headerArea}>
          <View style={styles.logo}>
            <Text style={styles.logoLetter}>С</Text>
          </View>
          <Text style={styles.appName}>Смена</Text>
          <Text style={styles.subtitle}>{currentUser ? (displayName || '—') : 'Загрузка...'}</Text>
        </View>

        {/* Карточка пользователя с экспандером и индикаторами/действиями */}
        <View style={styles.userCard}>
          <TouchableOpacity style={styles.userCardHeader} onPress={() => setShowUserDetails(v => !v)}>
            <Text style={styles.userCardTitle}>Пользователь</Text>
            <Text style={styles.userCardChevron}>{showUserDetails ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          <Text style={styles.userName}>{currentUser ? (displayName || '—') : '—'}</Text>
          {showUserDetails && (
            <View style={styles.userDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🔑 Фоновая геолокация</Text>
                <Text style={[styles.detailValue, indicators.permission ? styles.ok : styles.bad]}>{indicators.permission ? 'ОК' : 'Требуется'}</Text>
                {!indicators.permission && (
                  <Button title="Настроить" onPress={requestBackgroundLocationTwoClicks} />
                )}
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🔔 Уведомления</Text>
                <Text style={[styles.detailValue, indicators.notifications ? styles.ok : styles.bad]}>{indicators.notifications ? 'ОК' : 'Выключены'}</Text>
                {!indicators.notifications && (
                  <Button title="Разрешить" onPress={checkNotificationsPermissionOnAppActive} />
                )}
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>🔋 Энергосбережение</Text>
                <Text style={[styles.detailValue, indicators.battery ? styles.ok : styles.bad]}>{indicators.battery ? 'ОК' : 'Включено'}</Text>
                {!indicators.battery && (
                  <Button title="Открыть" onPress={requestBatteryOptimization} />
                )}
              </View>
            </View>
          )}
        </View>

        {/* Короткие индикаторы: GPS / сеть / энергосбережение / разрешения */}
        <View style={styles.indicatorsRow}>
          <View style={[styles.indicatorItem, indicators.gps ? styles.indicatorOk : styles.indicatorBad]}>
            <Text style={styles.indicatorLabel}>📍 GPS</Text>
          </View>
          <View style={[styles.indicatorItem, indicators.network ? styles.indicatorOk : styles.indicatorBad]}>
            <Text style={styles.indicatorLabel}>🌐 Сеть</Text>
          </View>
          <View style={[styles.indicatorItem, indicators.battery ? styles.indicatorOk : styles.indicatorBad]}>
            <Text style={styles.indicatorLabel}>🔋 Энергосбережение</Text>
          </View>
          <View style={[styles.indicatorItem, indicators.permission ? styles.indicatorOk : styles.indicatorBad]}>
            <Text style={styles.indicatorLabel}>🔑 Разрешения</Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Статус</Text>
          <View style={[styles.statusIndicator, isShiftActive ? styles.activeStatus : styles.inactiveStatus]}>
            <Text style={styles.statusText}>
              {humanizeStatus(userStatus)}{isShiftActive ? ' • Смена активна' : ''}
            </Text>
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
              <TouchableOpacity
                style={[styles.button, styles.punchInButton, isLoading && styles.buttonDisabled]}
                onPress={handlePunchIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Открыть смену</Text>
                )}
              </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.button, styles.punchOutButton, isLoading && styles.buttonDisabled]}
              onPress={handlePunchOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Закрыть смену</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
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
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoLetter: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
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
    backgroundColor: '#4CAF50',
  },
  inactiveStatus: {
    backgroundColor: '#F44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    backgroundColor: '#4CAF50',
  },
  punchOutButton: {
    backgroundColor: '#F44336',
  },
  logoutButton: {
    backgroundColor: '#9E9E9E',
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

});

export default MainScreen;