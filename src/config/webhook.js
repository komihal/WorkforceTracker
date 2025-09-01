export const WEBHOOK_CONFIG = {
  // Основной webhook для мониторинга
  MONITORING_URL: 'https://webhook.site/e0a0b957-d425-4537-b3d9-36f5416ec32e',
  
  // Дополнительные webhook'и для разных типов данных
  GEO_DATA_URL: 'https://webhook.site/e0a0b957-d425-4537-b3d9-36f5416ec32e/geo',
  PHOTO_UPLOAD_URL: 'https://webhook.site/e0a0b957-d425-4537-b3d9-36f5416ec32e/photo',
  BACKGROUND_ACTIVITY_URL: 'https://webhook.site/e0a0b957-d425-4537-b3d9-36f5416ec32e/background',
  
  // Настройки
  ENABLED: true, // Включить/выключить webhook
  TIMEOUT: 10000, // Таймаут в мс
  RETRY_ATTEMPTS: 3, // Количество попыток
  LOG_ALL_ACTIVITY: true, // Логировать всю активность
};

export const sendToWebhook = async (data, type = 'general') => {
  if (!WEBHOOK_CONFIG.ENABLED) {
    console.log('Webhook disabled, skipping...');
    return { success: false, error: 'Webhook disabled' };
  }

  try {
    const webhookData = {
      timestamp: new Date().toISOString(),
      type: type,
      app: 'WorkforceTracker',
      data: data,
      device: {
        platform: 'android',
        timestamp: Date.now(),
      }
    };

    console.log(`[Webhook] Sending ${type} data to webhook...`);
    
    const response = await fetch(WEBHOOK_CONFIG.MONITORING_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WorkforceTracker/1.0',
      },
      body: JSON.stringify(webhookData),
      timeout: WEBHOOK_CONFIG.TIMEOUT,
    });

    if (response.ok) {
      console.log(`[Webhook] ✅ ${type} data sent successfully to webhook`);
      return { success: true, status: response.status };
    } else {
      console.log(`[Webhook] ❌ Failed to send ${type} data: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error) {
    console.log(`[Webhook] ❌ Error sending ${type} data:`, error.message);
    return { success: false, error: error.message };
  }
};

export const sendGeoDataToWebhook = async (geoData) => {
  return sendToWebhook(geoData, 'geo_data');
};

export const sendBackgroundActivityToWebhook = async (activityData) => {
  return sendToWebhook(activityData, 'background_activity');
};

export const sendPhotoUploadToWebhook = async (photoData) => {
  return sendToWebhook(photoData, 'photo_upload');
};
