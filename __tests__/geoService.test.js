import GeoService from '../src/services/geoService';

// Mock BackgroundGeolocation
jest.mock('react-native-background-geolocation', () => ({
  getCurrentPosition: jest.fn(),
  DESIRED_ACCURACY_HIGH: 0,
}));

describe('GeoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    GeoService.geoData = [];
  });

  describe('addGeoPoint', () => {
    test('adds new geo point with all parameters', () => {
      const geoPoint = GeoService.addGeoPoint(
        55.7558, // lat
        37.6176, // lon
        150,     // alt
        160,     // altMsl
        true,    // hasAlt
        true,    // hasAltMsl
        true,    // hasAltMslAccuracy
        5        // mslAccuracyMeters
      );

      expect(geoPoint).toEqual({
        lat: 55.7558,
        lon: 37.6176,
        utm: expect.any(Number),
        alt: 150,
        altmsl: 160,
        hasalt: true,
        hasaltmsl: true,
        hasaltmslaccucacy: true,
        mslaccucacyMeters: 5,
      });

      expect(GeoService.getGeoDataCount()).toBe(1);
    });

    test('adds geo point with default values', () => {
      const geoPoint = GeoService.addGeoPoint(55.7558, 37.6176);

      expect(geoPoint).toEqual({
        lat: 55.7558,
        lon: 37.6176,
        utm: expect.any(Number),
        alt: 0,
        altmsl: 0,
        hasalt: false,
        hasaltmsl: false,
        hasaltmslaccucacy: false,
        mslaccucacyMeters: 0,
      });
    });

    test('generates correct UTM timestamp', () => {
      const before = Math.floor(Date.now() / 1000);
      const geoPoint = GeoService.addGeoPoint(55.7558, 37.6176);
      const after = Math.floor(Date.now() / 1000);

      expect(geoPoint.utm).toBeGreaterThanOrEqual(before);
      expect(geoPoint.utm).toBeLessThanOrEqual(after);
    });
  });

  describe('getCurrentGeoData', () => {
    test('returns copy of geo data array', () => {
      GeoService.addGeoPoint(55.7558, 37.6176);
      GeoService.addGeoPoint(55.7559, 37.6177);

      const geoData = GeoService.getCurrentGeoData();
      
      expect(geoData).toHaveLength(2);
      expect(geoData).not.toBe(GeoService.geoData); // Should be a copy
      expect(geoData[0].lat).toBe(55.7558);
      expect(geoData[1].lat).toBe(55.7559);
    });

    test('returns empty array when no data', () => {
      const geoData = GeoService.getCurrentGeoData();
      expect(geoData).toEqual([]);
    });
  });

  describe('clearGeoData', () => {
    test('clears all geo data', () => {
      GeoService.addGeoPoint(55.7558, 37.6176);
      GeoService.addGeoPoint(55.7559, 37.6177);
      
      expect(GeoService.getGeoDataCount()).toBe(2);
      
      GeoService.clearGeoData();
      
      expect(GeoService.getGeoDataCount()).toBe(0);
      expect(GeoService.getCurrentGeoData()).toEqual([]);
    });
  });

  describe('getGeoDataCount', () => {
    test('returns correct count of geo points', () => {
      expect(GeoService.getGeoDataCount()).toBe(0);
      
      GeoService.addGeoPoint(55.7558, 37.6176);
      expect(GeoService.getGeoDataCount()).toBe(1);
      
      GeoService.addGeoPoint(55.7559, 37.6177);
      expect(GeoService.getGeoDataCount()).toBe(2);
    });
  });

  describe('getCurrentLocation', () => {
    test('successfully gets current location', async () => {
      const mockLocation = {
        coords: {
          latitude: 55.7558,
          longitude: 37.6176,
          altitude: 150,
          accuracy: 10,
        },
      };

      const BackgroundGeolocation = require('react-native-background-geolocation');
      BackgroundGeolocation.getCurrentPosition.mockResolvedValue(mockLocation);

      const result = await GeoService.getCurrentLocation();

      expect(result).toEqual({
        latitude: 55.7558,
        longitude: 37.6176,
        altitude: 150,
        accuracy: 10,
      });

      expect(BackgroundGeolocation.getCurrentPosition).toHaveBeenCalledWith({
        timeout: 15,
        samples: 1,
        persist: false,
        desiredAccuracy: 0, // DESIRED_ACCURACY_HIGH
      });
    });

    test('handles location error', async () => {
      const locationError = new Error('Location permission denied');
      
      const BackgroundGeolocation = require('react-native-background-geolocation');
      BackgroundGeolocation.getCurrentPosition.mockRejectedValue(locationError);

      await expect(GeoService.getCurrentLocation()).rejects.toThrow('Location permission denied');
    });

    test('handles location with missing coords', async () => {
      const mockLocation = {};

      const BackgroundGeolocation = require('react-native-background-geolocation');
      BackgroundGeolocation.getCurrentPosition.mockResolvedValue(mockLocation);

      const result = await GeoService.getCurrentLocation();

      expect(result).toEqual({
        latitude: undefined,
        longitude: undefined,
        altitude: undefined,
        accuracy: undefined,
      });
    });
  });

  describe('integration scenarios', () => {
    test('complete workflow: add points, clear', () => {
      // Add multiple geo points
      GeoService.addGeoPoint(55.7558, 37.6176, 150, 160, true, true, true, 5);
      GeoService.addGeoPoint(55.7559, 37.6177, 151, 161, true, true, true, 6);
      GeoService.addGeoPoint(55.7560, 37.6178, 152, 162, true, true, true, 7);

      expect(GeoService.getGeoDataCount()).toBe(3);

      // Verify data structure
      const geoData = GeoService.getCurrentGeoData();
      expect(geoData).toHaveLength(3);
      expect(geoData[0]).toEqual(expect.objectContaining({
        lat: 55.7558,
        lon: 37.6176,
        alt: 150,
        altmsl: 160,
        hasalt: true,
        hasaltmsl: true,
        hasaltmslaccucacy: true,
        mslaccucacyMeters: 5,
      }));

      // Clear data
      GeoService.clearGeoData();
      expect(GeoService.getGeoDataCount()).toBe(0);
    });

    test('data persistence and retrieval', () => {
      // Add geo points
      GeoService.addGeoPoint(55.7558, 37.6176);
      GeoService.addGeoPoint(55.7559, 37.6177);

      expect(GeoService.getGeoDataCount()).toBe(2);

      // Get data multiple times (should return copies)
      const data1 = GeoService.getCurrentGeoData();
      const data2 = GeoService.getCurrentGeoData();
      
      expect(data1).toEqual(data2);
      expect(data1).not.toBe(data2); // Should be different objects

      // Clear data
      GeoService.clearGeoData();
      expect(GeoService.getGeoDataCount()).toBe(0);
    });
  });
});
