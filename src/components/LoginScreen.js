import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import authService from '../services/authService';
// permissions test removed

const LoginScreen = ({ onLoginSuccess }) => {
  const [userLogin, setUserLogin] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePhoneChange = (rawValue) => {
    const digitsOnly = rawValue.replace(/\D/g, '').slice(0, 10);
    setUserLogin(digitsOnly);
  };

  const formatRuPhone = (digits) => {
    if (!digits) return '';
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 6);
    const c = digits.slice(6, 8);
    const e = digits.slice(8, 10);
    if (digits.length <= 3) return `(${a}`;
    if (digits.length <= 6) return `(${a}) ${b}`;
    if (digits.length <= 8) return `(${a}) ${b}-${c}`;
    return `(${a}) ${b}-${c}-${e}`;
  };

  // testPermissions removed

  const handleLogin = async () => {
    const digitsOnly = userLogin.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      Alert.alert('Ошибка', 'Введите номер телефона в формате 10 цифр');
      return;
    }
    if (!userPassword.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите пароль');
      return;
    }

    setIsLoading(true);
    try {
      const normalizedLogin = `7${digitsOnly}`;
      const result = await authService.login(normalizedLogin, userPassword);
      
      if (result.success) {
        Alert.alert('Успех', 'Вход выполнен успешно!');
        onLoginSuccess(result.data);
      } else {
        Alert.alert('Ошибка входа', result.error);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Произошла ошибка при входе');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Workforce Tracker</Text>
        <Text style={styles.subtitle}>Вход в систему</Text>
        
        <View style={styles.form}>
          <View style={styles.phoneInputWrapper}>
            <TextInput
              style={[styles.input, styles.inputWithPrefix]}
              placeholder="(___) ___-__-__"
              value={formatRuPhone(userLogin)}
              onChangeText={handlePhoneChange}
              keyboardType="number-pad"
              autoCapitalize="none"
              editable={!isLoading}
              placeholderTextColor="#9E9E9E"
              selectionColor="#007AFF"
              maxLength={16}
            />
            <View style={styles.phonePrefixContainer} pointerEvents="none">
              <Text style={styles.phoneFixedPrefix}>+7</Text>
            </View>
          </View>
          
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Пароль"
              value={userPassword}
              onChangeText={setUserPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!isLoading}
              placeholderTextColor="#9E9E9E"
              selectionColor="#007AFF"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(v => !v)}
              accessibilityLabel={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              style={styles.eyeButton}
              disabled={isLoading}
            >
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>
          
          {/* test permissions button removed */}
        </View>

        {__DEV__ ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>
              Для тестирования используйте:{'\n'}
              Логин: 79999999999{'\n'}
              Пароль: 123456
            </Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
  },
  form: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#fff',
    color: '#000',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    top: 12,
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 18,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  testButton: {
    backgroundColor: '#FF9500',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  phoneInputWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  phonePrefixContainer: {
    position: 'absolute',
    left: 14,
    top: 12,
    height: 24,
    justifyContent: 'center',
    zIndex: 2,
  },
  phoneFixedPrefix: {
    color: '#000',
    fontSize: 16,
    includeFontPadding: false,
    lineHeight: 20,
  },
  inputWithPrefix: {
    paddingLeft: 44,
    height: 48,
    paddingVertical: 12,
    textAlignVertical: 'center',
  },
});

export default LoginScreen;

