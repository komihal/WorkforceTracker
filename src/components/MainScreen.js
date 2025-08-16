import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import authService from '../services/authService';
import punchService from '../services/punchService';
import geoService from '../services/geoService';
import fileUploadService from '../services/fileUploadService';
import cameraService from '../services/cameraService';

const MainScreen = ({ onLogout, onNavigateToDeviceInfo, onNavigateToPhotoGallery, onNavigateToCameraTest }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [geoDataCount, setGeoDataCount] = useState(0);
  const [lastLocation, setLastLocation] = useState(null);

  useEffect(() => {
    const loadUserData = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        checkWorkerStatus(user.user_id || 123);
      }
    };
    loadUserData();
  }, []);

  // Проверка статуса работника
  const checkWorkerStatus = async (userId) => {
    try {
      const result = await punchService.getWorkerStatus(userId);
      if (result.success) {
        setIsShiftActive(result.data.is_working || false);
      }
    } catch (error) {
      console.error('Error checking worker status:', error);
    }
  };

  // Начало смены
  const handlePunchIn = async () => {
    if (!currentUser) {
      Alert.alert('Ошибка', 'Пользователь не найден');
      return;
    }

    setIsLoading(true);
    try {
      // Делаем фото для начала смены
      let photoResult = await cameraService.takePhoto();
      
      // Если камера недоступна и предлагается галерея, пробуем галерею
      if (!photoResult.success && photoResult.suggestGallery) {
        const galleryResult = await cameraService.selectPhoto();
        if (galleryResult.success) {
          photoResult = galleryResult;
        }
      }
      
      if (!photoResult.success) {
        Alert.alert('Предупреждение', 'Фото не было сделано, но смена может быть начата');
      }

      // Получаем текущую геолокацию
      const location = await geoService.getCurrentLocation();
      setLastLocation(location);

      // Добавляем геопозицию
      geoService.addGeoPoint(
        location.latitude,
        location.longitude,
        location.altitude,
        location.altitude + 5, // Пример altmsl
        true,
        true,
        false,
        1.5
      );

      // Выполняем punch in
      const result = await punchService.punchIn(
        currentUser.user_id || 123,
        '123456789012345', // IMEI (в реальном приложении получать с устройства)
        photoResult.success ? photoResult.data.fileName : 'start_shift.jpg'
      );

      if (result.success) {
        setIsShiftActive(true);
        Alert.alert('Успех', 'Смена начата!');
        updateGeoDataCount();
        
        // Если фото было сделано, загружаем его
        if (photoResult.success) {
          try {
            await fileUploadService.uploadPhoto(
              photoResult.data.uri,
              currentUser.user_id || 123,
              1, // place_id
              '123456789012345', // IMEI
              'start-shift'
            );
          } catch (uploadError) {
            console.error('Photo upload error:', uploadError);
          }
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

    setIsLoading(true);
    try {
      // Делаем фото для завершения смены
      let photoResult = await cameraService.takePhoto();
      
      // Если камера недоступна и предлагается галерея, пробуем галерею
      if (!photoResult.success && photoResult.suggestGallery) {
        const galleryResult = await cameraService.selectPhoto();
        if (galleryResult.success) {
          photoResult = galleryResult;
        }
      }
      
      if (!photoResult.success) {
        Alert.alert('Предупреждение', 'Фото не было сделано, но смена может быть завершена');
      }

      // Получаем текущую геолокацию
      const location = await geoService.getCurrentLocation();
      setLastLocation(location);

      // Добавляем финальную геопозицию
      geoService.addGeoPoint(
        location.latitude,
        location.longitude,
        location.altitude,
        location.altitude + 5,
        true,
        true,
        false,
        1.5
      );

      // Выполняем punch out
      const result = await punchService.punchOut(
        currentUser.user_id || 123,
        '123456789012345',
        photoResult.success ? photoResult.data.fileName : 'end_shift.jpg'
      );

      if (result.success) {
        setIsShiftActive(false);
        Alert.alert('Успех', 'Смена завершена!');
        
        // Если фото было сделано, загружаем его
        if (photoResult.success) {
          try {
            await fileUploadService.uploadPhoto(
              photoResult.data.uri,
              currentUser.user_id || 123,
              1, // place_id
              '123456789012345', // IMEI
              'end-shift'
            );
          } catch (uploadError) {
            console.error('Photo upload error:', uploadError);
          }
        }
        
        // Сохраняем все собранные геоданные
        await saveGeoData();
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
        '123456789012345' // IMEI
      );

      if (result.success) {
        Alert.alert('Успех', 'Геоданные сохранены!');
        updateGeoDataCount();
      } else {
        Alert.alert('Ошибка', result.error);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить геоданные');
    }
  };

  // Обновление счетчика геоданных
  const updateGeoDataCount = () => {
    setGeoDataCount(geoService.getGeoDataCount());
  };

  // Добавление новой геопозиции
  const addGeoPoint = async () => {
    try {
      // Делаем фото для геопозиции
      let photoResult = await cameraService.takePhoto();
      
      // Если камера недоступна и предлагается галерея, пробуем галерею
      if (!photoResult.success && photoResult.suggestGallery) {
        const galleryResult = await cameraService.selectPhoto();
        if (galleryResult.success) {
          photoResult = galleryResult;
        }
      }
      
      if (!photoResult.success) {
        Alert.alert('Предупреждение', 'Фото не было сделано, но геопозиция может быть добавлена');
      }

      const location = await geoService.getCurrentLocation();
      setLastLocation(location);

      geoService.addGeoPoint(
        location.latitude,
        location.longitude,
        location.altitude,
        location.altitude + 5,
        true,
        true,
        false,
        1.5
      );

      updateGeoDataCount();
      Alert.alert('Успех', 'Геопозиция добавлена!');
      
      // Если фото было сделано, загружаем его
      if (photoResult.success) {
        try {
          await fileUploadService.uploadPhoto(
            photoResult.data.uri,
            currentUser.user_id || 123,
            1, // place_id
            '123456789012345', // IMEI
            'geo-point'
          );
        } catch (uploadError) {
          console.error('Photo upload error:', uploadError);
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось получить геопозицию');
    }
  };

  // Выход из системы
  const handleLogout = async () => {
    try {
      await authService.logout();
      onLogout();
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти из системы');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Workforce Tracker</Text>
          <Text style={styles.subtitle}>
            {currentUser ? `Пользователь: ${currentUser.user_login || 'Тест'}` : 'Загрузка...'}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Статус смены</Text>
          <View style={[styles.statusIndicator, isShiftActive ? styles.activeStatus : styles.inactiveStatus]}>
            <Text style={styles.statusText}>
              {isShiftActive ? 'Смена активна' : 'Смена неактивна'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {!isShiftActive ? (
            <TouchableOpacity
              style={[styles.button, styles.punchInButton, isLoading && styles.buttonDisabled]}
              onPress={handlePunchIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Начать смену</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.punchOutButton, isLoading && styles.buttonDisabled]}
              onPress={handlePunchOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Завершить смену</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.geoSection}>
          <Text style={styles.sectionTitle}>Геолокация</Text>
          
          <View style={styles.geoInfo}>
            <Text style={styles.geoText}>Собрано точек: {geoDataCount}</Text>
            {lastLocation && (
              <Text style={styles.geoText}>
                Последняя позиция: {lastLocation.latitude.toFixed(6)}, {lastLocation.longitude.toFixed(6)}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={addGeoPoint}
          >
            <Text style={styles.buttonText}>Добавить геопозицию</Text>
          </TouchableOpacity>

          {geoDataCount > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={saveGeoData}
            >
              <Text style={styles.buttonText}>Сохранить геоданные</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomButtons}>
          <TouchableOpacity
            style={[styles.button, styles.deviceInfoButton]}
            onPress={onNavigateToDeviceInfo}
          >
            <Text style={styles.buttonText}>Информация об устройстве</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.photoGalleryButton]}
            onPress={onNavigateToPhotoGallery}
          >
            <Text style={styles.buttonText}>📸 Фотогалерея</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cameraTestButton]}
            onPress={onNavigateToCameraTest}
          >
            <Text style={styles.buttonText}>🧪 Тест Камеры</Text>
          </TouchableOpacity>

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
    marginBottom: 30,
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
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
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
  geoButton: {
    backgroundColor: '#2196F3',
  },
  saveButton: {
    backgroundColor: '#FF9800',
  },
  logoutButton: {
    backgroundColor: '#9E9E9E',
  },
  deviceInfoButton: {
    backgroundColor: '#9C27B0',
  },
  photoGalleryButton: {
    backgroundColor: '#FF5722',
  },
  cameraTestButton: {
    backgroundColor: '#9C27B0',
  },

  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  geoSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  geoInfo: {
    marginBottom: 15,
  },
  geoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
});

export default MainScreen;
