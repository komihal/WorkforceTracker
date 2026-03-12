const mock = {
  getBrand: jest.fn(() => 'Samsung'),
  getModel: jest.fn(() => 'Galaxy S21'),
  getSystemVersion: jest.fn(() => '12'),
  getUniqueId: jest.fn(() => 'test-unique-id'),
  getAndroidId: jest.fn(() => Promise.resolve('android-id-123')),
  isTablet: jest.fn(() => false),
  getDeviceNameSync: jest.fn(() => 'Test Device'),
};

module.exports = mock;
module.exports.__esModule = true;
module.exports.default = mock;
