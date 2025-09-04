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
import cameraService from '../services/cameraService';
import fileUploadService from '../services/fileUploadService';
import deviceUtils from '../utils/deviceUtils';
import { ensureAlwaysLocationPermission } from '../services/permissionsService';
import { canStartShift, humanizeStatus, normalizeStatus, WorkerStatus } from '../helpers/shift';
// import { initLocation } from '../location'; // Отключено - инициализация происходит в App.js
import geoEndpointConfig, { ENDPOINT_MODES } from '../config/geoEndpointConfig';

const MainScreen = ({ onLogout }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userStatus, setUserStatus] = useState(WorkerStatus.READY_TO_WORK);
  const [endpointMode, setEndpointMode] = useState(ENDPOINT_MODES.API);
  const [endpointDescription, setEndpointDescription] = useState('API Django (для сохранения)');

  useEffect(() => {
    const loadUserData = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        console.log('Loaded currentUser:', user);
        setCurrentUser(user);
        checkWorkerStatus(user.user_id || 123);
      }
    };
    
    const loadEndpointMode = async () => {
      const mode = await geoEndpointConfig.getCurrentMode();
      const description = await geoEndpointConfig.getModeDescription();
      setEndpointMode(mode);
      setEndpointDescription(description);
    };
    
    loadUserData();
    loadEndpointMode();

    // Инициализация геолокации отключена - происходит только при входе в приложение
    console.log('Location initialization disabled in MainScreen - handled by App.js on login');


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
        // Автоматически включаем/выключаем трекинг по актуальному статусу
        try {
          const { startTracking, stopTracking } = require('../location');
          if (isWorking) {
            await startTracking();
            console.log('Auto-start tracking based on current shift status');
          } else {
            await stopTracking();
            console.log('Auto-stop tracking based on current shift status');
          }
        } catch (e) {
          console.log('Tracking sync with status failed:', e?.message || e);
        }
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

      const photoNameIn = (photoResult.data?.fileName) || `start_shift_${Date.now()}.jpg`;
      const result = await punchService.punchIn(
        currentUser.user_id || 123,
        phoneImeiIn,
        photoNameIn
      );

            if (result.success) {
        setIsShiftActive(true);
        Alert.alert('Успех', 'Смена начата!');
        
        // Запускаем отслеживание геолокации при начале смены
        try {
          const { startTracking } = require('../location');
          await startTracking();
          console.log('Location tracking started on punch in');
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

      const photoNameOut = (photoResult.data?.fileName) || `end_shift_${Date.now()}.jpg`;
      const result = await punchService.punchOut(
        currentUser.user_id || 123,
        phoneImeiOut,
        photoNameOut
      );

      if (result.success) {
        setIsShiftActive(false);
        Alert.alert('Успех', 'Смена завершена!');
        
        // Останавливаем отслеживание геолокации при завершении смены
        try {
          const { stopTracking } = require('../location');
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

  // Переключение режима отправки геолокации
  const handleToggleEndpointMode = async () => {
    const newMode = endpointMode === ENDPOINT_MODES.API ? ENDPOINT_MODES.WEBHOOK : ENDPOINT_MODES.API;
    const success = await geoEndpointConfig.setMode(newMode);
    
    if (success) {
      const description = await geoEndpointConfig.getModeDescription();
      setEndpointMode(newMode);
      setEndpointDescription(description);
      
      Alert.alert(
        'Режим изменен',
        `Геолокация теперь отправляется на: ${description}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Ошибка', 'Не удалось изменить режим отправки');
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
      } else {
        Alert.alert('Ошибка', result.error);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить геоданные');
    }
  };

  // (dev test functions removed)



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

        {/* Переключатель режима отправки геолокации */}
        <View style={styles.endpointToggleSection}>
          <Text style={styles.sectionTitle}>Режим отправки геолокации</Text>
          <TouchableOpacity
            style={[styles.button, styles.endpointToggleButton]}
            onPress={handleToggleEndpointMode}
          >
            <Text style={styles.buttonText}>
              {endpointMode === ENDPOINT_MODES.WEBHOOK ? '🔗' : '💾'} {endpointDescription}
            </Text>
          </TouchableOpacity>
          <Text style={styles.endpointDescription}>
            {endpointMode === ENDPOINT_MODES.WEBHOOK 
              ? 'Данные отправляются на webhook для мониторинга' 
              : 'Данные сохраняются в базе данных Django'}
          </Text>
        </View>





        <View style={styles.bottomButtons}>
          {/* dev/test buttons removed */}
          
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
  logoutButton: {
    backgroundColor: '#9E9E9E',
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

});

export default MainScreen;
