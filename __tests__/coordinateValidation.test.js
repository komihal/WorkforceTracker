// Тест для валидации координат
describe('Coordinate Validation', () => {
  test('validates latitude range', () => {
    // Валидные широты
    expect(() => validateLatitude(0)).not.toThrow();
    expect(() => validateLatitude(90)).not.toThrow();
    expect(() => validateLatitude(-90)).not.toThrow();
    expect(() => validateLatitude(45.123456)).not.toThrow();
    expect(() => validateLatitude(-45.123456)).not.toThrow();
    
    // Невалидные широты
    expect(() => validateLatitude(91)).toThrow();
    expect(() => validateLatitude(-91)).toThrow();
    expect(() => validateLatitude(180)).toThrow();
    expect(() => validateLatitude(-180)).toThrow();
  });

  test('validates longitude range', () => {
    // Валидные долготы
    expect(() => validateLongitude(0)).not.toThrow();
    expect(() => validateLongitude(180)).not.toThrow();
    expect(() => validateLongitude(-180)).not.toThrow();
    expect(() => validateLongitude(45.123456)).not.toThrow();
    expect(() => validateLongitude(-45.123456)).not.toThrow();
    
    // Невалидные долготы
    expect(() => validateLongitude(181)).toThrow();
    expect(() => validateLongitude(-181)).toThrow();
    expect(() => validateLongitude(360)).toThrow();
    expect(() => validateLongitude(-360)).toThrow();
  });

  test('validates coordinate types', () => {
    // Валидные типы
    expect(() => validateCoordinate(45.0, 45.0)).not.toThrow();
    expect(() => validateCoordinate(-45.0, -45.0)).not.toThrow();
    
    // Невалидные типы
    expect(() => validateCoordinate('45', 45)).toThrow();
    expect(() => validateCoordinate(45, '45')).toThrow();
    expect(() => validateCoordinate(null, 45)).toThrow();
    expect(() => validateCoordinate(45, undefined)).toThrow();
    expect(() => validateCoordinate(NaN, 45)).toThrow();
    expect(() => validateCoordinate(45, NaN)).toThrow();
  });

  test('handles edge cases', () => {
    // Граничные значения
    expect(() => validateCoordinate(90.0, 180.0)).not.toThrow();
    expect(() => validateCoordinate(-90.0, -180.0)).not.toThrow();
    expect(() => validateCoordinate(0.0, 0.0)).not.toThrow();
    
    // Очень маленькие значения
    expect(() => validateCoordinate(0.000001, 0.000001)).not.toThrow();
    expect(() => validateCoordinate(-0.000001, -0.000001)).not.toThrow();
  });
});

// Функции валидации для тестирования
function validateLatitude(lat) {
  if (typeof lat !== 'number') {
    throw new Error(`Invalid latitude type: ${typeof lat}`);
  }
  if (isNaN(lat)) {
    throw new Error('Latitude is NaN');
  }
  if (lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat} (must be between -90 and 90)`);
  }
}

function validateLongitude(lon) {
  if (typeof lon !== 'number') {
    throw new Error(`Invalid longitude type: ${typeof lon}`);
  }
  if (isNaN(lon)) {
    throw new Error('Longitude is NaN');
  }
  if (lon < -180 || lon > 180) {
    throw new Error(`Invalid longitude: ${lon} (must be between -180 and 180)`);
  }
}

function validateCoordinate(lat, lon) {
  validateLatitude(lat);
  validateLongitude(lon);
}

// Тест для проверки формата координат
describe('Coordinate Format', () => {
  test('formats coordinates correctly', () => {
    const coordinates = [
      { lat: 55.7558, lon: 37.6176, expected: '55.755800, 37.617600' },
      { lat: -33.8688, lon: 151.2093, expected: '-33.868800, 151.209300' },
      { lat: 40.7128, lon: -74.0060, expected: '40.712800, -74.006000' },
      { lat: 0.0, lon: 0.0, expected: '0.000000, 0.000000' },
    ];

    coordinates.forEach(({ lat, lon, expected }) => {
      const formatted = formatCoordinate(lat, lon);
      expect(formatted).toBe(expected);
    });
  });

  test('handles precision correctly', () => {
    expect(formatCoordinate(55.7558, 37.6176, 2)).toBe('55.76, 37.62');
    expect(formatCoordinate(55.7558, 37.6176, 4)).toBe('55.7558, 37.6176');
    expect(formatCoordinate(55.7558, 37.6176, 6)).toBe('55.755800, 37.617600');
  });
});

function formatCoordinate(lat, lon, precision = 6) {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

// Тест для проверки преобразования координат
describe('Coordinate Conversion', () => {
  test('converts decimal to DMS format', () => {
    const testCases = [
      { lat: 55.7558, lon: 37.6176, expected: '55°45\'20.88"N, 37°37\'3.36"E' },
      { lat: -33.8688, lon: 151.2093, expected: '33°52\'7.68"S, 151°12\'33.48"E' },
      { lat: 40.7128, lon: -74.0060, expected: '40°42\'46.08"N, 74°0\'21.60"W' },
    ];

    testCases.forEach(({ lat, lon, expected }) => {
      const dms = decimalToDMS(lat, lon);
      expect(dms).toBe(expected);
    });
  });
});

function decimalToDMS(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  
  const latAbs = Math.abs(lat);
  const lonAbs = Math.abs(lon);
  
  const latDeg = Math.floor(latAbs);
  const latMin = Math.floor((latAbs - latDeg) * 60);
  const latSec = ((latAbs - latDeg - latMin / 60) * 3600).toFixed(2);
  
  const lonDeg = Math.floor(lonAbs);
  const lonMin = Math.floor((lonAbs - lonDeg) * 60);
  const lonSec = ((lonAbs - lonDeg - lonMin / 60) * 3600).toFixed(2);
  
  return `${latDeg}°${latMin}'${latSec}"${latDir}, ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`;
}
