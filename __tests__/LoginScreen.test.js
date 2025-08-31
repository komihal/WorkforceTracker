import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/components/LoginScreen';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders login form correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    expect(getByPlaceholderText('(___) ___-__-__')).toBeTruthy();
    expect(getByPlaceholderText('Пароль')).toBeTruthy();
    expect(getByText('Войти')).toBeTruthy();
  });

  test('shows error message for empty fields', async () => {
    const { getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    const loginButton = getByText('Войти');
    fireEvent.press(loginButton);

    // Add assertions based on your actual validation logic
    // This test needs to be adjusted based on your component's behavior
  });

  test('handles successful login', async () => {
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );

    const phoneInput = getByPlaceholderText('(___) ___-__-__');
    const passwordInput = getByPlaceholderText('Пароль');
    const loginButton = getByText('Войти');

    fireEvent.changeText(phoneInput, '79999999999');
    fireEvent.changeText(passwordInput, '123456');
    fireEvent.press(loginButton);

    // Add assertions based on your actual login logic
    // This is a basic example - adjust according to your implementation
  });
});
