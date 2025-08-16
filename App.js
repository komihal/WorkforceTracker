import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';
import LoginScreen from './src/components/LoginScreen';
import MainScreen from './src/components/MainScreen';
import DeviceInfoScreen from './src/components/DeviceInfoScreen';
import PhotoGalleryScreen from './src/components/PhotoGalleryScreen';
import CameraTestScreen from './src/components/CameraTestScreen';
import authService from './src/services/authService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setCurrentScreen('main');
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
