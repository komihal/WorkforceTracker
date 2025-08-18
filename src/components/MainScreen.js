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
import backgroundService from '../services/backgroundService';
import testAsyncStorage from '../../AsyncStorageTest';

const MainScreen = ({ onLogout, onNavigateToDeviceInfo, onNavigateToPhotoGallery, onNavigateToCameraTest }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [geoDataCount, setGeoDataCount] = useState(0);
  const [lastLocation, setLastLocation] = useState(null);
  const [backgroundStats, setBackgroundStats] = useState({ pendingPhotos: 0, pendingGeoData: 0, isRunning: false });

  useEffect(() => {
    const loadUserData = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('Loaded currentUser:', user);
        setCurrentUser(user);
        checkWorkerStatus(user.user_id || 123);
      }
    };
    loadUserData();

    // Обновляем статистику каждые 5 секунд
    const statsInterval = setInterval(() => {
      updateBackgroundStats();
    }, 2000);

    return () => clearInterval(statsInterval);
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
      // Требуем фото (камера или, если недоступна, галерея)
      let photoResult = await cameraService.takePhoto();

      if (!photoResult.success && photoResult.suggestGallery) {
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
      const photoNameIn = (photoResult.data?.fileName) || `start_shift_${Date.now()}.jpg`;
      const result = await punchService.punchIn(
        currentUser.user_id || 123,
        '123456789012345', // IMEI (в реальном приложении получать с устройства)
        photoNameIn
      );

            if (result.success) {
        setIsShiftActive(true);
        Alert.alert('Успех', 'Смена начата!');
        updateGeoDataCount();
        
        // Инициализируем фоновый сервис
        await backgroundService.initialize(
          currentUser.user_id || 123,
          1, // place_id
          '123456789012345' // IMEI
        );
        
        // Добавляем фото в очередь фонового сервиса
        try {
          await backgroundService.addPhotoToQueue(
            photoResult.data.uri,
            'start-shift'
          );
        } catch (error) {
          console.error('Error adding photo to queue:', error);
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
      // Требуем фото (камера или, если недоступна, галерея)
      let photoResult = await cameraService.takePhoto();

      if (!photoResult.success && photoResult.suggestGallery) {
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
      const photoNameOut = (photoResult.data?.fileName) || `end_shift_${Date.now()}.jpg`;
      const result = await punchService.punchOut(
        currentUser.user_id || 123,
        '123456789012345',
        photoNameOut
      );

      if (result.success) {
        setIsShiftActive(false);
        Alert.alert('Успех', 'Смена завершена!');
        
        // Добавляем фото в очередь и сразу выгружаем
        try {
          await backgroundService.addPhotoToQueue(
            photoResult.data.uri,
            'end-shift'
          );
          await backgroundService.forceUpload();
          await backgroundService.loadPendingData();
          updateBackgroundStats();
        } catch (error) {
          console.error('Error queuing/uploading end-shift photo:', error);
        }
        
        // Сохраняем все собранные геоданные (не блокируем UI)
        saveGeoData().finally(async () => {
          // После выгрузки останавливаем фоновые задачи
          backgroundService.stop();
          await backgroundService.loadPendingData();
          updateBackgroundStats();
        });
        // Разрешаем UI сразу, не дожидаясь фоновых завершений
        setIsLoading(false);
        return;
      } else {
        Alert.alert('Ошибка', result.error);
        setIsLoading(false);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось завершить смену');
      setIsLoading(false);
    } finally {}
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

  // Обновление статистики фонового сервиса
  const updateBackgroundStats = () => {
    const stats = backgroundService.getStats();
    setBackgroundStats(stats);
    console.log('Background stats:', stats);
  };

  // Добавление новой геопозиции
  const addGeoPoint = async () => {
    try {
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

  const displayName = currentUser
    ? [currentUser.user_lname, currentUser.user_fname, currentUser.user_mname]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Workforce Tracker</Text>
          <Text style={styles.subtitle}>
            {currentUser ? `Пользователь: ${displayName || '—'}` : 'Загрузка...'}
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

        <View style={styles.backgroundSection}>
          <Text style={styles.sectionTitle}>Фоновый сервис</Text>
          
          <View style={styles.backgroundInfo}>
            <Text style={styles.backgroundText}>
              Статус: {backgroundStats.isRunning ? '🟢 Активен' : '🔴 Неактивен'}
            </Text>
            <Text style={styles.backgroundText}>
              Фото в очереди: {backgroundStats.pendingPhotos}
            </Text>
            <Text style={styles.backgroundText}>
              Геоданные в очереди: {backgroundStats.pendingGeoData}
            </Text>
          </View>

          {backgroundStats.isRunning && (
            <TouchableOpacity
              style={[styles.button, styles.forceUploadButton]}
              onPress={async () => {
                await backgroundService.forceUpload();
                updateBackgroundStats();
              }}
            >
              <Text style={styles.buttonText}>Принудительная отправка</Text>
            </TouchableOpacity>
          )}

          {(
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={async () => {
                try {
                  // Временная отладка: очистка очередей
                  backgroundService.pendingPhotos = [];
                  backgroundService.pendingGeoData = [];
                  await backgroundService.savePendingData();
                  updateBackgroundStats();
                  Alert.alert('Готово', 'Очереди очищены');
                } catch (e) {
                  Alert.alert('Ошибка', 'Не удалось очистить очереди');
                }
              }}
            >
              <Text style={styles.buttonText}>Очистить очереди (отладка)</Text>
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
            style={[styles.button, styles.testButton]}
            onPress={testAsyncStorage}
          >
            <Text style={styles.buttonText}>🧪 Тест AsyncStorage</Text>
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
  forceUploadButton: {
    backgroundColor: '#E91E63',
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
  testButton: {
    backgroundColor: '#607D8B',
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
  backgroundSection: {
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
  backgroundInfo: {
    marginBottom: 15,
  },
  geoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  backgroundText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  bottomButtons: {
    flexDirection: 'column',
    gap: 10,
  },
});

export default MainScreen;
