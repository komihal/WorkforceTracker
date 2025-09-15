import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// Mocks
jest.mock('react-native-config', () => ({ __esModule: true, default: {} }));
jest.mock('../src/services/authService', () => ({
  __esModule: true,
  default: {
    getCurrentUser: jest.fn().mockResolvedValue({ user_id: 123, worker_type: 'worker' }),
    logout: jest.fn(),
  },
}));

jest.mock('../src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDeviceId: jest.fn().mockResolvedValue('imei-123'),
    getNetworkInfo: jest.fn().mockResolvedValue({ isConnected: true }),
    isLocationAvailable: jest.fn().mockResolvedValue(true),
  },
}));

const mockManager = {
  setStatusUpdateCallback: jest.fn(),
  getCurrentStatus: jest
    .fn()
    .mockResolvedValue({ has_active_shift: false, worker: { worker_status: 'активен', user_id: 123 } }),
  sendPunch: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('../src/services/shiftStatusService', () => {
  const refreshShiftStatusNow = jest.fn();
  const ctor = jest.fn(function () { return mockManager; });
  return {
    __esModule: true,
    default: ctor,
    refreshShiftStatusNow,
    __mockedCtor: ctor,
  };
});

jest.mock('../src/services/cameraService', () => ({
  __esModule: true,
  default: {
    takePhoto: jest.fn(),
    selectPhoto: jest.fn(),
  },
}));

jest.mock('../src/services/permissionsService', () => ({
  __esModule: true,
  ensureAlwaysLocationPermission: jest.fn().mockResolvedValue(true),
  runSequentialPermissionFlow: jest.fn(),
  forceShowBackgroundPermissionDialog: jest.fn(),
  checkNotificationsPermissionOnAppActive: jest.fn(),
  requestBackgroundLocationTwoClicks: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/location.js', () => {
  const ensureTracking = jest.fn().mockResolvedValue();
  const stopTracking = jest.fn().mockResolvedValue();
  const getBatteryWhitelistStatus = jest.fn().mockResolvedValue({ available: true, ignored: true });
  const ensureBatteryWhitelistUI = jest.fn().mockResolvedValue();
  const mocked = { ensureTracking, stopTracking, getBatteryWhitelistStatus };
  return {
    __esModule: true,
    ...mocked,
    ensureBatteryWhitelistUI,
    __mocked: mocked,
  };
});

// Mock BGGeo reset helper to avoid importing RN BGGeolocation ESM
jest.mock('../force_reset_bggeo', () => ({
  __esModule: true,
  checkBGGeoConfig: jest.fn().mockResolvedValue({ hasMathFloor: false }),
  forceResetBGGeo: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/services/geoService', () => ({
  __esModule: true,
  default: {
    getCurrentLocation: jest.fn().mockResolvedValue({ latitude: 55.75, longitude: 37.61, altitude: 0 }),
    addGeoPoint: jest.fn(() => ({})),
    saveGeoData: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../src/services/fileUploadService', () => ({
  __esModule: true,
  default: {
    uploadShiftPhoto: jest.fn().mockResolvedValue({ success: true }),
  },
}));

jest.mock('../src/services/backgroundService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(),
  },
}));

// disable_polling_websockets.js удален - polling и websockets полностью убраны из проекта

import MainScreen from '../src/components/MainScreen';
import cameraService from '../src/services/cameraService';

describe('MainScreen handlePunchIn prestart tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderScreen = async () => {
    const utils = render(<MainScreen onLogout={jest.fn()} />);
    // дождаться, когда инициализируется ShiftStatusManager в useEffect
    const svc = require('../src/services/shiftStatusService');
    await waitFor(() => expect(svc.__mockedCtor).toHaveBeenCalled());
    return utils;
  };

  test('pre-start tracking and rollback when selfie missing', async () => {
    const loc = require('../src/location.js');
    cameraService.takePhoto.mockResolvedValueOnce({ success: false });
    cameraService.selectPhoto.mockResolvedValueOnce({ success: false });
    mockManager.sendPunch.mockResolvedValueOnce({ success: false, error: 'should not be called' });

    const { getByText } = await renderScreen();

    const btn = getByText('Открыть смену');
    fireEvent.press(btn);

    await waitFor(() => expect(loc.ensureTracking).toHaveBeenCalled());
    await waitFor(() => expect(loc.stopTracking).toHaveBeenCalled());
    expect(mockManager.sendPunch).not.toHaveBeenCalled();
  });

  test('pre-start tracking and keep on punch success', async () => {
    const loc = require('../src/location.js');
    cameraService.takePhoto.mockResolvedValueOnce({ success: true, data: { uri: 'file:///selfie.jpg' } });
    mockManager.sendPunch.mockResolvedValueOnce({ success: true, data: {} });

    const { getByText } = await renderScreen();

    const btn = getByText('Открыть смену');
    // обнуляем счетчики перед действием
    loc.ensureTracking.mockClear();
    loc.stopTracking.mockClear();
    fireEvent.press(btn);

    await waitFor(() => expect(loc.ensureTracking).toHaveBeenCalled());
    await waitFor(() => expect(mockManager.sendPunch).toHaveBeenCalled());
    // Не должно быть отката
    expect(loc.stopTracking).not.toHaveBeenCalled();
  });

  test('pre-start tracking and rollback on punch failure', async () => {
    const loc = require('../src/location.js');
    cameraService.takePhoto.mockResolvedValueOnce({ success: true, data: { uri: 'file:///selfie.jpg' } });
    mockManager.sendPunch.mockResolvedValueOnce({ success: false, error: 'server error' });

    const { getByText } = await renderScreen();

    const btn = getByText('Открыть смену');
    // обнуляем счетчики перед действием
    loc.ensureTracking.mockClear();
    loc.stopTracking.mockClear();
    fireEvent.press(btn);

    await waitFor(() => expect(loc.ensureTracking).toHaveBeenCalled());
    await waitFor(() => expect(mockManager.sendPunch).toHaveBeenCalled());
    await waitFor(() => expect(loc.stopTracking).toHaveBeenCalled());
  });
});


