import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet, BackHandler } from 'react-native';
import LoginScreen from './src/components/LoginScreen';
import MainScreen from './src/components/MainScreen';
import DeviceInfoScreen from './src/components/DeviceInfoScreen';
import PhotoGalleryScreen from './src/components/PhotoGalleryScreen';
import CameraTestScreen from './src/components/CameraTestScreen';
import BgGeoTestScreen from './src/components/BgGeoTestScreen';
import authService from './src/services/authService';
import backgroundService from './src/services/backgroundService';
import { initLocation } from './src/location';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    // Инициализируем фоновой геотрекинг (прочитает ключи из .env)
    initLocation();
    
    // Инициализируем BackgroundService для работы в фоне
    const initBackgroundService = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          console.log('Initializing BackgroundService for existing user:', user.user_id);
          await backgroundService.initialize(
            user.user_id,
            1, // place_id по умолчанию
            '123456789012345', // IMEI по умолчанию
            __DEV__ // тестовый режим в dev
          );
        }
      } catch (error) {
        console.log('BackgroundService not initialized (no user):', error.message);
      }
    };
    
    initBackgroundService();

    const onBackPress = () => {
      if (currentScreen === 'photoGallery' || currentScreen === 'deviceInfo' || currentScreen === 'cameraTest' || currentScreen === 'bgGeoTest') {
        setCurrentScreen('main');
        return true; // Обрабатываем "назад" сами
      }
      // Для экранам 'main' и 'login' используем поведение по умолчанию (выход из приложения)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentScreen]);

  const checkAuthStatus = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setCurrentScreen('main');
        
        // Инициализируем BackgroundService для существующего пользователя
        try {
          console.log('Initializing BackgroundService for existing user:', user.user_id);
          await backgroundService.initialize(
            user.user_id,
            1, // place_id по умолчанию
            '123456789012345', // IMEI по умолчанию
            __DEV__ // тестовый режим в dev
          );
        } catch (error) {
          console.log('BackgroundService initialization error:', error.message);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setCurrentScreen('main');
    
    // Инициализируем BackgroundService для нового пользователя
    const initService = async () => {
      try {
        console.log('Initializing BackgroundService for new user:', userData.user_id);
        await backgroundService.initialize(
          userData.user_id,
          1, // place_id по умолчанию
          '123456789012345', // IMEI по умолчанию
          __DEV__ // тестовый режим в dev
        );
      } catch (error) {
        console.log('BackgroundService initialization error:', error.message);
      }
    };
    
    initService();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('login');
  };

  const navigateToDeviceInfo = () => {
    setCurrentScreen('deviceInfo');
  };

  const navigateToMain = () => {
    setCurrentScreen('main');
  };

  const navigateToPhotoGallery = () => {
    setCurrentScreen('photoGallery');
  };

  const navigateToCameraTest = () => {
    setCurrentScreen('cameraTest');
  };

  const navigateToBgGeoTest = () => {
    setCurrentScreen('bgGeoTest');
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
          <MainScreen 
            onLogout={handleLogout} 
            onNavigateToDeviceInfo={navigateToDeviceInfo}
            onNavigateToPhotoGallery={navigateToPhotoGallery}
            onNavigateToCameraTest={navigateToCameraTest}
            onNavigateToBgGeoTest={navigateToBgGeoTest}
          />
        );
      case 'deviceInfo':
        return (
          <DeviceInfoScreen 
            onBack={navigateToMain}
          />
        );
      case 'photoGallery':
        return (
          <PhotoGalleryScreen 
            onBack={navigateToMain}
            userId={currentUser?.user_id || 123}
          />
        );
      case 'cameraTest':
        return (
          <CameraTestScreen 
            onBack={navigateToMain}
          />
        );
      case 'bgGeoTest':
        return (
          <BgGeoTestScreen 
            onBack={navigateToMain}
          />
        );
      default:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {renderScreen()}
    </SafeAreaView>
  );
}
