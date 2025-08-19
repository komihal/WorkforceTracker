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
} from 'react-native';
import authService from '../services/authService';

const LoginScreen = ({ onLoginSuccess }) => {
  const [userLogin, setUserLogin] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!userLogin.trim() || !userPassword.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.login(userLogin, userPassword);
      
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
          <TextInput
            style={styles.input}
            placeholder="Номер телефона"
            value={userLogin}
            onChangeText={setUserLogin}
            keyboardType="phone-pad"
            autoCapitalize="none"
            editable={!isLoading}
            placeholderTextColor="#9E9E9E"
            selectionColor="#007AFF"
          />
          
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
});

export default LoginScreen;

