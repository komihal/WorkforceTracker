import React, { useState, useEffect } from 'react';
import { SafeAreaView, Text, BackHandler } from 'react-native';
import LoginScreen from './src/components/LoginScreen';
import MainScreen from './src/components/MainScreen';
import authService from './src/services/authService';
import { initLocation, resetLocationInit } from './src/location';
import { Alert } from 'react-native';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    console.log('===== APP USEFFECT CALLED =====');
    console.log('Current screen:', currentScreen);

    const onBackPress = () => {
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
        setCurrentScreen('main');
        
        // Инициализируем геолокацию для существующего пользователя
        console.log('Initializing location tracking for existing user...');
        console.log('User data:', user);
        try {
          // Сначала сбрасываем состояние
          console.log('Calling resetLocationInit...');
          await resetLocationInit();
          console.log('resetLocationInit completed');
          
          // Затем инициализируем
          console.log('Calling initLocation...');
          await initLocation();
          console.log('Location initialization completed');
          
          // BackgroundService отключен для избежания дублирования отправок
          console.log('BackgroundService disabled to prevent duplicate location sending');
        } catch (locationError) {
          console.error('Location initialization failed:', locationError);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (userData) => {
    setCurrentScreen('main');
    
    // Инициализируем геолокацию для нового пользователя
    console.log('Initializing location tracking for new user...');
    try {
      // Сначала сбрасываем состояние
      console.log('Calling resetLocationInit for new user...');
      await resetLocationInit();
      console.log('resetLocationInit completed for new user');
      
      // Затем инициализируем
      console.log('Calling initLocation for new user...');
      await initLocation();
      console.log('Location initialization completed for new user');
      
      // BackgroundService отключен для избежания дублирования отправок
      console.log('BackgroundService disabled to prevent duplicate location sending');
    } catch (locationError) {
      console.error('Location initialization failed:', locationError);
    }
  };

  const handleLogout = () => {
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
          <MainScreen 
            onLogout={handleLogout}
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
