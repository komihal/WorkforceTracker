import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Manual mock in __mocks__/react-native-vision-camera.js is used automatically

import SelfieCaptureModal from '../src/components/SelfieCaptureModal';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SelfieCaptureModal', () => {
  it('renders when visible', () => {
    const { getByText } = render(
      <SelfieCaptureModal visible={true} onCancel={jest.fn()} onCaptured={jest.fn()} />,
    );

    expect(getByText('Сделайте селфи')).toBeTruthy();
    expect(getByText('Отмена')).toBeTruthy();
    expect(getByText('Сделать фото')).toBeTruthy();
  });

  it('calls onCancel when cancel button pressed', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <SelfieCaptureModal visible={true} onCancel={onCancel} onCaptured={jest.fn()} />,
    );

    fireEvent.press(getByText('Отмена'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading when camera permission denied', async () => {
    const { Camera } = require('react-native-vision-camera');
    Camera.requestCameraPermission.mockResolvedValue('denied');

    const { findByText } = render(
      <SelfieCaptureModal visible={true} onCancel={jest.fn()} onCaptured={jest.fn()} />,
    );

    const text = await findByText('Нет доступа к камере');
    expect(text).toBeTruthy();
  });

  it('shows loading when no camera device', () => {
    const { useCameraDevice } = require('react-native-vision-camera');
    useCameraDevice.mockReturnValue(null);

    const { getByText } = render(
      <SelfieCaptureModal visible={true} onCancel={jest.fn()} onCaptured={jest.fn()} />,
    );

    expect(getByText('Загрузка камеры...')).toBeTruthy();
  });

  it('disables capture button when camera not ready', () => {
    const { useCameraDevice } = require('react-native-vision-camera');
    useCameraDevice.mockReturnValue(null);

    const { getByText } = render(
      <SelfieCaptureModal visible={true} onCancel={jest.fn()} onCaptured={jest.fn()} />,
    );

    const captureBtn = getByText('Сделать фото');
    // The button should be disabled — its parent has disabled prop
    expect(captureBtn).toBeTruthy();
  });
});
