import React, { useEffect, useState } from "react";
import { View, Text, Button, ScrollView, StyleSheet, SafeAreaView } from "react-native";
import BackgroundGeolocation from "react-native-background-geolocation";

export default function BgGeoTestScreen() {
  const [log, setLog] = useState([]);
  const [coords, setCoords] = useState(null);
  const [isEnabled, setIsEnabled] = useState(false);

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${msg}`;
    console.log(logEntry);
    setLog((prev) => [logEntry, ...prev.slice(0, 50)]);
  };

  useEffect(() => {
    addLog("🔧 Initializing BackgroundGeolocation...");

    // Подписка на события локации
    BackgroundGeolocation.onLocation((location) => {
      setCoords(location.coords);
      addLog(`📍 Location: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)} (accuracy: ${location.coords.accuracy}m)`);
    });

    // Подписка на изменения движения
    BackgroundGeolocation.onMotionChange((event) => {
      addLog(`🚶 MotionChange: isMoving=${event.isMoving}, location: ${event.location?.coords?.latitude?.toFixed(6)}, ${event.location?.coords?.longitude?.toFixed(6)}`);
    });

    // Подписка на изменения активности
    BackgroundGeolocation.onActivityChange((event) => {
      addLog(`🏃 Activity: ${event.activity}, confidence=${event.confidence}%`);
    });

    // Подписка на изменения провайдера GPS
    BackgroundGeolocation.onProviderChange((event) => {
      addLog(`⚙️ ProviderChange: GPS enabled=${event.gps}, network=${event.network}, status=${event.status}`);
    });

    // Подписка на изменения состояния сервиса
    BackgroundGeolocation.onHttp((response) => {
      addLog(`🌐 HTTP: ${response.status} - ${response.responseText}`);
    });

    // Инициализация BackgroundGeolocation
    BackgroundGeolocation.ready({
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 50,
      stopOnTerminate: false,
      startOnBoot: true,
      debug: true,
      logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
      enableHeadless: true,
      foregroundService: true,
      showsBackgroundLocationIndicator: true,
      pausesLocationUpdatesAutomatically: false,
      maxDaysToPersist: 7,
    }).then((state) => {
      setIsEnabled(state.enabled);
      addLog(`✅ BackgroundGeolocation ready. Enabled=${state.enabled}, isMoving=${state.isMoving}`);
      addLog(`📱 Config: distanceFilter=${state.distanceFilter}, desiredAccuracy=${state.desiredAccuracy}`);
    }).catch((error) => {
      addLog(`❌ Failed to initialize: ${error.message}`);
    });

    return () => {
      addLog("🧹 Cleaning up listeners...");
      BackgroundGeolocation.removeListeners();
    };
  }, []);

  const handleStart = async () => {
    try {
      addLog("▶️ Starting BackgroundGeolocation...");
      await BackgroundGeolocation.start();
      setIsEnabled(true);
      addLog("✅ BackgroundGeolocation started successfully");
    } catch (error) {
      addLog(`❌ Failed to start: ${error.message}`);
    }
  };

  const handleStop = async () => {
    try {
      addLog("⏹️ Stopping BackgroundGeolocation...");
      await BackgroundGeolocation.stop();
      setIsEnabled(false);
      addLog("✅ BackgroundGeolocation stopped successfully");
    } catch (error) {
      addLog(`❌ Failed to stop: ${error.message}`);
    }
  };

  const handleOneShot = async () => {
    try {
      addLog("🎯 Getting one-shot location...");
      const location = await BackgroundGeolocation.getCurrentPosition({
        samples: 1,
        persist: false,
        timeout: 30,
        maximumAge: 5000,
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH
      });
      
      addLog(`🎯 One-shot: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)} (accuracy: ${location.coords.accuracy}m)`);
      setCoords(location.coords);
    } catch (error) {
      addLog(`❌ One-shot failed: ${error.message}`);
    }
  };

  const handleGetState = async () => {
    try {
      const state = await BackgroundGeolocation.getState();
      addLog(`📊 Current state: ${JSON.stringify(state, null, 2)}`);
    } catch (error) {
      addLog(`❌ Failed to get state: ${error.message}`);
    }
  };

  const clearLog = () => {
    setLog([]);
    addLog("🧹 Log cleared");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>BGGeo Test Screen</Text>
      
      {/* Статус и координаты */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: <Text style={[styles.statusIndicator, { color: isEnabled ? '#4CAF50' : '#F44336' }]}>
            {isEnabled ? 'ENABLED' : 'DISABLED'}
          </Text>
        </Text>
        <Text style={styles.coordsText}>
          Last coords: {coords ? 
            `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}` : 
            "none"
          }
        </Text>
        {coords && (
          <Text style={styles.accuracyText}>
            Accuracy: {coords.accuracy ? `${coords.accuracy.toFixed(1)}m` : 'unknown'}
          </Text>
        )}
      </View>

      {/* Кнопки управления */}
      <View style={styles.buttonsContainer}>
        <View style={styles.buttonRow}>
          <Button 
            title="Start" 
            onPress={handleStart}
            color="#4CAF50"
            disabled={isEnabled}
          />
          <Button 
            title="Stop" 
            onPress={handleStop}
            color="#F44336"
            disabled={!isEnabled}
          />
        </View>
        
        <View style={styles.buttonRow}>
          <Button 
            title="One-shot location" 
            onPress={handleOneShot}
            color="#2196F3"
          />
          <Button 
            title="Get State" 
            onPress={handleGetState}
            color="#FF9800"
          />
        </View>
        
        <Button 
          title="Clear Log" 
          onPress={clearLog}
          color="#9C27B0"
        />
      </View>

      {/* Лог событий */}
      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Event Log ({log.length} entries):</Text>
        <ScrollView style={styles.log} showsVerticalScrollIndicator={true}>
          {log.map((logEntry, index) => (
            <Text key={index} style={styles.logLine} numberOfLines={2}>
              {logEntry}
            </Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  statusIndicator: {
    fontWeight: 'bold',
  },
  coordsText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
  accuracyText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  buttonsContainer: {
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  logContainer: {
    flex: 1,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  log: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logLine: {
    fontSize: 11,
    marginBottom: 6,
    color: '#555',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
