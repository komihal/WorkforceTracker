import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import fileUploadService from '../services/fileUploadService';
import cameraService from '../services/cameraService';

const PhotoGalleryScreen = ({ onBack, userId }) => {
  const [photos, setPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, [userId]);

  const loadPhotos = async () => {
    try {
      setIsLoading(true);
      const result = await fileUploadService.getUserPhotos(userId);
      
      if (result.success) {
        setPhotos(result.data.photos || []);
      } else {
        Alert.alert('Ошибка', result.error);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить фотографии');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      setIsUploading(true);
      const photoResult = await cameraService.takePhoto();
      
      if (photoResult.success) {
        const uploadResult = await fileUploadService.uploadPhoto(
          photoResult.data.uri,
          userId,
          1, // place_id
          '123456789012345', // IMEI
          'manual-photo'
        );
        
        if (uploadResult.success) {
          Alert.alert('Успех', 'Фотография загружена!');
          loadPhotos(); // Перезагружаем список
        } else {
          Alert.alert('Ошибка', uploadResult.error);
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сделать и загрузить фото');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectPhoto = async () => {
    try {
      setIsUploading(true);
      const photoResult = await cameraService.selectPhoto();
      
      if (photoResult.success) {
        const uploadResult = await fileUploadService.uploadPhoto(
          photoResult.data.uri,
          userId,
          1, // place_id
          '123456789012345', // IMEI
          'gallery-photo'
        );
        
        if (uploadResult.success) {
          Alert.alert('Успех', 'Фотография загружена!');
          loadPhotos(); // Перезагружаем список
        } else {
          Alert.alert('Ошибка', uploadResult.error);
        }
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать и загрузить фото');
    } finally {
      setIsUploading(false);
    }
  };

  const renderPhotoItem = (photo, index) => (
    <View key={index} style={styles.photoItem}>
      <Image
        source={{ uri: photo.photo_url || photo.uri }}
        style={styles.photoImage}
        resizeMode="cover"
      />
      <View style={styles.photoInfo}>
        <Text style={styles.photoName}>{photo.file_name || `Фото ${index + 1}`}</Text>
        <Text style={styles.photoDate}>
          {new Date(photo.timestamp * 1000).toLocaleString('ru-RU')}
        </Text>
        <Text style={styles.photoTag}>{photo.file_tag || 'Без тега'}</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Загрузка фотографий...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Фотогалерея</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cameraButton]}
          onPress={handleTakePhoto}
          disabled={isUploading}
        >
          <Text style={styles.actionButtonText}>📷 Сделать фото</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.galleryButton]}
          onPress={handleSelectPhoto}
          disabled={isUploading}
        >
          <Text style={styles.actionButtonText}>🖼️ Выбрать из галереи</Text>
        </TouchableOpacity>
      </View>

      {isUploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.uploadingText}>Загрузка фотографии...</Text>
        </View>
      )}

      <ScrollView style={styles.content}>
        {photos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Фотографии не найдены</Text>
            <Text style={styles.emptySubtext}>
              Сделайте первое фото или выберите из галереи
            </Text>
          </View>
        ) : (
          <View style={styles.photosContainer}>
            {photos.map((photo, index) => renderPhotoItem(photo, index))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.refreshButton} onPress={loadPhotos}>
        <Text style={styles.refreshButtonText}>Обновить</Text>
      </TouchableOpacity>
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
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  actionButton: {
    flex: 1,
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
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#e8f5e8',
    marginHorizontal: 20,
    borderRadius: 8,
  },
  uploadingText: {
    marginLeft: 10,
    color: '#4CAF50',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  photosContainer: {
    gap: 15,
  },
  photoItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: 200,
  },
  photoInfo: {
    padding: 15,
  },
  photoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  photoDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  photoTag: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PhotoGalleryScreen;
