import { Platform, Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

// CameraService creates a singleton on import, so we must set up mocks first
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  openSettings: jest.fn(),
  PERMISSIONS: { ANDROID: { CAMERA: 'android.permission.CAMERA' } },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked', LIMITED: 'limited' },
}));

import CameraService from '../src/services/cameraService';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset platform to android by default
  Platform.OS = 'android';
});

describe('CameraService', () => {
  describe('getDefaultOptions / updateDefaultOptions', () => {
    it('returns default camera options', () => {
      const opts = CameraService.getDefaultOptions();
      expect(opts.mediaType).toBe('photo');
      expect(opts.quality).toBe(0.8);
      expect(opts.cameraType).toBe('front');
    });

    it('updates default options', () => {
      CameraService.updateDefaultOptions({ quality: 0.5 });
      expect(CameraService.getDefaultOptions().quality).toBe(0.5);
      // Restore
      CameraService.updateDefaultOptions({ quality: 0.8 });
    });
  });

  describe('ensureCameraPermissionAndroid', () => {
    it('returns true when already granted', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);
      const result = await CameraService.ensureCameraPermissionAndroid();
      expect(result).toBe(true);
    });

    it('requests permission when denied and returns true if granted', async () => {
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.GRANTED);
      const result = await CameraService.ensureCameraPermissionAndroid();
      expect(result).toBe(true);
      expect(request).toHaveBeenCalled();
    });

    it('requests permission when limited', async () => {
      check.mockResolvedValue(RESULTS.LIMITED);
      request.mockResolvedValue(RESULTS.DENIED);
      const result = await CameraService.ensureCameraPermissionAndroid();
      expect(result).toBe(false);
    });

    it('shows alert and returns false when blocked', async () => {
      check.mockResolvedValue(RESULTS.BLOCKED);
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const result = await CameraService.ensureCameraPermissionAndroid();
      expect(result).toBe(false);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Доступ к камере',
        expect.stringContaining('заблокирован'),
        expect.any(Array),
      );
    });

    it('returns false on error', async () => {
      check.mockRejectedValue(new Error('fail'));
      const result = await CameraService.ensureCameraPermissionAndroid();
      expect(result).toBe(false);
    });
  });

  describe('takePhoto', () => {
    it('returns photo data on success (android)', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);
      launchCamera.mockResolvedValue({
        assets: [{ uri: 'file://photo.jpg', type: 'image/jpeg', fileName: 'photo.jpg', fileSize: 1024, width: 640, height: 480 }],
      });

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(true);
      expect(result.data.uri).toBe('file://photo.jpg');
    });

    it('returns error when user cancels', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);
      launchCamera.mockResolvedValue({ didCancel: true });

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.error).toContain('отменил');
    });

    it('returns error on camera error code (android)', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);
      launchCamera.mockResolvedValue({ errorCode: 'camera_unavailable', errorMessage: 'Camera error' });

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Camera error');
    });

    it('returns suggestGallery on iOS camera error', async () => {
      Platform.OS = 'ios';
      launchCamera.mockResolvedValue({ errorCode: 'camera_unavailable' });

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.suggestGallery).toBe(true);
    });

    it('returns error when no permission on android', async () => {
      check.mockResolvedValue(RESULTS.BLOCKED);
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.error).toContain('камере');
    });

    it('returns error when no assets', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);
      launchCamera.mockResolvedValue({});

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.error).toContain('фото');
    });

    it('handles camera exception on android', async () => {
      check.mockResolvedValue(RESULTS.GRANTED);
      launchCamera.mockRejectedValue(new Error('crash'));

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.error).toContain('crash');
    });

    it('suggests gallery on iOS exception', async () => {
      Platform.OS = 'ios';
      launchCamera.mockRejectedValue(new Error('crash'));

      const result = await CameraService.takePhoto();
      expect(result.success).toBe(false);
      expect(result.suggestGallery).toBe(true);
    });
  });

  describe('selectPhoto', () => {
    it('returns photo data on success', async () => {
      launchImageLibrary.mockResolvedValue({
        assets: [{ uri: 'file://gallery.jpg', type: 'image/jpeg', fileName: 'gallery.jpg', fileSize: 2048, width: 800, height: 600 }],
      });

      const result = await CameraService.selectPhoto();
      expect(result.success).toBe(true);
      expect(result.data.uri).toBe('file://gallery.jpg');
    });

    it('returns error when user cancels', async () => {
      launchImageLibrary.mockResolvedValue({ didCancel: true });
      const result = await CameraService.selectPhoto();
      expect(result.success).toBe(false);
    });

    it('returns error on gallery error', async () => {
      launchImageLibrary.mockResolvedValue({ errorCode: 'err', errorMessage: 'Gallery broken' });
      const result = await CameraService.selectPhoto();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Gallery broken');
    });

    it('handles exception', async () => {
      launchImageLibrary.mockRejectedValue(new Error('boom'));
      const result = await CameraService.selectPhoto();
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });
  });

  describe('selectMultiplePhotos', () => {
    it('returns array of photos', async () => {
      launchImageLibrary.mockResolvedValue({
        assets: [
          { uri: 'a.jpg', type: 'image/jpeg', fileName: 'a.jpg', fileSize: 100, width: 10, height: 10 },
          { uri: 'b.jpg', type: 'image/jpeg', fileName: 'b.jpg', fileSize: 200, width: 20, height: 20 },
        ],
      });

      const result = await CameraService.selectMultiplePhotos();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('passes selectionLimit 10', async () => {
      launchImageLibrary.mockResolvedValue({ assets: [{ uri: 'x.jpg' }] });
      await CameraService.selectMultiplePhotos();
      expect(launchImageLibrary).toHaveBeenCalledWith(
        expect.objectContaining({ selectionLimit: 10 }),
      );
    });

    it('handles cancel', async () => {
      launchImageLibrary.mockResolvedValue({ didCancel: true });
      const result = await CameraService.selectMultiplePhotos();
      expect(result.success).toBe(false);
    });
  });

  describe('checkCameraPermissions', () => {
    it('returns hasPermission true when granted on android', async () => {
      Platform.OS = 'android';
      check.mockResolvedValue(RESULTS.GRANTED);

      const result = await CameraService.checkCameraPermissions();
      expect(result.success).toBe(true);
      expect(result.hasPermission).toBe(true);
    });

    it('returns hasPermission false when denied on android', async () => {
      Platform.OS = 'android';
      check.mockResolvedValue(RESULTS.DENIED);

      const result = await CameraService.checkCameraPermissions();
      expect(result.hasPermission).toBe(false);
    });

    it('returns warning on iOS', async () => {
      Platform.OS = 'ios';
      const result = await CameraService.checkCameraPermissions();
      expect(result.success).toBe(true);
      expect(result.platform).toBe('ios');
    });

    it('returns error on exception', async () => {
      Platform.OS = 'android';
      check.mockRejectedValue(new Error('fail'));
      const result = await CameraService.checkCameraPermissions();
      expect(result.success).toBe(false);
      expect(result.hasPermission).toBe(false);
    });
  });
});
