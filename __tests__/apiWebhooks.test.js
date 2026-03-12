// Test webhook functions from api.js
// WEBHOOK_CONFIG is a const object, so we mock the whole module
jest.mock('../src/config/api', () => {
  const actual = jest.requireActual('../src/config/api');
  // Override WEBHOOK_CONFIG with test values
  return {
    ...actual,
    WEBHOOK_CONFIG: {
      MONITORING_URL: 'https://api.test.com/webhook/',
      GEO_DATA_URL: 'https://api.test.com/webhook/geo',
      PHOTO_UPLOAD_URL: 'https://api.test.com/webhook/photo',
      BACKGROUND_ACTIVITY_URL: 'https://api.test.com/webhook/background',
      ENABLED: true,
      TIMEOUT: 10000,
      RETRY_ATTEMPTS: 3,
      LOG_ALL_ACTIVITY: false,
    },
  };
});

import {
  sendToWebhook,
  sendGeoDataToWebhook,
  sendBackgroundActivityToWebhook,
  sendPhotoUploadToWebhook,
  sendLocationToWebhook,
  WEBHOOK_CONFIG,
} from '../src/config/api';

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
});

describe('sendToWebhook', () => {
  it('sends data to webhook URL on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('OK'),
    });

    const result = await sendToWebhook({ key: 'value' }, 'test_type');

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe('test_type');
    expect(body.data).toEqual({ key: 'value' });
    expect(body.timestamp).toBeDefined();
  });

  it('returns error on HTTP failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await sendToWebhook({ key: 'value' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('returns error on network exception', async () => {
    global.fetch.mockRejectedValue(new Error('Connection refused'));

    const result = await sendToWebhook({ key: 'value' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});

describe('sendGeoDataToWebhook', () => {
  it('sends geo data with type geo_data', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });

    const result = await sendGeoDataToWebhook({ lat: 55.7, lon: 37.6 });

    expect(result.success).toBe(true);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe('geo_data');
  });
});

describe('sendBackgroundActivityToWebhook', () => {
  it('skips when LOG_ALL_ACTIVITY is false', async () => {
    const result = await sendBackgroundActivityToWebhook({ event: 'wake' });

    expect(result.skipped).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('sendPhotoUploadToWebhook', () => {
  it('sends photo data', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });

    const result = await sendPhotoUploadToWebhook({ photo_id: 1, url: 'photo.jpg' });

    expect(result.success).toBe(true);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe('photo_upload');
  });
});

describe('sendLocationToWebhook', () => {
  it('maps location fields correctly', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });

    const locationData = {
      lat: 55.75,
      lon: 37.61,
      accuracy: 10,
      speed: 5,
      heading: 180,
      ts: 1234567890,
      batt: 85,
      motion: true,
      alt: 150,
      altmsl: 148,
      userId: 42,
      placeId: 'place-1',
      phoneImei: 'imei-123',
    };

    const result = await sendLocationToWebhook(locationData);

    expect(result.success).toBe(true);
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.type).toBe('location');
    expect(body.data.data.lat).toBe(55.75);
    expect(body.data.data.lon).toBe(37.61);
    expect(body.data.data.userId).toBe(42);
    expect(body.data.data.phoneImei).toBe('imei-123');
  });
});
