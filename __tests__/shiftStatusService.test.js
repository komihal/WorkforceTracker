// Mock fetch globally
global.fetch = jest.fn();

jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com',
    API_TOKEN: 'test-token',
    ENDPOINTS: {
      PUNCH: '/api/punch/',
      ACTIVE_SHIFT: '/api/active-shift/',
    },
  },
}));

jest.mock('../src/store/shiftStore', () => ({
  setFromServer: jest.fn(),
}));

let ShiftStatusManager, refreshShiftStatusNow, forceRefreshShiftStatus;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  global.fetch.mockReset();

  const mod = require('../src/services/shiftStatusService');
  ShiftStatusManager = mod.default;
  refreshShiftStatusNow = mod.refreshShiftStatusNow;
  forceRefreshShiftStatus = mod.forceRefreshShiftStatus;
});

describe('ShiftStatusManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ShiftStatusManager('user42', 'device123');
  });

  describe('constructor', () => {
    it('initializes with userId and deviceId', () => {
      expect(manager.userId).toBe('user42');
      expect(manager.deviceId).toBe('device123');
      expect(manager.statusUpdateCallback).toBeNull();
    });
  });

  describe('setStatusUpdateCallback', () => {
    it('sets the callback', () => {
      const cb = jest.fn();
      manager.setStatusUpdateCallback(cb);
      expect(manager.statusUpdateCallback).toBe(cb);
    });
  });

  describe('connect / startPolling / stopPolling / disconnect', () => {
    it('are no-op stubs', () => {
      expect(() => manager.connect()).not.toThrow();
      expect(() => manager.startPolling()).not.toThrow();
      expect(() => manager.stopPolling()).not.toThrow();
    });

    it('disconnect clears callback', () => {
      manager.statusUpdateCallback = jest.fn();
      manager.disconnect();
      expect(manager.statusUpdateCallback).toBeNull();
    });
  });

  describe('updateUI', () => {
    it('calls callback with data', () => {
      const cb = jest.fn();
      manager.setStatusUpdateCallback(cb);
      manager.updateUI({ has_active_shift: true });
      expect(cb).toHaveBeenCalledWith({ has_active_shift: true });
    });

    it('does nothing if no callback', () => {
      expect(() => manager.updateUI({ has_active_shift: true })).not.toThrow();
    });
  });

  describe('getCurrentStatus', () => {
    it('returns parsed data on success', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: true, worker: { id: 1 } })),
      });

      const result = await manager.getCurrentStatus();

      expect(result).toEqual({ has_active_shift: true, worker: { id: 1 } });
    });

    it('returns default on HTTP error', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Error' });

      const result = await manager.getCurrentStatus();

      expect(result).toEqual({ has_active_shift: false });
    });

    it('returns default on exception', async () => {
      global.fetch.mockRejectedValue(new Error('Network failed'));

      const result = await manager.getCurrentStatus();

      expect(result).toEqual({ has_active_shift: false });
    });

    it('returns default on invalid JSON', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not-json'),
      });

      const result = await manager.getCurrentStatus();

      expect(result).toEqual({ has_active_shift: false });
    });
  });

  describe('sendPunch', () => {
    it('sends punch data and returns success', async () => {
      // Mock sendPunch's fetch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });
      // Mock getCurrentStatus calls after punch
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: true })),
      });

      const result = await manager.sendPunch(1, 'photo.jpg', 1234567890);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/punch/',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"status":1'),
        }),
      );
    });

    it('returns error on punch failure', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: false, error: 'Server error' })),
      });

      const result = await manager.sendPunch(0);

      expect(result).toEqual({ success: false, error: 'Server error' });
    });

    it('handles fetch exception', async () => {
      global.fetch.mockRejectedValue(new Error('Network down'));

      const result = await manager.sendPunch(1);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network down');
    });

    it('handles invalid JSON response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('not-json'),
      });

      const result = await manager.sendPunch(1);

      expect(result.success).toBe(false);
    });

    it('generates default photo_name when not provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: true })),
      });

      await manager.sendPunch(1);

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.photo_name).toMatch(/^punch_1_\d+\.jpg$/);
    });
  });

  describe('toggleShift', () => {
    it('sends punch in when no active shift', async () => {
      // getCurrentStatus
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: false })),
      });
      // sendPunch
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });
      // getCurrentStatus after punch
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: true })),
      });

      const result = await manager.toggleShift();

      expect(result.success).toBe(true);
      // Verify punch status=1 was sent
      const punchCall = global.fetch.mock.calls[1];
      const body = JSON.parse(punchCall[1].body);
      expect(body.status).toBe(1);
    });

    it('sends punch out when active shift exists', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: true })),
      });
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ has_active_shift: false })),
      });

      const result = await manager.toggleShift();

      expect(result.success).toBe(true);
      const punchCall = global.fetch.mock.calls[1];
      const body = JSON.parse(punchCall[1].body);
      expect(body.status).toBe(0);
    });
  });
});

describe('refreshShiftStatusNow', () => {
  it('returns data on success', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ has_active_shift: true })),
    });

    const result = await refreshShiftStatusNow('user42');

    expect(result).toEqual({ has_active_shift: true });
  });

  it('returns default on failure', async () => {
    global.fetch.mockRejectedValue(new Error('error'));

    const result = await refreshShiftStatusNow('user42');

    expect(result).toEqual({ has_active_shift: false });
  });

  it('returns default on HTTP error', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 });

    const result = await refreshShiftStatusNow('user42');

    expect(result).toEqual({ has_active_shift: false });
  });
});

describe('forceRefreshShiftStatus', () => {
  it('refreshes and updates store', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ has_active_shift: true })),
    });

    const result = await forceRefreshShiftStatus('user42');

    expect(result).toEqual({ has_active_shift: true });
    const { setFromServer } = require('../src/store/shiftStore');
    expect(setFromServer).toHaveBeenCalledWith({ has_active_shift: true });
  });

  it('returns default on error', async () => {
    global.fetch.mockRejectedValue(new Error('fail'));

    const result = await forceRefreshShiftStatus('user42');

    expect(result).toEqual({ has_active_shift: false });
  });
});
