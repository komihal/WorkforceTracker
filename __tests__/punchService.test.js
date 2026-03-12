jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com',
    API_TOKEN: 'test-token',
    ENDPOINTS: {
      PUNCH: '/api/punch/',
      WORKER_STATUS: '/api/worker-status/',
      ACTIVE_SHIFT: '/api/active-shift/',
      UNBLOCK_REQUEST: '/api/unblock-requests/',
    },
  },
  getApiTokenHeaders: () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  }),
}));

import PunchService from '../src/services/punchService';

// Spy on the actual axios instance methods
const mockPost = jest.spyOn(PunchService.axiosInstance, 'post');
const mockGet = jest.spyOn(PunchService.axiosInstance, 'get');

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
  delete global.cachedShiftStatus;
});

describe('PunchService', () => {
  describe('punchIn', () => {
    it('returns success on valid response', async () => {
      mockPost.mockResolvedValue({ data: { success: true, shift_id: 1 } });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result).toEqual({ success: true, data: { success: true, shift_id: 1 } });
      expect(mockPost).toHaveBeenCalledWith(
        '/api/punch/',
        expect.objectContaining({ user_id: 42, status: 1, phone_imei: 'imei123', photo_name: 'photo.jpg' }),
        expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }),
      );
    });

    it('returns error when success is false', async () => {
      mockPost.mockResolvedValue({ data: { success: false, message: 'Смена уже открыта' } });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result).toEqual({ success: false, error: 'Смена уже открыта' });
    });

    it('returns default error message when no server message', async () => {
      mockPost.mockResolvedValue({ data: { success: false } });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Ошибка начала смены');
    });

    it('handles network error', async () => {
      mockPost.mockRejectedValue({ code: 'NETWORK_ERROR' });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('подключения');
    });

    it('handles Network Error message', async () => {
      mockPost.mockRejectedValue({ message: 'Network Error' });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('подключения');
    });

    it('handles timeout error by code', async () => {
      mockPost.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('время ожидания');
    });

    it('handles timeout error by message', async () => {
      mockPost.mockRejectedValue({ message: 'timeout of 10000ms exceeded' });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('время ожидания');
    });

    it('handles blocked user (HTTP 423)', async () => {
      mockPost.mockRejectedValue({ response: { status: 423, data: {} } });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('заблокирован');
    });

    it('handles blocked user via server message', async () => {
      mockPost.mockRejectedValue({
        response: { status: 200, data: { message: 'Пользователь заблокирован' } },
      });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('заблокирован');
    });

    it.each([
      [400, 'Неверный запрос'],
      [401, 'Не авторизован'],
      [403, 'Доступ запрещен'],
      [404, 'временно недоступен'],
      [500, 'Ошибка сервера'],
      [502, 'временно недоступен'],
      [503, 'временно недоступен'],
      [504, 'временно недоступен'],
    ])('handles HTTP %i error', async (status, expectedMsg) => {
      mockPost.mockRejectedValue({ response: { status, data: {} } });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain(expectedMsg);
    });

    it('handles unknown HTTP error with server message', async () => {
      mockPost.mockRejectedValue({ response: { status: 422, data: { message: 'Custom error' } } });

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result).toEqual({ success: false, error: 'Custom error' });
    });

    it('returns generic network error when no status/message', async () => {
      mockPost.mockRejectedValue(new Error('Something went wrong'));

      const result = await PunchService.punchIn(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('подключиться');
    });
  });

  describe('punchOut', () => {
    it('returns success on valid response', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const result = await PunchService.punchOut(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith(
        '/api/punch/',
        expect.objectContaining({ user_id: 42, status: 0 }),
        expect.any(Object),
      );
    });

    it('returns error when success is false', async () => {
      mockPost.mockResolvedValue({ data: { success: false, message: 'Нет активной смены' } });

      const result = await PunchService.punchOut(42, 'imei123', 'photo.jpg');

      expect(result).toEqual({ success: false, error: 'Нет активной смены' });
    });

    it('handles network error', async () => {
      mockPost.mockRejectedValue({ message: 'Network Error' });

      const result = await PunchService.punchOut(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('подключения');
    });

    it('handles timeout', async () => {
      mockPost.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await PunchService.punchOut(42, 'imei123', 'photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('время ожидания');
    });
  });

  describe('autoPunchOut', () => {
    it('returns success and generates auto photo name', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const result = await PunchService.autoPunchOut(42, 'imei123');

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith(
        '/api/punch/',
        expect.objectContaining({
          status: 0,
          photo_name: expect.stringContaining('auto_close_'),
        }),
        expect.any(Object),
      );
    });

    it('handles errors', async () => {
      mockPost.mockRejectedValue({ code: 'ECONNABORTED' });

      const result = await PunchService.autoPunchOut(42, 'imei123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('время ожидания');
    });
  });

  describe('getWorkerStatus', () => {
    it('returns success when user_id present', async () => {
      mockGet.mockResolvedValue({ data: { user_id: 42, worker_status: 'WORKING' } });

      const result = await PunchService.getWorkerStatus(42);

      expect(result.success).toBe(true);
      expect(result.data.worker_status).toBe('WORKING');
    });

    it('returns error when no valid data', async () => {
      mockGet.mockResolvedValue({ data: {} });

      const result = await PunchService.getWorkerStatus(42);

      expect(result.success).toBe(false);
    });

    it('handles HTTP 401', async () => {
      mockGet.mockRejectedValue({ response: { status: 401, data: {} } });

      const result = await PunchService.getWorkerStatus(42);

      expect(result.success).toBe(false);
      expect(result.error).toContain('авторизован');
    });

    it('handles network error', async () => {
      mockGet.mockRejectedValue({ code: 'NETWORK_ERROR' });

      const result = await PunchService.getWorkerStatus(42);

      expect(result.success).toBe(false);
      expect(result.error).toContain('подключения');
    });
  });

  describe('getShiftStatus', () => {
    it('returns active shift data', async () => {
      mockGet.mockResolvedValue({
        data: { has_active_shift: true, worker: { id: 1 }, active_shift: { id: 10, shift_start: '2024-01-01' } },
      });

      const result = await PunchService.getShiftStatus(42);

      expect(result.success).toBe(true);
      expect(result.data.is_working).toBe(true);
      expect(result.data.shift_active).toBe(true);
      expect(result.data.active_shift).toEqual({ id: 10, shift_start: '2024-01-01' });
    });

    it('caches successful response', async () => {
      mockGet.mockResolvedValue({ data: { has_active_shift: true } });

      await PunchService.getShiftStatus(42);

      expect(global.cachedShiftStatus).toBeDefined();
      expect(global.cachedShiftStatus.hasActiveShift).toBe(true);
      expect(global.cachedShiftStatus.userId).toBe(42);
    });

    it('returns inactive shift data', async () => {
      mockGet.mockResolvedValue({ data: { has_active_shift: false } });

      const result = await PunchService.getShiftStatus(42);

      expect(result.success).toBe(true);
      expect(result.data.is_working).toBe(false);
    });

    it('uses cached status on network error (cache fresh)', async () => {
      global.cachedShiftStatus = {
        hasActiveShift: true,
        timestamp: Date.now(),
        userId: 42,
        fullData: { has_active_shift: true, worker: { id: 1 } },
      };

      mockGet.mockRejectedValue({ code: 'NETWORK_ERROR' });

      const result = await PunchService.getShiftStatus(42);

      expect(result.success).toBe(true);
      expect(result.data.is_working).toBe(true);
    });

    it('does not use expired cache', async () => {
      global.cachedShiftStatus = {
        hasActiveShift: true,
        timestamp: Date.now() - 10 * 60 * 1000,
        userId: 42,
        fullData: {},
      };

      mockGet.mockRejectedValue({ code: 'NETWORK_ERROR' });

      const result = await PunchService.getShiftStatus(42);

      expect(result.success).toBe(false);
    });

    it('does not use cache for different user', async () => {
      global.cachedShiftStatus = {
        hasActiveShift: true,
        timestamp: Date.now(),
        userId: 99,
        fullData: {},
      };

      mockGet.mockRejectedValue({ code: 'NETWORK_ERROR' });

      const result = await PunchService.getShiftStatus(42);

      expect(result.success).toBe(false);
    });
  });

  describe('requestUnblock', () => {
    it('returns success', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      const result = await PunchService.requestUnblock(42);

      expect(result.success).toBe(true);
    });

    it('handles error', async () => {
      mockPost.mockResolvedValue({ data: { success: false, message: 'Запрос уже отправлен' } });

      const result = await PunchService.requestUnblock(42);

      expect(result).toEqual({ success: false, error: 'Запрос уже отправлен' });
    });

    it('handles blocked user in catch block', async () => {
      mockPost.mockRejectedValue({ response: { status: 423, data: {} } });

      const result = await PunchService.requestUnblock(42);

      expect(result.error).toContain('заблокирован');
    });
  });
});
