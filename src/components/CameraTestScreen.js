import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import cameraService from '../services/cameraService';

const CameraTestScreen = ({ onBack }) => {
  const [lastResult, setLastResult] = useState(null);
  const [lastError, setLastError] = useState(null);

  const handleTakePhoto = async () => {
    setLastError(null);
    setLastResult(null);
    const result = await cameraService.takePhoto();
    if (result.success) {
      setLastResult(result.data);
    } else if (result.suggestGallery) {
      Alert.alert('Камера недоступна', 'Предлагаю выбрать фото из галереи.');
      const galleryResult = await cameraService.selectPhoto();
      if (galleryResult.success) {
        setLastResult(galleryResult.data);
      } else {
        setLastError(galleryResult.error || 'Не удалось выбрать фото');
      }
    } else {
      setLastError(result.error || 'Ошибка камеры');
      Alert.alert('Ошибка', result.error || 'Ошибка камеры');
    }
  };

  const handleSelectPhoto = async () => {
    setLastError(null);
    setLastResult(null);
    const result = await cameraService.selectPhoto();
    if (result.success) {
      setLastResult(result.data);
    } else {
      setLastError(result.error || 'Не удалось выбрать фото');
      Alert.alert('Ошибка', result.error || 'Не удалось выбрать фото');
    }
  };

  const handleCheckPermissions = async () => {
    const result = await cameraService.checkCameraPermissions();
    if (!result.success) {
      setLastError(result.error || 'Ошибка проверки разрешений');
      Alert.alert('Ошибка', result.error || 'Ошибка проверки разрешений');
    } else {
      Alert.alert(
        'Проверка разрешений',
        `Платформа: ${result.platform}\nРазрешение: ${result.hasPermission ? 'есть' : 'нет'}${result.warning ? `\n${result.warning}` : ''}`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Тест камеры</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={handleTakePhoto}>
            <Text style={styles.buttonText}>📷 Открыть камеру</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.galleryButton]} onPress={handleSelectPhoto}>
            <Text style={styles.buttonText}>🖼️ Выбрать из галереи</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.permsButton]} onPress={handleCheckPermissions}>
            <Text style={styles.buttonText}>🔐 Проверить разрешения</Text>
          </TouchableOpacity>
        </View>

        {lastResult && (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Результат</Text>
            {lastResult.uri ? (
              <Image source={{ uri: lastResult.uri }} style={styles.preview} resizeMode="cover" />
            ) : null}
            <View style={styles.meta}>
              <Text style={styles.metaText}>Имя файла: {lastResult.fileName || '—'}</Text>
              <Text style={styles.metaText}>Тип: {lastResult.type || '—'}</Text>
              <Text style={styles.metaText}>Размер: {lastResult.fileSize ? `${lastResult.fileSize} B` : '—'}</Text>
              <Text style={styles.metaText}>Размеры: {lastResult.width || '—'} × {lastResult.height || '—'}</Text>
            </View>
          </View>
        )}

        {lastError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  actions: {
    gap: 10,
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraButton: {
    backgroundColor: '#4CAF50',
  },
  galleryButton: {
    backgroundColor: '#2196F3',
  },
  permsButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  preview: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginBottom: 10,
  },
  meta: {
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
  },
  errorCard: {
    backgroundColor: '#fde7e7',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  errorText: {
    color: '#b00020',
    fontSize: 14,
  },
});

export default CameraTestScreen;


