jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react', () => ({
  useSyncExternalStore: jest.fn((subscribe, getSnapshot) => getSnapshot()),
}));

let shiftStore;
let AsyncStorage;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  shiftStore = require('../src/store/shiftStore');
  AsyncStorage = require('@react-native-async-storage/async-storage');
});

describe('shiftStore', () => {
  describe('getState', () => {
    it('returns initial state', () => {
      const state = shiftStore.getState();
      expect(state).toEqual(
        expect.objectContaining({
          isActive: false,
          shiftId: null,
          shiftStart: null,
          sourceOfTruth: 'local',
        }),
      );
    });
  });

  describe('setFromServer', () => {
    it('sets active shift from server snapshot', () => {
      shiftStore.setFromServer({
        has_active_shift: true,
        active_shift: { id: 10, shift_start: '2024-01-01T08:00:00' },
      });

      const state = shiftStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.shiftId).toBe(10);
      expect(state.shiftStart).toBe('2024-01-01T08:00:00');
      expect(state.sourceOfTruth).toBe('server');
    });

    it('sets inactive when no active shift', () => {
      shiftStore.setFromServer({ has_active_shift: false });

      const state = shiftStore.getState();
      expect(state.isActive).toBe(false);
      expect(state.shiftId).toBeNull();
    });

    it('handles null snapshot', () => {
      shiftStore.setFromServer(null);

      const state = shiftStore.getState();
      expect(state.isActive).toBe(false);
    });

    it('persists state to AsyncStorage', async () => {
      shiftStore.setFromServer({ has_active_shift: true, active_shift: { id: 5 } });

      // wait for async persist
      await new Promise((r) => setTimeout(r, 10));

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'shiftStore@v1',
        expect.stringContaining('"isActive":true'),
      );
    });

    it('extracts shift_id from alternative field', () => {
      shiftStore.setFromServer({
        has_active_shift: true,
        active_shift: { shift_id: 99 },
      });

      expect(shiftStore.getState().shiftId).toBe(99);
    });
  });

  describe('setFromLocal', () => {
    it('sets local state', () => {
      shiftStore.setFromLocal({ isActive: true, shiftId: 7 });

      const state = shiftStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.shiftId).toBe(7);
      expect(state.sourceOfTruth).toBe('local');
    });
  });

  describe('hydrateFromCache', () => {
    it('restores state from AsyncStorage when fresh', async () => {
      const cached = JSON.stringify({
        isActive: true,
        shiftId: 55,
        shiftStart: '2024-06-01',
        sourceOfTruth: 'server',
        _ts: Date.now() - 60 * 1000, // 1 min ago — within TTL
      });
      AsyncStorage.getItem.mockResolvedValue(cached);

      await shiftStore.hydrateFromCache();

      const state = shiftStore.getState();
      expect(state.isActive).toBe(true);
      expect(state.shiftId).toBe(55);
    });

    it('does not restore expired cache', async () => {
      const cached = JSON.stringify({
        isActive: true,
        shiftId: 55,
        _ts: Date.now() - 15 * 60 * 1000, // 15 min ago — expired
      });
      AsyncStorage.getItem.mockResolvedValue(cached);

      // Reset modules to get fresh state
      jest.resetModules();
      shiftStore = require('../src/store/shiftStore');

      await shiftStore.hydrateFromCache();

      expect(shiftStore.getState().isActive).toBe(false);
    });

    it('does nothing when no cached data', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);

      await shiftStore.hydrateFromCache();

      expect(shiftStore.getState().isActive).toBe(false);
    });

    it('handles invalid JSON gracefully', async () => {
      AsyncStorage.getItem.mockResolvedValue('invalid-json');

      await expect(shiftStore.hydrateFromCache()).resolves.not.toThrow();
    });

    it('handles missing _ts field', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ isActive: true }));

      await shiftStore.hydrateFromCache();

      // Should not restore without _ts
      expect(shiftStore.getState().isActive).toBe(false);
    });
  });

  describe('useShiftStore', () => {
    it('returns selected state via useSyncExternalStore', () => {
      shiftStore.setFromLocal({ isActive: true });
      const result = shiftStore.useShiftStore((s) => s.isActive);
      expect(result).toBe(true);
    });

    it('works with default selector', () => {
      const result = shiftStore.useShiftStore();
      expect(result).toHaveProperty('isActive');
    });
  });

  describe('initShiftStore', () => {
    it('calls hydrateFromCache', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      await shiftStore.initShiftStore();
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('shiftStore@v1');
    });
  });

  describe('listener notifications', () => {
    it('notifies listeners on state change', () => {
      const listener = jest.fn();

      // Subscribe
      const { useSyncExternalStore } = require('react');
      // Access internal subscribe by using useShiftStore which calls useSyncExternalStore
      let subscribeFn;
      useSyncExternalStore.mockImplementation((sub, snap) => {
        subscribeFn = sub;
        return snap();
      });

      shiftStore.useShiftStore();

      // Subscribe via the extracted function
      const unsub = subscribeFn(listener);

      shiftStore.setFromLocal({ isActive: true });

      expect(listener).toHaveBeenCalled();

      // Cleanup
      unsub();
    });
  });
});
