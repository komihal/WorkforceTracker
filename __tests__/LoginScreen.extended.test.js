import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('../src/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'https://api.test.com',
    API_TOKEN: 'test-token',
    ENDPOINTS: { AUTH: '/auth/' },
  },
  getAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, props, children);
  },
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    Provider: ({ children }) => React.createElement(View, null, children),
    Appbar: {
      Header: ({ children, ...props }) => React.createElement(View, props, children),
      Content: ({ title }) => React.createElement(Text, null, title),
    },
  };
});

jest.mock('../src/styles/paperTheme', () => ({}));
jest.mock('../src/components/LoginScreen.styles', () => ({
  styles: {},
}));

import LoginScreen from '../src/components/LoginScreen';
import authService from '../src/services/authService';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('renders login form', () => {
    const { getAllByText, getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );
    // "Вход в систему" appears in both Appbar and subtitle
    expect(getAllByText('Вход в систему').length).toBeGreaterThanOrEqual(1);
    expect(getByPlaceholderText('(___) ___-__-__')).toBeTruthy();
    expect(getByPlaceholderText('Пароль')).toBeTruthy();
    expect(getAllByText('Войти').length).toBeGreaterThanOrEqual(1);
  });

  it('formats phone number as user types', () => {
    const { getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );
    const phoneInput = getByPlaceholderText('(___) ___-__-__');

    fireEvent.changeText(phoneInput, '916');
    // After setting 916, formatRuPhone should produce "(916"
    expect(phoneInput.props.value).toBe('(916');
  });

  it('formats full 10-digit phone', () => {
    const { getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );
    const phoneInput = getByPlaceholderText('(___) ___-__-__');

    fireEvent.changeText(phoneInput, '9161234567');
    expect(phoneInput.props.value).toBe('(916) 123-45-67');
  });

  it('strips non-digit characters from phone input', () => {
    const { getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );
    const phoneInput = getByPlaceholderText('(___) ___-__-__');

    fireEvent.changeText(phoneInput, '+7 (916) 123');
    // Only digits: 7916123 → but sliced to 10, so 7916123 (7 digits)
    expect(phoneInput.props.value).toBe('(791) 612-3');
  });

  it('shows alert when phone is incomplete', async () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );

    fireEvent.changeText(getByPlaceholderText('(___) ___-__-__'), '91612');
    fireEvent.changeText(getByPlaceholderText('Пароль'), 'pass123');
    fireEvent.press(getByText('Войти'));

    expect(Alert.alert).toHaveBeenCalledWith('Ошибка', expect.stringContaining('10 цифр'));
  });

  it('shows alert when password is empty', async () => {
    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );

    fireEvent.changeText(getByPlaceholderText('(___) ___-__-__'), '9161234567');
    fireEvent.press(getByText('Войти'));

    expect(Alert.alert).toHaveBeenCalledWith('Ошибка', expect.stringContaining('пароль'));
  });

  it('calls authService.login and onLoginSuccess on success', async () => {
    const mockLoginSuccess = jest.fn();
    const mockData = { user_id: 42, success: true };
    jest.spyOn(authService, 'login').mockResolvedValue({ success: true, data: mockData });

    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={mockLoginSuccess} />,
    );

    fireEvent.changeText(getByPlaceholderText('(___) ___-__-__'), '9161234567');
    fireEvent.changeText(getByPlaceholderText('Пароль'), 'password');
    fireEvent.press(getByText('Войти'));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('79161234567', 'password');
      expect(mockLoginSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it('shows error alert on login failure', async () => {
    jest.spyOn(authService, 'login').mockResolvedValue({ success: false, error: 'Неверный пароль' });

    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );

    fireEvent.changeText(getByPlaceholderText('(___) ___-__-__'), '9161234567');
    fireEvent.changeText(getByPlaceholderText('Пароль'), 'wrong');
    fireEvent.press(getByText('Войти'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Ошибка входа', 'Неверный пароль');
    });
  });

  it('shows error alert on login exception', async () => {
    jest.spyOn(authService, 'login').mockRejectedValue(new Error('Network fail'));

    const { getByText, getByPlaceholderText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );

    fireEvent.changeText(getByPlaceholderText('(___) ___-__-__'), '9161234567');
    fireEvent.changeText(getByPlaceholderText('Пароль'), 'pass');
    fireEvent.press(getByText('Войти'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Ошибка', 'Произошла ошибка при входе');
    });
  });

  it('toggles password visibility', () => {
    const { getByPlaceholderText, getByLabelText } = render(
      <LoginScreen onLoginSuccess={jest.fn()} />,
    );

    const passwordInput = getByPlaceholderText('Пароль');
    expect(passwordInput.props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText('Показать пароль'));
    expect(passwordInput.props.secureTextEntry).toBe(false);

    fireEvent.press(getByLabelText('Скрыть пароль'));
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});
