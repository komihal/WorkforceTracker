import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

const SelfieCaptureModal = ({ visible, onCancel, onCaptured }) => {
  const [permission, setPermission] = useState('not-determined');
  const cameraRef = useRef(null);
  const device = useCameraDevice('front');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const status = await Camera.requestCameraPermission();
        if (!mounted) return;
        setPermission(status);
      } catch (e) {
        setPermission('denied');
      }
    })();
    return () => { mounted = false; };
  }, []);

  const canUseCamera = useMemo(() => permission === 'granted' && !!device, [permission, device]);

  const handleCapture = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePhoto({ qualityPrioritization: 'balanced', flash: 'off' });
      const filePath = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      onCaptured && onCaptured({
        uri: filePath,
        type: 'image/jpeg',
        fileName: `selfie_${Date.now()}.jpg`,
        width: photo.width,
        height: photo.height,
      });
    } catch (e) {
      onCancel && onCancel(e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Сделайте селфи</Text>
          <TouchableOpacity onPress={() => onCancel && onCancel()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cameraBox}>
          {canUseCamera ? (
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={true}
              photo={true}
              exposure={0}
            />
          ) : (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.infoText}>
                {permission === 'denied' ? 'Нет доступа к камере' : 'Загрузка камеры...'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity onPress={handleCapture} style={[styles.captureBtn, !canUseCamera && styles.btnDisabled]} disabled={!canUseCamera}>
            <Text style={styles.captureText}>Сделать фото</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#111', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cancelBtn: { padding: 8 },
  cancelText: { color: '#fff', fontSize: 14 },
  cameraBox: { flex: 1, backgroundColor: '#000' },
  loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoText: { color: '#aaa', marginTop: 12 },
  footer: { padding: 16, backgroundColor: '#111' },
  captureBtn: { backgroundColor: '#007AFF', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#555' },
  captureText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default SelfieCaptureModal;


