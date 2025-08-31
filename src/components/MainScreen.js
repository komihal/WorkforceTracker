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
import { ensureAlwaysLocationPermission } from '../services/permissionsService';
import { canStartShift, humanizeStatus, normalizeStatus, WorkerStatus } from '../helpers/shift';
import { initLocation, getOneShotPosition, getBgGeoState, getLicenseInfo, getBgGeoLog, searchBgGeoLog, requestBgGeoPermission } from '../location';
import { runBgGeoSmokeTest } from '../tests/bggeoSmokeTest';

const MainScreen = ({ onLogout, onNavigateToDeviceInfo, onNavigateToPhotoGallery, onNavigateToCameraTest }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userStatus, setUserStatus] = useState(WorkerStatus.READY_TO_WORK);
  const [rawStatusData, setRawStatusData] = useState(null);
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

    // Инициализируем BackgroundGeolocation (BGG) при старте экрана
    (async () => {
      try {
        await initLocation();
      } catch (e) {
        try { console.log('initLocation error:', e); } catch (_) {}
      }
    })();

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
        const isWorking = !!result.data.is_working;
        const rawStatus = result.data.status || result.data.worker_status || result.data.status_text || result.data.worker_status_text || null;
        
        // Подробное логирование для отладки
        console.log('=== STATUS DEBUG ===');
        console.log('Raw API response:', result.data);
        console.log('isWorking flag:', isWorking);
        console.log('Raw status value:', rawStatus);
        console.log('Status type:', typeof rawStatus);
        console.log('All possible status fields:', {
          status: result.data.status,
          worker_status: result.data.worker_status,
          status_text: result.data.status_text,
          worker_status_text: result.data.worker_status_text,
          is_working: result.data.is_working
        });
        
        // Дополнительная проверка на заблокированный статус
        let forceBlocked = false;
        if (result.data.blocked === true || result.data.is_blocked === true || 
            result.data.access_denied === true || result.data.disabled === true) {
          forceBlocked = true;
          console.log('Force blocked detected from boolean flags');
        }
        
        const normalized = forceBlocked ? WorkerStatus.BLOCKED : normalizeStatus(rawStatus, isWorking);
        console.log('Normalized status:', normalized);
        console.log('Humanized status:', humanizeStatus(normalized));
        console.log('=== END STATUS DEBUG ===');
        
        setIsShiftActive(isWorking);
        setUserStatus(normalized);
        setRawStatusData(result.data);
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

    // Сначала проверяем статус рабочего
    try {
      const statusResult = await punchService.getWorkerStatus(currentUser.user_id || 123);
      if (!statusResult.success) {
        Alert.alert('Ошибка', 'Не удалось проверить статус рабочего.');
        return;
      }
      
      // Логируем полученные данные для отладки
      console.log('Worker status response:', statusResult.data);
      
      const isWorking = !!statusResult.data.is_working;
      const rawStatus = statusResult.data.status || statusResult.data.worker_status || statusResult.data.status_text || statusResult.data.worker_status_text || null;
      
      console.log('Raw status data:', {
        isWorking,
        rawStatus,
        allData: statusResult.data
      });
      
      // Дополнительная проверка на заблокированный статус
      let forceBlocked = false;
      if (statusResult.data.blocked === true || statusResult.data.is_blocked === true || 
          statusResult.data.access_denied === true || statusResult.data.disabled === true) {
        forceBlocked = true;
        console.log('Force blocked detected from boolean flags (punch in)');
      }
      
      const normalized = forceBlocked ? WorkerStatus.BLOCKED : normalizeStatus(rawStatus, isWorking);
      
      console.log('Normalized status:', normalized);
      
      if (normalized === WorkerStatus.BLOCKED) {
        Alert.alert('Доступ заблокирован', 'Ваш пользователь заблокирован администратором. Обратитесь к администратору.');
        return;
      }
      
      if (normalized === WorkerStatus.FIRED) {
        Alert.alert('Доступ запрещен', 'Ваш пользователь уволен.');
        return;
      }
      
      if (!canStartShift(normalized)) {
        Alert.alert('Доступ запрещен', 'Ваш статус не позволяет начать смену.');
        return;
      }
    } catch (error) {
      console.error('Error checking worker status:', error);
      Alert.alert('Ошибка', 'Не удалось проверить статус рабочего.');
      return;
    }

    // Затем проверяем разрешения на геолокацию
    try {
      const hasAlways = await ensureAlwaysLocationPermission();
      if (!hasAlways) {
        Alert.alert('Разрешение на геолокацию', 'Для начала смены необходимо разрешить доступ к геолокации.');
        return; // Блокируем старт смены без «Всегда»
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      Alert.alert('Ошибка разрешений', 'Не удалось проверить разрешения на геолокацию.');
      return;
    }

    setIsLoading(true);
    try {
      // Требуем фото. В dev режиме допускаем выбор из галереи при неудаче камеры
      let photoResult = await cameraService.takePhoto();

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
      setLastLocation(location);

      // Добавляем геопозицию с правильным порядком параметров
      console.log('Adding geo point for punch in:', location);
      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        location.altitude || 0,  // alt
        (location.altitude || 0) + 5,  // altMsl (altitude + 5)
        true,                 // hasAlt
        true,                 // hasAltMsl
        false,                // hasAltMslAccuracy
        1.5                   // mslAccuracyMeters
      );
      console.log('Added geo point for punch in:', geoPoint);

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

    // Сначала проверяем статус рабочего
    try {
      const statusResult = await punchService.getWorkerStatus(currentUser.user_id || 123);
      if (!statusResult.success) {
        Alert.alert('Ошибка', 'Не удалось проверить статус рабочего.');
        return;
      }
      
      // Логируем полученные данные для отладки
      console.log('Worker status response (punch out):', statusResult.data);
      
      const isWorking = !!statusResult.data.is_working;
      const rawStatus = statusResult.data.status || statusResult.data.worker_status || statusResult.data.status_text || statusResult.data.worker_status_text || null;
      
      console.log('Raw status data (punch out):', {
        isWorking,
        rawStatus,
        allData: statusResult.data
      });
      
      // Дополнительная проверка на заблокированный статус
      let forceBlocked = false;
      if (statusResult.data.blocked === true || statusResult.data.is_blocked === true || 
          statusResult.data.access_denied === true || statusResult.data.disabled === true) {
        forceBlocked = true;
        console.log('Force blocked detected from boolean flags (punch out)');
      }
      
      const normalized = forceBlocked ? WorkerStatus.BLOCKED : normalizeStatus(rawStatus, isWorking);
      
      console.log('Normalized status (punch out):', normalized);
      
      if (normalized === WorkerStatus.BLOCKED) {
        Alert.alert('Доступ заблокирован', 'Ваш пользователь заблокирован администратором. Обратитесь к администратору.');
        return;
      }
      
      if (normalized === WorkerStatus.FIRED) {
        Alert.alert('Доступ запрещен', 'Ваш пользователь уволен.');
        return;
      }
    } catch (error) {
      console.error('Error checking worker status:', error);
      Alert.alert('Ошибка', 'Не удалось проверить статус рабочего.');
      return;
    }

    // Затем проверяем разрешения на геолокацию
    try {
      const hasAlways = await ensureAlwaysLocationPermission();
      if (!hasAlways) {
        Alert.alert('Разрешение на геолокацию', 'Для завершения смены необходимо разрешить доступ к геолокации.');
        return; // Блокируем завершение смены без «Всегда»
      }
    } catch (error) {
      console.error('Error checking location permissions:', error);
      Alert.alert('Ошибка разрешений', 'Не удалось проверить разрешения на геолокацию.');
      return;
    }

    setIsLoading(true);
    try {
      // Требуем фото. В dev режиме допускаем выбор из галереи при неудаче камеры
      let photoResult = await cameraService.takePhoto();

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
      setLastLocation(location);

      // Добавляем финальную геопозицию с правильным порядком параметров
      console.log('Adding geo point for punch out:', location);
      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        location.altitude || 0,  // alt
        (location.altitude || 0) + 5,  // altMsl (altitude + 5)
        true,                 // hasAlt
        true,                 // hasAltMsl
        false,                // hasAltMslAccuracy
        1.5                   // mslAccuracyMeters
      );
      console.log('Added geo point for punch out:', geoPoint);

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
      console.log('=== ADDING GEO POINT ===');
      
      const location = await geoService.getCurrentLocation();
      console.log('Raw location from geoService:', location);
      
      // Проверяем валидность координат
      if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        console.error('Invalid coordinates:', location);
        Alert.alert('Ошибка', 'Получены невалидные координаты');
        return;
      }
      
      // Проверяем диапазон координат
      if (location.latitude < -90 || location.latitude > 90) {
        console.error('Invalid latitude:', location.latitude);
        Alert.alert('Ошибка', `Некорректная широта: ${location.latitude}`);
        return;
      }
      
      if (location.longitude < -180 || location.longitude > 180) {
        console.error('Invalid longitude:', location.longitude);
        Alert.alert('Ошибка', `Некорректная долгота: ${location.longitude}`);
        return;
      }
      
      console.log('Coordinates validation passed:', {
        lat: location.latitude,
        lon: location.longitude,
        alt: location.altitude,
        accuracy: location.accuracy
      });
      
      // Добавляем геопозицию с правильным порядком параметров
      const geoPoint = geoService.addGeoPoint(
        location.latitude,    // lat
        location.longitude,   // lon
        location.altitude || 0,  // alt
        (location.altitude || 0) + 5,  // altMsl (altitude + 5)
        true,                 // hasAlt
        true,                 // hasAltMsl
        false,                // hasAltMslAccuracy
        1.5                   // mslAccuracyMeters
      );
      
      console.log('Added geo point:', geoPoint);
      console.log('Total geo points:', geoService.getGeoDataCount());
      console.log('=== END ADDING GEO POINT ===');
      
      setLastLocation(location);
      updateGeoDataCount();
      Alert.alert('Успех', `Геопозиция добавлена!\nШирота: ${location.latitude.toFixed(6)}\nДолгота: ${location.longitude.toFixed(6)}`);
    } catch (error) {
      console.error('Error adding geo point:', error);
      
      // Если это ошибка fallback координат эмулятора, предлагаем использовать тестовые координаты
      if (error.message === 'EMULATOR_FALLBACK_COORDS') {
        Alert.alert(
          'Эмулятор GPS',
          'Обнаружены тестовые координаты эмулятора. Использовать тестовые координаты Москвы?',
          [
            {
              text: 'Отмена',
              style: 'cancel',
            },
            {
              text: 'Использовать тестовые',
              onPress: () => addGeoPointWithTestCoords(),
            },
          ]
        );
        return;
      }
      
      Alert.alert('Ошибка', `Не удалось получить геопозицию: ${error.message}`);
    }
  };

  // Добавление геопозиции с тестовыми координатами для эмулятора
  const addGeoPointWithTestCoords = () => {
    try {
      console.log('=== ADDING TEST GEO POINT ===');
      
      const testLocation = geoService.getTestCoordinates();
      console.log('Test location:', testLocation);
      
      // Добавляем геопозицию с тестовыми координатами
      const geoPoint = geoService.addGeoPoint(
        testLocation.latitude,    // lat
        testLocation.longitude,   // lon
        testLocation.altitude || 0,  // alt
        (testLocation.altitude || 0) + 5,  // altMsl (altitude + 5)
        true,                 // hasAlt
        true,                 // hasAltMsl
        false,                // hasAltMslAccuracy
        1.5                   // mslAccuracyMeters
      );
      
      console.log('Added test geo point:', geoPoint);
      console.log('Total geo points:', geoService.getGeoDataCount());
      console.log('=== END ADDING TEST GEO POINT ===');
      
      setLastLocation(testLocation);
      updateGeoDataCount();
      Alert.alert('Успех', `Тестовая геопозиция добавлена!\nШирота: ${testLocation.latitude.toFixed(6)}\nДолгота: ${testLocation.longitude.toFixed(6)}\n\n(Тестовые координаты Москвы)`);
    } catch (error) {
      console.error('Error adding test geo point:', error);
      Alert.alert('Ошибка', `Не удалось добавить тестовую геопозицию: ${error.message}`);
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
          <Text style={styles.title}>Смена</Text>
          <Text style={styles.subtitle}>
            {currentUser ? `Пользователь: ${displayName || '—'}` : 'Загрузка...'}
          </Text>
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
          {__DEV__ && (
            <>
              <TouchableOpacity
                style={[styles.button, styles.testButton, { marginTop: 10, padding: 8 }]}
                onPress={() => {
                  if (currentUser) {
                    checkWorkerStatus(currentUser.user_id || 123);
                  }
                }}
              >
                <Text style={styles.buttonText}>🔄 Обновить статус</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#F44336', marginTop: 5, padding: 8 }]}
                onPress={() => {
                  setUserStatus(WorkerStatus.BLOCKED);
                  setRawStatusData({ status: 'BLOCKED', is_working: false });
                }}
              >
                <Text style={styles.buttonText}>🧪 Тест: Заблокирован</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#4CAF50', marginTop: 5, padding: 8 }]}
                onPress={() => {
                  setUserStatus(WorkerStatus.READY_TO_WORK);
                  setRawStatusData({ status: 'READY_TO_WORK', is_working: false });
                }}
              >
                <Text style={styles.buttonText}>🧪 Тест: 2ч</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 12, color: '#666', marginTop: 5, textAlign: 'center' }}>
                Raw: {JSON.stringify({ userStatus, isShiftActive })}
              </Text>
              {rawStatusData && (
                <Text style={{ fontSize: 10, color: '#999', marginTop: 3, textAlign: 'center' }}>
                  API: {JSON.stringify(rawStatusData)}
                </Text>
              )}
            </>
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
                  <Text style={styles.buttonText}>Начать смену</Text>
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
                          // Обновляем статус пользователя после успешной отправки
                          setTimeout(() => {
                            checkWorkerStatus(currentUser.user_id || 123);
                          }, 1000);
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
                                          setTimeout(() => {
                                            checkWorkerStatus(currentUser.user_id || 123);
                                          }, 1000);
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
                                        setTimeout(() => {
                                          checkWorkerStatus(currentUser.user_id || 123);
                                        }, 1000);
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
                <Text style={styles.buttonText}>Завершить смену</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {__DEV__ ? (
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
            onPress={async () => {
              const res = await runBgGeoSmokeTest({
                licenseKey: "7d1976aa376fbcf7e40d12892c8dab579985abbcbc09e1da570826649b4295cf",
                // webhookUrl: "https://webhook.site/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", // optional
                timeoutSec: 30,
              });
              Alert.alert(
                res.ok ? "BGG Smoke: OK" : "BGG Smoke: FAIL",
                [
                  `bundleId: ${res.bundleId}`,
                  `gotLocation: ${res.gotLocation}`,
                  `httpOk: ${res.httpOk === null ? 'n/a' : res.httpOk}`,
                  res.errors.length ? `errors: ${res.errors.join(' | ')}` : 'no errors',
                ].join('\n')
              );
              try { console.log('BGG SMOKE RESULT:', res); } catch {}
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Smoke-test ключа</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={addGeoPoint}
          >
            <Text style={styles.buttonText}>Добавить геопозицию</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={addGeoPointWithTestCoords}
          >
            <Text style={styles.buttonText}>🧪 Тестовые координаты (Москва)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={async () => {
              const res = await getOneShotPosition();
              if (res && !res.error) {
                Alert.alert('BGG One-shot', `lat=${res.coords?.latitude}, lon=${res.coords?.longitude}`);
                try { console.log('BGG getCurrentPosition:', res); } catch (_) {}
              } else {
                Alert.alert('BGG One-shot ошибка', String(res?.error || 'unknown'));
              }
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: One-shot позиция</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={async () => {
              const state = await getBgGeoState();
              if (state && !state.error) {
                Alert.alert('BGG Состояние', `enabled=${state.enabled}, trackingMode=${state.trackingMode ?? 'n/a'}`);
                try { console.log('BGG getState:', state); } catch (_) {}
              } else {
                Alert.alert('BGG Состояние ошибка', String(state?.error || 'unknown'));
              }
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Состояние плагина</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={() => {
              try {
                const lic = getLicenseInfo();
                Alert.alert('BGG Лицензия', `env=${lic.envVar}\nесть=${lic.licensePresent ? 'Да' : 'Нет'}\ninit=${lic.initSucceeded ? 'Да' : 'Нет'}${lic.lastInitError ? `\nerr=${lic.lastInitError}` : ''}`);
                try { console.log('BGG license info:', lic); } catch (_) {}
              } catch (e) {
                Alert.alert('BGG Лицензия', String(e?.message || e));
              }
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Статус лицензии</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={async () => {
              const log = await getBgGeoLog();
              try { console.log('BGG Log:\n', log); } catch (_) {}
              Alert.alert('BGG Лог (первые 2к симв.)', String(log).slice(0, 2000));
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Логи</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={async () => {
              const hits = await searchBgGeoLog('(license|invalid|error|denied|package)');
              try { console.log('BGG Log (filtered):\n', hits); } catch (_) {}
              Alert.alert('BGG Лог (фильтр license/error)', String(hits).slice(0, 2000));
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Поиск ошибок</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={async () => {
              const status = await requestBgGeoPermission();
              Alert.alert('BGG Разрешения', JSON.stringify(status));
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Запрос разрешений</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.geoButton]}
            onPress={async () => {
              try {
                const lic = getLicenseInfo();
                const state = await getBgGeoState();
                const position = await getOneShotPosition();
                
                const summary = `Platform: ${lic.platform}
Init: ${lic.initSucceeded ? 'Да' : 'Нет'}
License: ${lic.licensePresent ? 'Да' : 'Нет'}
State enabled: ${state?.enabled || 'N/A'}
Position: ${position?.error ? 'Ошибка' : 'Получена'}
Package: ${lic.packageName || 'N/A'}`;
                
                Alert.alert('BGG Детальный тест', summary);
                console.log('BGG License Info:', lic);
                console.log('BGG State:', state);
                console.log('BGG Position:', position);
              } catch (e) {
                Alert.alert('BGG Тест ошибка', e.message);
              }
            }}
          >
            <Text style={styles.buttonText}>🧪 BGG: Детальный тест</Text>
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
        ) : null}

        {__DEV__ ? (
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
        ) : null}

        <View style={styles.bottomButtons}>
          {__DEV__ ? (
            <>
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
            </>
          ) : null}

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
