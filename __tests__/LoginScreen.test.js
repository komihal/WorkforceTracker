import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/components/LoginScreen';
import authService from '../src/services/authService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../src/services/authService', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
  },
}));

describe('LoginScreen', () => {
  const mockOnLoginSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen onLoginSuccess={mockOnLoginSuccess} />
    );

    expect(getByPlaceholderText('(___) ___-__-__')).toBeTruthy();
    expect(getByPlaceholderText('Пароль')).toBeTruthy();
    expect(getByText('Войти')).toBeTruthy();
  });

  test('shows error message for empty fields', async () => {
    const { getByText } = render(
      <LoginScreen onLoginSuccess={mockOnLoginSuccess} />
    );

    const loginButton = getByText('Войти');
    fireEvent.press(loginButton);

    // Should not call authService.login with empty fields
    expect(authService.login).not.toHaveBeenCalled();
  });

  test('handles successful login', async () => {
    authService.login.mockResolvedValue({ success: true, data: { user_id: 1 } });

    const { getByPlaceholderText, getByText } = render(
      <LoginScreen onLoginSuccess={mockOnLoginSuccess} />
    );

    const phoneInput = getByPlaceholderText('(___) ___-__-__');
    const passwordInput = getByPlaceholderText('Пароль');
    const loginButton = getByText('Войти');

    fireEvent.changeText(phoneInput, '79999999999');
    fireEvent.changeText(passwordInput, '123456');
    fireEvent.press(loginButton);

    await waitFor(() => expect(authService.login).toHaveBeenCalled());
    await waitFor(() => expect(mockOnLoginSuccess).toHaveBeenCalledWith({ user_id: 1 }));
  });
});
