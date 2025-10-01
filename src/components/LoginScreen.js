import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Provider as PaperProvider } from 'react-native-paper';
import authService from '../services/authService';
import { styles } from './LoginScreen.styles';
import paperTheme from '../styles/paperTheme';
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
    <PaperProvider theme={paperTheme}>
      <SafeAreaView edges={['left','right','bottom']} style={styles.container}>
        {/* Appbar из React Native Paper вместо черной полоски */}
        <Appbar.Header style={styles.appbarHeader}>
          <Appbar.Content title="Вход в систему" titleStyle={styles.appbarTitle} />
        </Appbar.Header>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
    </PaperProvider>
  );
};


export default LoginScreen;

