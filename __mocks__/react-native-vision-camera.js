const React = require('react');

module.exports = {
  Camera: Object.assign(
    React.forwardRef((props, ref) =>
      React.createElement('Camera', { ...props, ref })
    ),
    {
      requestCameraPermission: jest.fn(() => Promise.resolve('granted')),
    }
  ),
  useCameraDevice: jest.fn(() => ({ id: 'front-camera' })),
};
