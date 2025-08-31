import AuthService from '../src/services/authService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    AuthService.currentUser = null;
  });

  describe('getCurrentUser', () => {
    test('returns null when no user data', async () => {
      const result = await AuthService.getCurrentUser();
      expect(result).toBeNull();
    });

    test('returns user data when available', async () => {
      const mockUserData = { id: 1, username: 'testuser' };
      AuthService.currentUser = mockUserData;

      const result = await AuthService.getCurrentUser();
      expect(result).toEqual(mockUserData);
    });
  });

  describe('isAuthenticated', () => {
    test('returns false when no user', () => {
      AuthService.currentUser = null;
      expect(AuthService.isAuthenticated()).toBe(false);
    });

    test('returns true when user exists', () => {
      AuthService.currentUser = { id: 1, username: 'testuser' };
      expect(AuthService.isAuthenticated()).toBe(true);
    });
  });

  describe('saveUserData', () => {
    test('saves user data to instance and storage', async () => {
      const mockUserData = { id: 1, username: 'testuser' };
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      
      await AuthService.saveUserData(mockUserData);

      expect(AuthService.currentUser).toEqual(mockUserData);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('current_user', JSON.stringify(mockUserData));
    });
  });

  describe('clearUserData', () => {
    test('clears user data from instance and storage', async () => {
      const mockUserData = { id: 1, username: 'testuser' };
      AuthService.currentUser = mockUserData;
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      
      await AuthService.clearUserData();

      expect(AuthService.currentUser).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('current_user');
    });
  });
});
