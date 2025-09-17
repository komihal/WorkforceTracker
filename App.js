import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, Text, BackHandler, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/components/LoginScreen';
import MainScreen from './src/components/MainScreen';
import StatsScreen from './src/components/StatsScreen';
// import BottomTabs from './src/components/BottomTabs';
import authService from './src/services/authService';
import punchService from './src/services/punchService';
import deviceUtils from './src/utils/deviceUtils';
import { initBgGeo, startTracking, getLicenseInfo } from './src/location.js';
import backgroundService from './src/services/backgroundService';
import { getGeoConfig } from './src/config/geoConfig';
import { Alert } from 'react-native';
import { ensureBgStarted } from './src/bg/trackingController';
import { initAppStateListener, cleanupAppStateListener } from './src/services/permissionsService';
import { useShiftStore, initShiftStore } from './src/store/shiftStore';
import { guardedAlert } from './src/ui/alert';

export default function App() {
  console.log('[APP] App component started');
  const [currentScreen, setCurrentScreen] = useState('login');
  const [currentTab, setCurrentTab] = useState('main');
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const hasActive = useShiftStore(s => s.isActive);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    console.log('[APP] FIRST useEffect started');
    console.log('[APP] useEffect started');
    (async () => {
      console.log('[APP] async function started');
      try {
        console.log('[APP] Starting initBgGeo...');
        await initBgGeo();
        console.log('[APP] initBgGeo completed successfully');
        
        // Удаляем принудительную регистрацию heartbeat и ручные отправки — используем uploader BGGeo
        
        // короткая задержка, чтобы успели подняться контексты
        setTimeout(() => ensureBgStarted("app_boot"), 1500);

        // Удалён JavaScript setInterval для отправки — полагаемся на native uploader
      } catch (error) {
        console.log('[APP] Error in useEffect:', error?.message || error);
      }
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        const lic = getLicenseInfo();
        if (!lic.initSucceeded) {
          await initBgGeo();
        }
      }
      appState.current = next;
    });

    // Инициализируем слушатель AppState для сброса флага диалога разрешений
    initAppStateListener();
    
    return () => {
      sub.remove();
      cleanupAppStateListener();
    };
  }, []);

  useEffect(() => {
    checkAuthStatus();
    // Гидратация стора смены на старте
    initShiftStore().catch(() => {});
  }, []);

  useEffect(() => {
    console.log('===== APP USEFFECT CALLED ===== MODIFIED');
    console.log('Current screen:', currentScreen);

    const onBackPress = () => {
      try {
        if (currentScreen === 'main' && hasActive) {
          console.log('[BackHandler] Blocked due to active shift (store)');
          guardedAlert('Смена активна', 'Закройте смену перед выходом из приложения.', [
            { text: 'Остаться', style: 'cancel' },
          ]);
          return true;
        }
      } catch {}
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentScreen, hasActive]);

  // Обработчик состояния приложения для автоматического закрытия смены
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      console.log('App state changed to:', nextAppState);
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Приложение уходит в фон или становится неактивным
        console.log('App going to background - auto-close DISABLED for testing');
        
        // ВРЕМЕННО ОТКЛЮЧЕНО для тестирования
        // try {
        //   const currentUser = await authService.getCurrentUser();
        //   if (currentUser && currentUser.user_id) {
        //     console.log('App going to background - checking if shift is active...');
        //     
        //     // Проверяем, активна ли смена
        //     const shiftResult = await punchService.getShiftStatus(currentUser.user_id);
        //     if (shiftResult.success && shiftResult.data.shift_active) {
        //       console.log('Shift is active, auto-closing...');
        //       
        //       // Останавливаем отслеживание геолокации
        //       // TODO: Добавить функцию остановки BG Geo
        //       
        //       // Автоматически закрываем смену
        //       const phoneImei = await deviceUtils.getDeviceId();
        //       const autoPunchResult = await punchService.autoPunchOut(currentUser.user_id, phoneImei);
        //       
        //       if (autoPunchResult.success) {
        //         console.log('Shift auto-closed successfully');
        //       } else {
        //         console.error('Failed to auto-close shift:', autoPunchResult.error);
        //       }
        //     } else {
        //       console.log('Shift is not active, no need to close');
        //     }
        //   }
        // } catch (error) {
        //   console.error('Error in app state change handler:', error);
        // }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Обновление состояния смены при смене вкладок
  useEffect(() => {
    const refreshShiftStatusOnTabChange = async () => {
      if (currentTab === 'main' && currentUser?.user_id) {
        try {
          console.log('[App] Refreshing shift status on tab change to main...');
          const { forceRefreshShiftStatus } = require('./src/services/shiftStatusService');
          const status = await forceRefreshShiftStatus(currentUser.user_id);
          
          console.log('[App] Shift status refreshed on tab change:', status);
        } catch (e) {
          console.log('[App] Failed to refresh status on tab change:', e?.message || e);
        }
      }
    };

    refreshShiftStatusOnTabChange();
  }, [currentTab, currentUser?.user_id]);

  const checkAuthStatus = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setCurrentScreen('main');
        
        // Инициализируем BG Geolocation для существующего пользователя
        console.log('Initializing BG Geolocation for existing user...');
        console.log('User data:', user);
        try {
          // Инициализируем новый единый модуль BG Geo
          console.log('Calling initBgGeo...');
          await initBgGeo();
          console.log('BG Geolocation initialization completed');
          
          // Стартуем трекинг с userId
          await startTracking(user.user_id);
          
          // Инициализируем backgroundService только для фото
          console.log('Initializing backgroundService for photos only...');
          const phoneImei = await deviceUtils.getDeviceId();
          await backgroundService.initialize(user.user_id, 1, phoneImei, __DEV__);
          console.log('BackgroundService initialization completed (photos only)');
        } catch (locationError) {
          console.error('BG Geolocation initialization failed:', locationError);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (userData) => {
    setCurrentUser(userData);
    setCurrentScreen('main');
    
    // Инициализируем BG Geolocation для нового пользователя
    console.log('Initializing BG Geolocation for new user...');
    try {
      // Инициализируем новый единый модуль BG Geo
      console.log('Calling initBgGeo for new user...');
      await initBgGeo();
      console.log('BG Geolocation initialization completed for new user');
      
      // Стартуем трекинг с userId
      await startTracking(userData.user_id);
      
      // Инициализируем backgroundService только для фото
      console.log('Initializing backgroundService for photos only...');
      const phoneImei = await deviceUtils.getDeviceId();
      await backgroundService.initialize(userData.user_id, 1, phoneImei, __DEV__);
      console.log('BackgroundService initialization completed (photos only)');
    } catch (locationError) {
      console.error('BG Geolocation initialization failed:', locationError);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('login');
  };



  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 18 }}>Загрузка...</Text>
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
      case 'main':
        return (
          <>
            {currentTab === 'main' && <MainScreen onLogout={handleLogout} />}
            {currentTab === 'stats' && <StatsScreen userId={null} />}
            {/* profile tab можно подключить позже */}
            {/* <BottomTabs current={currentTab} onChange={setCurrentTab} /> */}
          </>
        );
      default:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        {renderScreen()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
