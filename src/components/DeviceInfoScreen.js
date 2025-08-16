import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import deviceUtils from '../utils/deviceUtils';

const DeviceInfoScreen = ({ onBack }) => {
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [batteryInfo, setBatteryInfo] = useState(null);
  const [featureSupport, setFeatureSupport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      setIsLoading(true);
      
      const [device, network, battery, features] = await Promise.all([
        deviceUtils.getDeviceInfo(),
        deviceUtils.getNetworkInfo(),
        deviceUtils.getBatteryInfo(),
        deviceUtils.checkFeatureSupport(),
      ]);

      setDeviceInfo(device);
      setNetworkInfo(network);
      setBatteryInfo(battery);
      setFeatureSupport(features);
    } catch (error) {
      console.error('Error loading device info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInfoSection = (title, data, color = '#007AFF') => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      {Object.entries(data || {}).map(([key, value]) => (
        <View key={key} style={styles.infoRow}>
          <Text style={styles.infoLabel}>{key}:</Text>
          <Text style={styles.infoValue}>
            {typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : String(value)}
          </Text>
        </View>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Загрузка информации об устройстве...</Text>
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
        <Text style={styles.title}>Информация об устройстве</Text>
      </View>

      <ScrollView style={styles.content}>
        {renderInfoSection('Основная информация', deviceInfo, '#007AFF')}
        {renderInfoSection('Сеть', networkInfo, '#4CAF50')}
        {renderInfoSection('Батарея', batteryInfo, '#FF9800')}
        {renderInfoSection('Поддерживаемые функции', featureSupport, '#9C27B0')}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.refreshButton} onPress={loadDeviceInfo}>
            <Text style={styles.refreshButtonText}>Обновить информацию</Text>
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
  section: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  actions: {
    marginBottom: 30,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeviceInfoScreen;

