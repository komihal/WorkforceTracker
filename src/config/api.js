export const API_CONFIG = {
  BASE_URL: 'https://api.tabelshik.com',
  API_TOKEN: 'wqHJerK834',
  ENDPOINTS: {
    AUTH: '/auth/',
    PUNCH: '/punch/',
    DB_SAVE: '/db_save/',
    FILE_UPLOAD: '/file_upload/',
    USER_PHOTOS: '/api/user-photos/',
    WORKER_STATUS: '/api/worker-status/',
    WORKER_REVIEW: '/api/worker-review/',
  },
  HEADERS: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer wqHJerK834',
  },
};

export const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
});

export const getBearerHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_CONFIG.API_TOKEN}`,
});

