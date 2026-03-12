jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

jest.mock('../src/services/geoService', () => ({
  default: {},
}));

jest.mock('../src/services/fileUploadService', () => ({
  default: {},
}));

let BackgroundService;
let AsyncStorage;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  BackgroundService = require('../src/services/backgroundService').default;
  AsyncStorage = require('@react-native-async-storage/async-storage');
});

describe('BackgroundService', () => {
  describe('initial state', () => {
    it('starts not running', () => {
      expect(BackgroundService.isRunning).toBe(false);
    });

    it('has empty queues', () => {
      expect(BackgroundService.pendingPhotos).toEqual([]);
      expect(BackgroundService.pendingGeoData).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('sets user data and loads pending data', async () => {
      await BackgroundService.initialize('user1', 'place1', 'imei1', false);

      expect(BackgroundService.currentUserId).toBe('user1');
      expect(BackgroundService.currentPlaceId).toBe('place1');
      expect(BackgroundService.currentPhoneImei).toBe('imei1');
      expect(BackgroundService.isTestMode).toBe(false);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('pendingPhotos');
    });

    it('starts background tasks', async () => {
      await BackgroundService.initialize('user1', 'place1', 'imei1');

      expect(BackgroundService.isRunning).toBe(true);
    });

    it('accepts test mode', async () => {
      await BackgroundService.initialize('user1', 'place1', 'imei1', true);

      expect(BackgroundService.isTestMode).toBe(true);
    });
  });

  describe('stop', () => {
    it('sets isRunning to false', async () => {
      await BackgroundService.initialize('user1', 'place1', 'imei1');
      BackgroundService.stop();

      expect(BackgroundService.isRunning).toBe(false);
    });
  });

  describe('handleAppStateChange', () => {
    it('updates appState', () => {
      BackgroundService.handleAppStateChange('background');
      expect(BackgroundService.appState).toBe('background');
    });

    it('processes pending data when becoming active', async () => {
      BackgroundService.pendingPhotos = [{ id: 1, uploaded: false }];
      BackgroundService.isRunning = true;

      BackgroundService.handleAppStateChange('active');
      // processPendingData called — no throw
    });
  });

  describe('addPhotoToQueue', () => {
    it('adds photo with metadata', async () => {
      await BackgroundService.addPhotoToQueue({ uri: 'file://photo.jpg' });

      expect(BackgroundService.pendingPhotos).toHaveLength(1);
      expect(BackgroundService.pendingPhotos[0]).toEqual(
        expect.objectContaining({
          data: { uri: 'file://photo.jpg' },
          uploaded: false,
        }),
      );
    });

    it('saves to AsyncStorage', async () => {
      await BackgroundService.addPhotoToQueue({ uri: 'test.jpg' });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPhotos',
        expect.any(String),
      );
    });
  });

  describe('loadPendingData', () => {
    it('loads saved photos', async () => {
      const saved = [{ id: 1, data: 'photo', uploaded: false }];
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'pendingPhotos') return Promise.resolve(JSON.stringify(saved));
        return Promise.resolve(null);
      });

      await BackgroundService.loadPendingData();

      expect(BackgroundService.pendingPhotos).toEqual(saved);
    });

    it('loads saved geo data', async () => {
      const savedGeo = [{ lat: 1, lon: 2 }];
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === 'pendingGeoData') return Promise.resolve(JSON.stringify(savedGeo));
        return Promise.resolve(null);
      });

      await BackgroundService.loadPendingData();

      expect(BackgroundService.pendingGeoData).toEqual(savedGeo);
    });

    it('handles storage errors gracefully', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      await expect(BackgroundService.loadPendingData()).resolves.not.toThrow();
    });
  });

  describe('startBackgroundTasks', () => {
    it('sets isRunning to true', () => {
      BackgroundService.startBackgroundTasks();
      expect(BackgroundService.isRunning).toBe(true);
    });

    it('does not restart if already running', () => {
      BackgroundService.isRunning = true;
      BackgroundService.startBackgroundTasks();
      // No error
      expect(BackgroundService.isRunning).toBe(true);
    });
  });

  describe('uploadPendingData', () => {
    it('does nothing when not running', async () => {
      BackgroundService.isRunning = false;
      BackgroundService.pendingPhotos = [{ id: 1, uploaded: false }];

      await BackgroundService.uploadPendingData();

      // Photo should not be uploaded
      expect(BackgroundService.pendingPhotos).toHaveLength(1);
    });

    it('filters uploaded photos', async () => {
      BackgroundService.isRunning = true;
      BackgroundService.pendingPhotos = [
        { id: 1, uploaded: true },
        { id: 2, uploaded: false },
      ];

      await BackgroundService.uploadPendingData();

      // Uploaded photos are removed
      expect(BackgroundService.pendingPhotos).toHaveLength(1);
      expect(BackgroundService.pendingPhotos[0].id).toBe(2);
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', () => {
      BackgroundService.isRunning = true;
      BackgroundService.isTestMode = true;
      BackgroundService.pendingPhotos = [
        { id: 1, uploaded: false },
        { id: 2, uploaded: true },
        { id: 3, uploaded: false },
      ];

      const stats = BackgroundService.getStats();

      expect(stats.pendingPhotos).toBe(2);
      expect(stats.pendingGeoData).toBe(0);
      expect(stats.isRunning).toBe(true);
      expect(stats.isTestMode).toBe(true);
      expect(stats.mode).toBe('photos-only');
    });
  });

  describe('toggleTestMode', () => {
    it('toggles test mode', () => {
      BackgroundService.isTestMode = false;
      BackgroundService.toggleTestMode();
      expect(BackgroundService.isTestMode).toBe(true);
      BackgroundService.toggleTestMode();
      expect(BackgroundService.isTestMode).toBe(false);
    });
  });

  describe('setTestMode', () => {
    it('sets test mode explicitly', () => {
      BackgroundService.setTestMode(true);
      expect(BackgroundService.isTestMode).toBe(true);
      BackgroundService.setTestMode(false);
      expect(BackgroundService.isTestMode).toBe(false);
    });
  });

  describe('forceUpload', () => {
    it('calls uploadPendingData', async () => {
      BackgroundService.isRunning = true;
      BackgroundService.pendingPhotos = [];

      await expect(BackgroundService.forceUpload()).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('removes app state subscription', () => {
      const removeMock = jest.fn();
      BackgroundService.appStateSubscription = { remove: removeMock };

      BackgroundService.cleanup();

      expect(removeMock).toHaveBeenCalled();
      expect(BackgroundService.appStateSubscription).toBeNull();
    });

    it('handles no subscription gracefully', () => {
      BackgroundService.appStateSubscription = null;
      expect(() => BackgroundService.cleanup()).not.toThrow();
    });
  });
});
