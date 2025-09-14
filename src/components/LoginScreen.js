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
  KeyboardAvoidingView,
  ScrollView,
  Image,
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Тёмная полоса под статус-баром (как на главном экране) */}
        <View style={styles.statusBarStripAbsolute} />
        <View style={styles.statusBarSpacer} />
        <View style={styles.headerArea}>
          <View style={styles.logoTransparent}>
            <Image
              source={{ uri: 'ic_logo' }}
              style={styles.logoImageLarge}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>Смена</Text>
          <Text style={styles.subtitle}>Вход в систему</Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
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
                returnKeyType="done"
                onSubmitEditing={handleLogin}
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
              style={[styles.button, isLoading && styles.buttonDisabled, styles.loginButtonElevated]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Войти</Text>
              )}
            </TouchableOpacity>

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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBarSpacer: {
    height: Platform.OS === 'ios' ? 16 : 24,
  },
  statusBarStripAbsolute: {
    position: 'absolute',
    top: -80,
    left: -1000,
    right: -1000,
    height: Platform.OS === 'ios' ? 160 : 120,
    backgroundColor: '#1f1f1f',
    zIndex: 0,
  },
  flex: {
    flex: 1,
  },
  headerArea: {
    alignItems: 'center',
    paddingTop: 76,
    paddingBottom: 8,
  },
  logoTransparent: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoImageLarge: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
  },
  logoLetter: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#222',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 8,
  },
  form: {
    marginBottom: 20,
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
  footer: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  loginButtonElevated: {
    marginTop: 8,
    marginBottom: 4,
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

