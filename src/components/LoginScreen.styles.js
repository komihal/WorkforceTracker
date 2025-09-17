import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/colors';
import { 
  buttonStyles, 
  textStyles, 
  statusBarStyles, 
  logoStyles 
} from '../styles/common.styles';

export const styles = StyleSheet.create({
  // Основные контейнеры
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  ...statusBarStyles,
  flex: {
    flex: 1,
  },
  
  // Заголовок и логотип
  headerArea: {
    alignItems: 'center',
    paddingTop: 76,
    paddingBottom: spacing.sm,
  },
  logoTransparent: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoImageLarge: {
    width: 90,
    height: 90,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#222',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  
  // Контент
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    fontSize: typography.lg,
    textAlign: 'center',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  
  // Форма
  form: {
    marginBottom: spacing.xl,
  },
  
  // Поля ввода
  input: {
    backgroundColor: colors.surface,
    color: '#000',
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    fontSize: typography.md,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  
  // Обертка для пароля
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    height: 28,
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: typography.lg,
    color: colors.textPrimary,
  },
  
  // Обертка для телефона
  phoneInputWrapper: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  phonePrefixContainer: {
    position: 'absolute',
    left: spacing.xl,
    top: spacing.md,
    height: 24,
    justifyContent: 'center',
    zIndex: 2,
  },
  phoneFixedPrefix: {
    color: '#000',
    fontSize: typography.md,
    includeFontPadding: false,
    lineHeight: 20,
  },
  inputWithPrefix: {
    paddingLeft: 44,
    height: 48,
    paddingVertical: spacing.md,
    textAlignVertical: 'center',
  },
  
  // Кнопки
  button: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.buttonDisabled,
  },
  buttonText: {
    color: colors.textLight,
    fontSize: typography.md,
    fontWeight: '600',
  },
  loginButtonElevated: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  
  // Информационный блок
  info: {
    backgroundColor: '#e8f4fd',
    padding: spacing.lg,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.buttonPrimary,
  },
  infoText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    lineHeight: 20,
  },
  
  // Футер (если нужен)
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  
  // Тестовая кнопка
  testButton: {
    backgroundColor: '#FF9500',
    marginTop: spacing.md,
  },
});
