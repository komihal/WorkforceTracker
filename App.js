import React, { useState, useEffect, useRef } from 'react';
import { Text, BackHandler, AppState } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './src/components/LoginScreen';
import MainScreen from './src/components/MainScreen';
import StatsScreen from './src/components/StatsScreen';
import authService from './src/services/authService';
import { initBgGeo, getLicenseInfo } from './src/location.js';
import { initBgGeoForUser, resetBgGeoInit } from './src/services/bgGeoInitService';
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
    (async () => {
      try {
        const existingUser = await authService.getCurrentUser();
        if (existingUser && existingUser.user_id) {
          console.log('[APP] Starting initBgGeo (user is logged in)...');
          await initBgGeo();
          console.log('[APP] initBgGeo completed successfully');
          setTimeout(() => ensureBgStarted('app_boot'), 1500);
        } else {
          console.log('[APP] Skip initBgGeo: no logged-in user');
        }
      } catch (error) {
        console.log('[APP] Error in useEffect:', error?.message || error);
      }
    })();

    const sub = AppState.addEventListener('change', async (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        try {
          const user = await authService.getCurrentUser();
          if (user && user.user_id) {
            const lic = getLicenseInfo();
            if (!lic.initSucceeded) {
              await initBgGeo();
            }
          }
        } catch {}
      }
      appState.current = next;
    });

    initAppStateListener();

    return () => {
      sub.remove();
      cleanupAppStateListener();
    };
  }, []);

  useEffect(() => {
    checkAuthStatus();
    initShiftStore().catch(() => {});
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      try {
        if (currentScreen === 'main' && hasActive) {
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

  // Обновление состояния смены при смене вкладок
  useEffect(() => {
    const refreshShiftStatusOnTabChange = async () => {
      if (currentTab === 'main' && currentUser?.user_id) {
        try {
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

        try {
          await initBgGeoForUser(user.user_id);
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

    try {
      await initBgGeoForUser(userData.user_id);
    } catch (locationError) {
      console.error('BG Geolocation initialization failed:', locationError);
    }
  };

  const handleLogout = () => {
    resetBgGeoInit();
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['left','right','bottom']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
          </>
        );
      default:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['left','right','bottom']} style={{ flex: 1 }}>
        {renderScreen()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
