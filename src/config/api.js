export const API_CONFIG = {
  BASE_URL: 'https://api.tabelshik.com',
  API_TOKEN: 'wqHJerK834',
  ENDPOINTS: {
    AUTH: '/auth/',
    PUNCH: '/punch/',
    DB_SAVE: '/db_save/',
    FILE_UPLOAD: '/api/file_upload/',
    USER_PHOTOS: '/api/user-photos/',
    WORKER_STATUS: '/api/worker-status/',
    WORKER_REVIEW: '/api/worker-review/',
    UNBLOCK_REQUEST: '/api/unblock-requests/',
  },
  HEADERS: {
    'Content-Type': 'application/json',
    'Api-token': 'wqHJerK834',
  },
};

export const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
});

export const getApiTokenHeaders = () => ({
  'Content-Type': 'application/json',
  'Api-token': API_CONFIG.API_TOKEN,
});


// Webhook конфигурация для мониторинга фоновой активности
export const WEBHOOK_CONFIG = {
  MONITORING_URL: 'https://api.tabelshik.com/webhook/',
  GEO_DATA_URL: 'https://api.tabelshik.com/webhook/geo',
  PHOTO_UPLOAD_URL: 'https://api.tabelshik.com/webhook/photo',
  BACKGROUND_ACTIVITY_URL: 'https://api.tabelshik.com/webhook/background',
  ENABLED: true,
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  LOG_ALL_ACTIVITY: false,
};

// Функция для отправки данных на webhook
export const sendToWebhook = async (data, type = 'general') => {
  if (!WEBHOOK_CONFIG.ENABLED) {
    console.log('Webhook disabled, skipping...');
    return { success: false, error: 'Webhook disabled' };
  }

  try {
    const url = WEBHOOK_CONFIG.MONITORING_URL;
    const payload = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };

    console.log(`[WEBHOOK] Sending ${type} to ${url}:`, payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: WEBHOOK_CONFIG.TIMEOUT,
    });

    if (response.ok) {
      console.log(`[WEBHOOK] Successfully sent ${type}`);
      return { success: true, response: await response.text() };
    } else {
      console.log(`[WEBHOOK] Failed to send ${type}: ${response.status} ${response.statusText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`[WEBHOOK] Error sending ${type}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Специализированные функции для разных типов данных
export const sendGeoDataToWebhook = async (geoData) => {
  return await sendToWebhook(geoData, 'geo_data');
};

export const sendBackgroundActivityToWebhook = async (activityData) => {
  // Monitoring of background activity is disabled to avoid duplicate webhook traffic
  if (!WEBHOOK_CONFIG.LOG_ALL_ACTIVITY) {
    return { success: false, skipped: true };
  }
  return await sendToWebhook(activityData, 'background_activity');
};

export const sendPhotoUploadToWebhook = async (photoData) => {
  return await sendToWebhook(photoData, 'photo_upload');
};

// Функция для отправки геолокации на webhook
export const sendLocationToWebhook = async (locationData) => {
  const webhookData = {
    type: 'location',
    timestamp: new Date().toISOString(),
    data: {
      lat: locationData.lat,
      lon: locationData.lon,
      accuracy: locationData.accuracy,
      speed: locationData.speed,
      heading: locationData.heading,
      ts: locationData.ts,
      batt: locationData.batt,
      motion: locationData.motion,
      alt: locationData.alt,
      altmsl: locationData.altmsl,
      userId: locationData.userId,
      placeId: locationData.placeId,
      phoneImei: locationData.phoneImei
    }
  };
  
  return await sendToWebhook(webhookData, 'location');
};

