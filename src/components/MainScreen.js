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
  RefreshControl,
} from 'react-native';
import { 
  Button as PaperButton, 
  FAB, 
  IconButton,
  Chip,
  Card,
  Avatar,
  Provider as PaperProvider,
  Appbar,
  Icon
} from 'react-native-paper';
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
import { runSequentialPermissionFlow, forceShowBackgroundPermissionDialog, checkNotificationsPermissionOnAppActive, requestBackgroundLocationTwoClicks } from '../services/permissionsService';
import { canStartShift, humanizeStatus, normalizeStatus, WorkerStatus } from '../helpers/shift';
import ShiftStatusManager from '../services/shiftStatusService';
// import { initLocation } from '../location'; // Отключено - инициализация происходит в App.js
// geo endpoint/test toggles removed
// DebugBgScreen and BgGeoTestScreen removed - no longer needed
import { useShiftStore, setFromServer } from '../store/shiftStore';
import { guardedAlert } from '../ui/alert';
import { styles } from './MainScreen.styles';
import { colors, shadows } from '../styles/colors';

const MainScreen = ({ onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
  const [shiftDuration, setShiftDuration] = useState(null);
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
  const [shiftsList, setShiftsList] = useState([]);
  // Селфи-модал отключен, используем image-picker

  // Функция для сортировки смен от самого позднего к раннему
  const sortShiftsByDate = useCallback((shifts) => {
    const sorted = shifts.sort((a, b) => {
      // Получаем даты для сравнения
      const dateA = a.shift_start || a.date || '';
      const dateB = b.shift_start || b.date || '';
      
      // Сортируем от нового к старому (поздний к раннему)
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    if (__DEV__ && sorted.length > 0) {
      console.log('[SortShifts] Sorted shifts by date (newest first):', 
        sorted.slice(0, 3).map(s => ({ 
          date: s.shift_start || s.date, 
          duration: s.duration_hours 
        }))
      );
    }
    
    return sorted;
  }, []);

  // Функция для открытия диалогов разрешений
  const handlePermissionsDialog = useCallback(async () => {
    try {
      console.log('[Permissions] ===== STARTING PERMISSIONS DIALOG =====');
      console.log('[Permissions] Current indicators state:', JSON.stringify(indicators, null, 2));
      
      // Проверяем текущее состояние всех разрешений
      const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
      let hasLocationPermission = false;
      let hasBackgroundPermission = false;
      let hasNotificationPermission = true; // по умолчанию true для старых версий
      let hasBatteryOptimization = true; // по умолчанию true для iOS
      
      if (Platform.OS === 'android') {
        const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
        hasLocationPermission = fine === RESULTS.GRANTED;
        hasBackgroundPermission = bg === RESULTS.GRANTED;
        
        // Проверяем разрешения на уведомления для Android 13+
        if (Platform.Version >= 33) {
          const notif = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          hasNotificationPermission = notif === RESULTS.GRANTED;
        }
        
        // Проверяем оптимизацию батареи
        try {
          const { getBatteryWhitelistStatus } = require('../location.js');
          const status = await getBatteryWhitelistStatus();
          hasBatteryOptimization = !!status?.ignored;
        } catch (e) {
          console.log('[Permissions] Battery optimization check failed:', e);
        }
      } else {
        const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
        const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
        hasLocationPermission = whenInUse === RESULTS.GRANTED;
        hasBackgroundPermission = always === RESULTS.GRANTED;
      }
      
      console.log('[Permissions] Current state:', {
        location: hasLocationPermission,
        background: hasBackgroundPermission,
        notifications: hasNotificationPermission,
        battery: hasBatteryOptimization
      });
      
      // Определяем, какие разрешения отсутствуют
      const missingPermissions = [];
      if (!hasLocationPermission) missingPermissions.push('геолокация');
      if (!hasBackgroundPermission) missingPermissions.push('фоновая геолокация');
      if (!hasNotificationPermission) missingPermissions.push('уведомления');
      if (!hasBatteryOptimization) missingPermissions.push('оптимизация батареи');
      
      console.log('[Permissions] Missing permissions:', missingPermissions);
      
      // Если все разрешения есть, показываем информационное сообщение
      if (missingPermissions.length === 0) {
        Alert.alert(
          'Разрешения настроены',
          'Все необходимые разрешения уже предоставлены. Приложение готово к работе.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Показываем диалог с отсутствующими разрешениями
      const missingText = missingPermissions.join(', ');
      Alert.alert(
        'Необходимы разрешения',
        `Для корректной работы приложения необходимо настроить: ${missingText}. Хотите открыть настройки разрешений?`,
        [
          { text: 'Отмена', style: 'cancel' },
          { 
            text: 'Настроить', 
            onPress: async () => {
              console.log('[Permissions] User confirmed - opening permission dialogs');
              
              // Запрашиваем разрешения по порядку
              if (!hasLocationPermission || !hasBackgroundPermission) {
                console.log('[Permissions] Requesting location permissions');
                try {
                  await requestBackgroundLocationTwoClicks();
                  console.log('[Permissions] Location permissions dialog completed');
                } catch (error) {
                  console.error('[Permissions] Error requesting location permissions:', error);
                }
              }
              
              if (!hasNotificationPermission) {
                console.log('[Permissions] Requesting notification permission');
                try {
                  await checkNotificationsPermissionOnAppActive();
                  console.log('[Permissions] Notification permission dialog completed');
                } catch (error) {
                  console.error('[Permissions] Error requesting notification permission:', error);
                }
              }
              
              if (!hasBatteryOptimization) {
                console.log('[Permissions] Requesting battery optimization');
                try {
                  // Добавляем небольшую задержку перед запросом оптимизации батареи
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  const { ensureBatteryWhitelistUI } = require('../location.js');
                  await ensureBatteryWhitelistUI();
                  console.log('[Permissions] Battery optimization dialog opened');
                  
                  // Показываем информационное сообщение пользователю
                  Alert.alert(
                    'Настройка оптимизации батареи',
                    'В открывшемся окне найдите приложение "Workforce Tracker" и включите "Разрешить" или "Не оптимизировать". Это необходимо для корректной работы приложения в фоновом режиме.',
                    [
                      { text: 'Понятно' },
                      { 
                        text: 'Открыть настройки', 
                        onPress: () => {
                          console.log('[Permissions] Opening app settings as fallback');
                          Linking.openSettings().catch(() => {
                            console.log('[Permissions] Failed to open settings');
                          });
                        }
                      }
                    ]
                  );
                } catch (error) {
                  console.error('[Permissions] Error opening battery optimization:', error);
                  Alert.alert('Ошибка', 'Не удалось открыть настройки оптимизации батареи. Попробуйте открыть настройки вручную: Настройки → Приложения → Workforce Tracker → Батарея → Не оптимизировать');
                }
              }
              
              // Обновляем индикаторы после запроса разрешений
              console.log('[Permissions] Refreshing indicators after permission requests');
              await refreshIndicators();
              
              // Добавляем дополнительную задержку и повторное обновление
              setTimeout(async () => {
                console.log('[Permissions] Second refresh after delay');
                await refreshIndicators();
              }, 2000);
              
              console.log('[Permissions] All permission dialogs completed');
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('[Permissions] Error in permissions dialog:', error);
      Alert.alert('Ошибка', 'Не удалось открыть настройки разрешений');
    }
  }, [refreshIndicators, requestBatteryOptimization, indicators]);

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
      console.log('[MainScreen] loadUserData: starting...');
      const user = await authService.getCurrentUser();
      console.log('[MainScreen] loadUserData: got user:', user);
      if (user) {
        console.log('[MainScreen] loadUserData: setting currentUser:', user);
        setCurrentUser(user);
        currentUserIdRef.current = user.user_id;
        
        // Инициализируем ShiftStatusManager (без polling)
        const deviceId = await deviceUtils.getDeviceId();
        const manager = new ShiftStatusManager(user.user_id || 123, deviceId);
        
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
          
          // Вычисляем продолжительность смены от начала до последней точки
          try {
            const startTime = hasActiveShift ? (data?.active_shift?.shift_start || null) : null;
            const lastTime = data?.worker?.last_geo_timestamp || data?.last_request || null;
            
            if (startTime && lastTime) {
              const start = new Date(startTime).getTime();
              const last = new Date(lastTime).getTime();
              if (!isNaN(start) && !isNaN(last) && last > start) {
                const durationHours = (last - start) / (1000 * 60 * 60);
                setShiftDuration(durationHours);
              } else {
                setShiftDuration(null);
              }
            } else {
              setShiftDuration(null);
            }
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
        
        // Загружаем начальный статус смены
        try {
          const initialStatus = await manager.getCurrentStatus();
          manager.updateUI(initialStatus);
        } catch (e) {
          console.log('Failed to load initial shift status:', e?.message || e);
        }
        
        setShiftStatusManager(manager);
      }
    };
    
    loadUserData();
    // endpoint/test toggles removed
    // Убираем дублирующий запрос разрешений - runSequentialPermissionFlow() уже включает запрос геолокации
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
        const status = await refreshShiftStatusNow(uid);
        
        // Обновляем UI с полученным статусом
        if (shiftStatusManager && shiftStatusManager.updateUI) {
          shiftStatusManager.updateUI(status);
        }
        
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

  // Обновление состояния смены при фокусе на MainScreen (для навигации между вкладками)
  useEffect(() => {
    const refreshStatusOnFocus = async () => {
      if (!currentUser?.user_id || !shiftStatusManager) {
        return;
      }
      
      try {
        console.log('[MainScreen] Refreshing shift status on focus...');
        const { forceRefreshShiftStatus } = require('../services/shiftStatusService');
        const status = await forceRefreshShiftStatus(currentUser.user_id);
        
        if (shiftStatusManager && shiftStatusManager.updateUI) {
          shiftStatusManager.updateUI(status);
        }
        
        console.log('[MainScreen] Shift status refreshed on focus:', status);
      } catch (e) {
        console.log('[MainScreen] Failed to refresh status on focus:', e?.message || e);
      }
    };

    // Обновляем состояние при монтировании компонента (когда пользователь возвращается на главную вкладку)
    refreshStatusOnFocus();
  }, [currentUser?.user_id, shiftStatusManager]);

  // Индикаторы: GPS / сеть / энергосбережение / разрешения
  const refreshIndicators = useCallback(async () => {
    try {
      let permissionOk = false;
      try {
        const { check, RESULTS, PERMISSIONS } = require('react-native-permissions');
        if (Platform.OS === 'android') {
          const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
          const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
          permissionOk = (bg === RESULTS.GRANTED) && (fine === RESULTS.GRANTED);
          console.log('[Permissions] Android - Background:', bg, 'Fine:', fine, 'PermissionOk:', permissionOk);
        } else {
          const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
          const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
          permissionOk = (always === RESULTS.GRANTED) && (whenInUse === RESULTS.GRANTED);
          console.log('[Permissions] iOS - Always:', always, 'WhenInUse:', whenInUse, 'PermissionOk:', permissionOk);
        }
      } catch (e) {
        console.log('[Permissions] Error checking permissions:', e);
      }

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

      const newIndicators = { gps: !!gpsOk, network: !!networkOk, battery: !!batteryOk, permission: !!permissionOk, notifications: !!notificationsOk };
      console.log('[Indicators] Updated indicators:', JSON.stringify(newIndicators, null, 2));
      
      // Проверяем, изменились ли индикаторы
      const hasChanges = Object.keys(newIndicators).some(key => newIndicators[key] !== indicators[key]);
      if (hasChanges) {
        console.log('[Indicators] Indicators changed, updating state');
      } else {
        console.log('[Indicators] No changes in indicators');
      }
      
      setIndicators(newIndicators);

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

  // Функция для обновления всех данных при pull-to-refresh
  const refreshAllData = useCallback(async () => {
    if (!currentUser?.user_id || !shiftStatusManager) {
      console.log('[MainScreen] refreshAllData: missing user or shiftStatusManager');
      return;
    }

    console.log('[MainScreen] refreshAllData: starting refresh...');
    
    try {
      // 1. Обновляем статус смены
      console.log('[MainScreen] refreshAllData: refreshing shift status...');
      const { refreshShiftStatusNow } = require('../services/shiftStatusService');
      const shiftStatus = await refreshShiftStatusNow(currentUser.user_id);
      
      if (shiftStatusManager && shiftStatusManager.updateUI) {
        shiftStatusManager.updateUI(shiftStatus);
      }
      
      // 2. Обновляем профиль пользователя
      console.log('[MainScreen] refreshAllData: refreshing user profile...');
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        currentUserIdRef.current = user.user_id;
      }
      
      // 3. Обновляем список смен
      console.log('[MainScreen] refreshAllData: refreshing shifts list...');
      const { API_CONFIG } = require('../config/api');
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHIFTS}?user_id=${encodeURIComponent(currentUser.user_id)}&aggregate=1`;
      
      const res = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${API_CONFIG.API_TOKEN}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        let shifts = [];
        
        if (data.aggregate && Array.isArray(data.items)) {
          shifts = data.items.map((it) => ({
            shift_start: it.date ? `${it.date}T00:00:00Z` : null,
            duration_hours: typeof it.total_hours === 'number' ? it.total_hours : null,
            date: it.date,
            day_hours: it.day_hours,
            night_hours: it.night_hours,
            day_shifts_count: it.day_shifts_count,
            night_shifts_count: it.night_shifts_count,
            is_aggregate: true,
          }));
        } else if (data.success && Array.isArray(data.shifts)) {
          shifts = data.shifts;
        } else if (Array.isArray(data)) {
          shifts = data;
        } else if (Array.isArray(data?.results)) {
          shifts = data.results;
        }
        
        // Сортируем смены от самого позднего к раннему
        const sortedShifts = sortShiftsByDate([...shifts]);
        setShiftsList(sortedShifts);
        console.log('[MainScreen] refreshAllData: updated shifts list:', sortedShifts.length, 'items');
      }
      
      // 4. Обновляем индикаторы
      console.log('[MainScreen] refreshAllData: refreshing indicators...');
      await refreshIndicators();
      
      console.log('[MainScreen] refreshAllData: completed successfully');
    } catch (error) {
      console.error('[MainScreen] refreshAllData error:', error);
    }
  }, [currentUser, shiftStatusManager, refreshIndicators]);

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
      
      // Отладочное логирование для проверки данных о высоте
      console.log('=== ALTITUDE DEBUG ===');
      console.log('location.altitude:', location.altitude);
      console.log('location.altitude_msl:', location.altitude_msl);
      console.log('location.accuracy:', location.accuracy);
      console.log('=== END DEBUG ===');

      // Получаем точные данные о высоте
      const altitudeData = geoService.getAccurateAltitudeData(location);
      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        altitudeData.alt,     // alt
        altitudeData.altmsl,  // altMsl
        altitudeData.hasalt,  // hasAlt
        altitudeData.hasaltmsl, // hasAltMsl
        altitudeData.hasaltmslaccuracy, // hasAltMslAccuracy
        altitudeData.mslaccuracyMeters  // mslAccuracyMeters
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
        
        // Дополнительно обновляем UI после успешного punch
        try {
          console.log('[MainScreen] Manually refreshing status after successful punch in...');
          const { refreshShiftStatusNow } = require('../services/shiftStatusService');
          const updatedStatus = await refreshShiftStatusNow(currentUser.user_id);
          if (shiftStatusManager && shiftStatusManager.updateUI) {
            shiftStatusManager.updateUI(updatedStatus);
          }
        } catch (e) {
          console.log('[MainScreen] Failed to manually refresh status after punch in:', e?.message || e);
        }
        
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

  // Запрос на разблокировку
  const handleRequestUnblock = async () => {
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

      // Получаем точные данные о высоте
      const altitudeData = geoService.getAccurateAltitudeData(location);
      
      // Отладочное логирование для проверки данных о высоте
      console.log('=== ALTITUDE DEBUG ===');
      console.log('location.altitude:', location.altitude);
      console.log('location.altitude_msl:', location.altitude_msl);
      console.log('location.accuracy:', location.accuracy);
      console.log('=== END DEBUG ===');

      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        altitudeData.alt,     // alt
        altitudeData.altmsl,  // altMsl
        altitudeData.hasalt,  // hasAlt
        altitudeData.hasaltmsl, // hasAltMsl
        altitudeData.hasaltmslaccuracy, // hasAltMslAccuracy
        altitudeData.mslaccuracyMeters  // mslAccuracyMeters
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
        
        // Дополнительно обновляем UI после успешного punch
        try {
          console.log('[MainScreen] Manually refreshing status after successful punch out...');
          const { refreshShiftStatusNow } = require('../services/shiftStatusService');
          const updatedStatus = await refreshShiftStatusNow(currentUser.user_id);
          if (shiftStatusManager && shiftStatusManager.updateUI) {
            shiftStatusManager.updateUI(updatedStatus);
          }
        } catch (e) {
          console.log('[MainScreen] Failed to manually refresh status after punch out:', e?.message || e);
        }
        
        // Сначала дожидаемся выгрузки геоданных, затем останавливаем трекинг
        try {
          console.log('[MainScreen] Waiting for geo data upload before stopping tracking...');
          await saveGeoOutPromise;
          console.log('[MainScreen] Geo data upload completed');
        } catch (e) {
          console.log('[MainScreen] Geo data upload failed:', e?.message || e);
        }
        
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

      // Фоновая до-загрузка фото без блокировки UI
      uploadOutPromise.then(() => {}).catch(() => {});
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
                    
                    // Сохраняем все накопленные геоданные перед выходом
                    try {
                      console.log('Saving accumulated geo data before logout...');
                      const geoResult = await geoService.saveGeoData(currentUser.user_id, 1, phoneImei);
                      if (geoResult.success) {
                        console.log('Geo data saved successfully before logout');
                      } else {
                        console.log('Failed to save geo data before logout:', geoResult.error);
                      }
                    } catch (e) {
                      console.error('Error saving geo data before logout:', e?.message || e);
                    }
                    
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
        // Сохраняем накопленные геоданные даже если нет активной смены
        if (currentUser && currentUser.user_id) {
          try {
            console.log('Saving accumulated geo data before logout (no active shift)...');
            const phoneImei = await deviceUtils.getDeviceId();
            const geoResult = await geoService.saveGeoData(currentUser.user_id, 1, phoneImei);
            if (geoResult.success) {
              console.log('Geo data saved successfully before logout (no active shift)');
            } else {
              console.log('Failed to save geo data before logout (no active shift):', geoResult.error);
            }
          } catch (e) {
            console.error('Error saving geo data before logout (no active shift):', e?.message || e);
          }
        }
        
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

  const formatDate = (date) => {
    try {
      if (!date) return '—';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('ru-RU');
    } catch { return '—'; }
  };

  const formatHours = (hours) => {
    try {
      if (!hours || typeof hours !== 'number' || isNaN(hours)) return '—';
      const totalMinutes = Math.round(hours * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${h}:${m.toString().padStart(2, '0')}`;
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
        
        // Получаем смены пользователя через новый endpoint
        const shiftsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHIFTS}?user_id=${userId}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_CONFIG.API_TOKEN}` },
        });
        
        let list = [];
        if (shiftsRes.ok) {
          const shiftsData = await shiftsRes.json();
          // Обрабатываем структуру ответа: { success: true, shifts: [...], total_count: 25, ... }
          if (shiftsData.success && Array.isArray(shiftsData.shifts)) {
            list = shiftsData.shifts;
          } else if (Array.isArray(shiftsData)) {
            list = shiftsData;
          } else if (Array.isArray(shiftsData?.results)) {
            list = shiftsData.results;
          }
        }
        
        // Фильтруем смены по месяцу для статистики
        const { start, end } = getMonthRange(monthOffset);
        const monthlyList = list.filter(shift => {
          const shiftDate = shift.shift_start || shift.date;
          if (!shiftDate) return false;
          const date = new Date(shiftDate);
          const monthStart = new Date(start);
          const monthEnd = new Date(end);
          return date >= monthStart && date <= monthEnd;
        });
        const total = monthlyList.length;
        let approved = 0;
        let approvedHours = 0;
        let appCount = 0;
        let suspicious = 0;
        const toHrs = (ms) => ms / (1000 * 60 * 60);
        for (const x of monthlyList) {
          const status = (x.shift_status || x.status || '').toString().toLowerCase();
          const isApproved = status.includes('approved') || status.includes('normal') || status.includes('утверж');
          if (isApproved) approved += 1;
          let hrs = x.shift_duration || x.shift_duration_hours || x.duration_hours || null;
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

  // Загрузка всех смен пользователя для отображения в таблице
  useEffect(() => {
    console.log('[MainScreen] fetchUserShifts useEffect triggered, currentUser:', currentUser);
    const fetchUserShifts = async () => {
      try {
        const userId = currentUser?.user_id;
        console.log('[MainScreen] fetchUserShifts: userId =', userId);
        if (!userId) {
          console.log('[MainScreen] fetchUserShifts: no userId, skipping');
          return;
        }
        
        console.log('[MainScreen] fetchUserShifts: starting for userId:', userId);
        const { API_CONFIG } = require('../config/api');
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SHIFTS}?user_id=${encodeURIComponent(userId)}&aggregate=1`;
        console.log('[MainScreen] fetchUserShifts: URL:', url);
        console.log('[MainScreen] fetchUserShifts: API_TOKEN:', API_CONFIG.API_TOKEN);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${API_CONFIG.API_TOKEN}`
          }
        });
        
        console.log('[MainScreen] fetchUserShifts: response status:', res.status);
        console.log('[MainScreen] fetchUserShifts: response headers:', res.headers);
        
        if (res.ok) {
          const data = await res.json();
          console.log('[MainScreen] fetchUserShifts: received data:', data);
          
          // Обрабатываем структуру ответа:
          // - агрегированный ответ: { success: true, aggregate: true, items: [...] }
          // - или старые схемы: { success: true, shifts: [...] } | { results: [...] } | [...]
          let shifts = [];
          if (data.aggregate && Array.isArray(data.items)) {
            // Нормализуем агрегированные элементы под текущий рендер списка
            shifts = data.items.map((it) => ({
              // используем дату дня как начало смены для отображения
              shift_start: it.date ? `${it.date}T00:00:00Z` : null,
              // длительность часов берём из total_hours, чтобы отрендерилось в колонке часов
              duration_hours: typeof it.total_hours === 'number' ? it.total_hours : null,
              // сохраняем агрегированные поля на будущее
              date: it.date,
              day_hours: it.day_hours,
              night_hours: it.night_hours,
              day_shifts_count: it.day_shifts_count,
              night_shifts_count: it.night_shifts_count,
              is_aggregate: true,
            }));
          } else if (data.success && Array.isArray(data.shifts)) {
            shifts = data.shifts;
          } else if (Array.isArray(data)) {
            shifts = data;
          } else if (Array.isArray(data?.results)) {
            shifts = data.results;
          }
          
          // Сортируем смены от самого позднего к раннему
          const sortedShifts = sortShiftsByDate([...shifts]);
          console.log('[MainScreen] fetchUserShifts: processed shifts:', sortedShifts.length, 'items');
          setShiftsList(sortedShifts);
        } else {
          console.log('[MainScreen] fetchUserShifts: response not ok:', res.status, res.statusText);
          try {
            const errorText = await res.text();
            console.log('[MainScreen] fetchUserShifts: error response body:', errorText);
          } catch (e) {
            console.log('[MainScreen] fetchUserShifts: failed to read error response:', e);
          }
        }
      } catch (error) {
        console.log('[MainScreen] Error fetching user shifts:', error);
      }
    };
    
    fetchUserShifts();
  }, [currentUser]);

  // Список отсутствующих разрешений/состояний для badge
  const missingBadges = [];
  if (!indicators.permission) missingBadges.push({ key: 'permission', label: 'Гео‑разрешения', onPress: requestBackgroundLocationTwoClicks });
  if (!indicators.gps) missingBadges.push({ key: 'gps', label: 'GPS', onPress: () => Linking.openSettings().catch(() => {}) });
  if (!indicators.network) missingBadges.push({ key: 'network', label: 'Сеть', onPress: () => Linking.openSettings().catch(() => {}) });
  if (!indicators.battery) missingBadges.push({ key: 'battery', label: 'Энергосбережение', onPress: requestBatteryOptimization });
  if (!indicators.notifications) missingBadges.push({ key: 'notifications', label: 'Уведомления', onPress: checkNotificationsPermissionOnAppActive });


  return (
    <PaperProvider>
      <SafeAreaView style={styles.container}>
        {/* Appbar из React Native Paper вместо черной полоски */}
        <Appbar.Header style={styles.appbarHeader}>
          {/* <Appbar.Content title={missingBadges.length > 0 && (
              <TouchableOpacity onPress={() => setShowHeaderBadges(v => !v)} style={styles.appbarBadge} accessibilityLabel="Проблемы с доступами">
                <Text style={styles.appbarBadgeText}>!</Text>
              </TouchableOpacity>
          )} titleStyle={styles.appbarTitle} />          */}
          <View style={styles.appbarRightContent}>

            <Chip 
              mode="flat"
              style={[
                styles.statusChip,
                { 
                  backgroundColor: userStatus === WorkerStatus.WORKING ? 'rgba(76, 175, 80, 0.8)' : 
                                  (userStatus === WorkerStatus.BLOCKED || userStatus === WorkerStatus.FIRED) ? 'rgba(244, 67, 54, 0.8)' : 'rgba(255, 152, 0, 0.8)'
                }
              ]}
              textStyle={styles.statusChipText}
            >
              {humanizeStatus(userStatus)}
            </Chip>

            <Text style={styles.appbarUserName} numberOfLines={1}>
              {currentUser ? (currentUser?.user_lname + ' ' + currentUser?.user_fname.charAt(0) + '.' + currentUser?.user_mname.charAt(0) + '.' || 'Пользователь') : 'Загрузка...'}
            </Text>
            <Appbar.Action 
              icon="account-circle" 
              onPress={() => setMenuModalVisible(true)}
              accessibilityLabel="Профиль"
            />
          </View>
        </Appbar.Header>

        {/* Уведомление о заблокированном пользователе */}
        {userStatus === WorkerStatus.BLOCKED && (
          <Card style={{ 
            margin: 16, 
            backgroundColor: '#FFEBEE', 
            borderLeftWidth: 4, 
            borderLeftColor: '#F44336' 
          }}>
            <Card.Content style={{ paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconButton 
                  icon="lock" 
                  size={24} 
                  iconColor="#F44336" 
                  style={{ margin: 0, marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ 
                    color: '#D32F2F', 
                    fontSize: 16, 
                    fontWeight: '700',
                    marginBottom: 4
                  }}>
                    Пользователь заблокирован
                  </Text>
                  <Text style={{ 
                    color: '#B71C1C', 
                    fontSize: 14,
                    lineHeight: 20
                  }}>
                    Ваш пользователь был заблокирован администратором. Обратитесь к администратору для разблокировки.
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Уведомление о разрешениях */}
        {(!indicators.permission || !indicators.battery || !indicators.notifications) && (
          <TouchableOpacity 
            onPress={handlePermissionsDialog}
            activeOpacity={0.7}
          >
            <Card style={{ 
              margin: 12, 
              backgroundColor: '#FFF3E0', 
              borderLeftWidth: 4, 
              borderLeftColor: '#FF9800',
              elevation: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
            }}>
              <Card.Content style={{ paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconButton 
                    icon="shield-alert" 
                    size={24} 
                    iconColor="#FF9800" 
                    style={{ margin: 0, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      color: '#E65100', 
                      fontSize: 16, 
                      fontWeight: '700',
                      marginBottom: 4
                    }}>
                      Включите все разрешения
                    </Text>
                    <Text style={{ 
                      color: '#BF360C', 
                      fontSize: 14,
                      lineHeight: 20
                    }}>
                      Нажмите для настройки всех необходимых разрешений
                      {__DEV__ && ` (Debug: perm=${indicators.permission}, bat=${indicators.battery}, notif=${indicators.notifications})`}
                    </Text>
                  </View>
                  <IconButton 
                    icon="chevron-right" 
                    size={20} 
                    iconColor="#FF9800" 
                    style={{ margin: 0 }}
                  />
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}

        {/* Dev режим - тестовое уведомление о разрешениях */}
        {__DEV__ && (
          <TouchableOpacity 
            onPress={handlePermissionsDialog}
            activeOpacity={0.7}
          >
            <Card style={{ 
              margin: 12, 
              backgroundColor: '#E3F2FD', 
              borderLeftWidth: 4, 
              borderLeftColor: '#2196F3',
              elevation: 1,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 1,
            }}>
              <Card.Content style={{ paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IconButton 
                    icon="bug" 
                    size={20} 
                    iconColor="#2196F3" 
                    style={{ margin: 0, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      color: '#1976D2', 
                      fontSize: 14, 
                      fontWeight: '700',
                      marginBottom: 2
                    }}>
                      DEV: Тест разрешений
                    </Text>
                    <Text style={{ 
                      color: '#1565C0', 
                      fontSize: 12,
                      lineHeight: 16
                    }}>
                      Нажмите для тестирования диалогов разрешений
                      {` (perm=${indicators.permission}, bat=${indicators.battery}, notif=${indicators.notifications})`}
                    </Text>
                  </View>
                  <IconButton 
                    icon="chevron-right" 
                    size={16} 
                    iconColor="#2196F3" 
                    style={{ margin: 0 }}
                  />
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}

        {/* Выпадающее меню профиля */}
        {menuModalVisible && (
          <View style={styles.menuOverlay}>
            <TouchableOpacity 
              style={styles.menuOverlayTouchable} 
              activeOpacity={1} 
              onPress={() => setMenuModalVisible(false)}
            />
            <View style={styles.menuContainer}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setMenuModalVisible(false);
                  guardedAlert('Профиль', 'Функция просмотра профиля будет добавлена позже', [
                    { text: 'OK', style: 'default' }
                  ]);
                }}
              >
                <Icon source="account" size={20} color={colors.textPrimary} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>Посмотреть профиль</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  setMenuModalVisible(false);
                  handleLogout();
                }}
              >
                <Icon source="logout" size={20} color={colors.buttonLogout} style={styles.menuItemIcon} />
                <Text style={[styles.menuItemText, styles.menuLogoutText]}>Выход</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refreshAllData();
              } finally {
                setRefreshing(false);
              }
            }}
            colors={['#4CAF50']} // Android
            tintColor="#4CAF50" // iOS
            title="Обновление..." // iOS
            titleColor="#666" // iOS
          />
        }
      >

        <View style={[styles.statusCard]}>
          <Chip
            style={[
              styles.statusIndicator,
              styles.statusIndicatorFullWidth,
              isShiftActive ? styles.activeStatus : styles.inactiveStatus
            ]}
            textStyle={[
              styles.statusText,
              isShiftActive ? styles.statusTextActive : styles.statusTextInactive
            ]}
            icon={isShiftActive ? "check-circle" : "close-circle"}
            mode="outlined"
            selected={isShiftActive}
          >
            {isShiftActive ? 'Смена активна' : 'Смена не активна'}
          </Chip>
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
              <Text style={styles.detailLabel}>Продолжительность</Text>
              <Text style={styles.detailValue}>{formatHours(shiftDuration)}</Text>
            </View>
          </View>
        </View>
        {/* Таблица смен пользователя */}
        <View style={[styles.statusCard]}>
          <Text style={styles.statusTitle}>Ваши смены</Text>
          <ScrollView horizontal>
            <View>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 6 }}>
                <Text style={{ width: 100, fontWeight: '700', fontSize: 14 }}>Дата</Text>
                <Text style={{ width: 90, fontWeight: '700', fontSize: 14 }}>Часы</Text>
                <Text style={{ width: 120, fontWeight: '700', fontSize: 14 }}>Утверждено</Text>
              </View>
              {shiftsList && shiftsList.length > 0 ? (
                shiftsList.map((shift, idx) => {
                  // Вычисляем общее количество часов из новой структуры
                  let totalHours = shift.shift_duration || shift.shift_duration_hours || shift.duration_hours || null;
                  if (totalHours == null && shift.shift_start && shift.shift_end) {
                    const start = new Date(shift.shift_start).getTime();
                    const end = new Date(shift.shift_end).getTime();
                    if (!isNaN(start) && !isNaN(end) && end > start) {
                      totalHours = (end - start) / (1000 * 60 * 60);
                    }
                  }
                  
                  // Определяем утвержденные часы
                  const status = (shift.shift_status || shift.status || '').toString().toLowerCase();
                  const isApproved = status.includes('approved') || status.includes('normal') || status.includes('утверж');
                  const approvedHours = isApproved && typeof totalHours === 'number' ? totalHours : 0;
                  
                  return (
                    <View key={shift.shift_id || shift.id || idx} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f5f5f5' }}>
                      <Text style={{ width: 100 }}>{formatDate(shift.shift_start)}</Text>
                      <Text style={{ width: 90 }}>{formatHours(totalHours)}</Text>
                      <Text style={{ width: 120 }}>{formatHours(approvedHours)}</Text>
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: '#888', fontSize: 14 }}>Нет данных о сменах</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        <View style={styles.actions}>
          {!isShiftActive ? (
            canStartShift(userStatus) ? (
              <View />
            ) : (
              <View>
                {userStatus === WorkerStatus.FIRED && (
                  <Card style={{ 
                    marginBottom: 10, 
                    backgroundColor: '#FFF3E0', 
                    borderLeftWidth: 4, 
                    borderLeftColor: '#FF9800' 
                  }}>
                    <Card.Content style={{ paddingVertical: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconButton 
                          icon="account-remove" 
                          size={20} 
                          iconColor="#FF9800" 
                          style={{ margin: 0, marginRight: 8 }}
                        />
                        <Text style={{ 
                          color: '#E65100', 
                          fontSize: 14, 
                          fontWeight: '600',
                          flex: 1
                        }}>
                          Ваш пользователь уволен
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                )}
              </View>
            )
          ) : (
            <View />
          )}
        </View>

        {/* Кнопка показа количества накопленных точек под блоком смены - только для дебаг */}
        {__DEV__ && (
          <View style={{ marginBottom: 16 }}>
            <PaperButton
              mode="outlined"
              icon="chart-line"
              onPress={handleShowQueuedPoints}
              style={styles.queuedButton}
              accessibilityLabel="Показать количество накопленных точек"
            >
              Накопленные точки
            </PaperButton>
          </View>
        )}

        {/* Кнопка выхода перенесена в шапку */}
      </ScrollView>
      {/* Селфи-модал отключен */}

      {/* Фиксированные нижние кнопки открытия/закрытия смены */}
      {!isShiftActive && canStartShift(userStatus) && (
        <View style={styles.fabContainer} pointerEvents={isLoading ? 'none' : 'auto'}>
          <FAB
            icon="play"
            label="Открыть смену"
            onPress={handlePunchIn}
            disabled={isLoading}
            loading={isLoading}
            style={[styles.fabButton, { backgroundColor: '#4CAF50' }]}
            accessibilityLabel="Открыть смену"
          />
        </View>
      )}
      {isShiftActive && (
        <View style={styles.fabContainer} pointerEvents={isLoading ? 'none' : 'auto'}>
          <FAB
            icon="stop"
            label="Закрыть смену"
            onPress={handlePunchOut}
            disabled={isLoading}
            loading={isLoading}
            style={[styles.fabButtonClose, { backgroundColor: '#F44336' }]}
            accessibilityLabel="Закрыть смену"
          />
        </View>
      )}
      {!isShiftActive && userStatus === WorkerStatus.BLOCKED && (
        <View style={styles.fabContainer} pointerEvents={isLoading ? 'none' : 'auto'}>
          <FAB
            icon="lock-open"
            label="Запрос на разблокировку"
            onPress={handleRequestUnblock}
            disabled={isLoading}
            loading={isLoading}
            style={[styles.fabButton, { backgroundColor: '#FF9800' }]}
            accessibilityLabel="Отправить запрос на разблокировку"
          />
        </View>
      )}
      </SafeAreaView>
    </PaperProvider>
  );
};


export default MainScreen;