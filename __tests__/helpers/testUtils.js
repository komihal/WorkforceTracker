// Shared test utilities for WorkforceTracker

// Mock API_CONFIG factory — used in 4+ test files
export const createMockApiConfig = (overrides = {}) => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com',
    API_TOKEN: 'test-token',
    ENDPOINTS: {
      AUTH: '/auth/',
      PUNCH: '/api/punch/',
      DB_SAVE: '/api/db_save/',
      FILE_UPLOAD: '/api/file_upload/',
      USER_PHOTOS: '/api/user-photos/',
      WORKER_STATUS: '/api/worker-status/',
      WORKER_REVIEW: '/api/worker-review/',
      UNBLOCK_REQUEST: '/api/unblock-requests/',
      USER_STATUS: '/api/users/',
      WORKSHIFTS: '/api/workshifts/',
      SHIFTS: '/api/shifts/',
      PUNCHES: '/api/punches/',
      ACTIVE_SHIFT: '/api/active-shift/',
    },
    HEADERS: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    ...overrides,
  },
  getApiTokenHeaders: () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  }),
  getAuthHeaders: () => ({
    'Content-Type': 'application/json',
  }),
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
});

// Fetch mock helper — used in 3+ test files
export const setupFetchMock = () => {
  global.fetch = jest.fn();
  return {
    mockSuccess: (data) =>
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
      }),
    mockError: (status = 500) =>
      global.fetch.mockResolvedValue({
        ok: false,
        status,
        statusText: 'Error',
        text: () => Promise.resolve('Error'),
      }),
    mockNetworkError: () =>
      global.fetch.mockRejectedValue(new Error('Network error')),
    reset: () => global.fetch.mockReset(),
  };
};

// Platform mock factory
export const createPlatformMock = (os = 'android', version = 30) => ({
  OS: os,
  Version: version,
  select: jest.fn((obj) => obj[os] || obj.default),
});
