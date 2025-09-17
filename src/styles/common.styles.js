import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from './colors';

// Общие стили для кнопок
export const buttonStyles = StyleSheet.create({
  base: {
    padding: spacing.lg,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  primary: {
    backgroundColor: colors.buttonPrimary,
  },
  secondary: {
    backgroundColor: colors.buttonSecondary,
  },
  success: {
    backgroundColor: colors.buttonSuccess,
  },
  error: {
    backgroundColor: colors.buttonError,
  },
  logout: {
    backgroundColor: colors.buttonLogout,
  },
  disabled: {
    backgroundColor: colors.buttonDisabled,
  },
  text: {
    color: colors.textLight,
    fontSize: typography.md,
    fontWeight: '600',
  },
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 0,
  },
  elevated: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.xl,
    borderWidth: 0,
    ...shadows.small,
  },
});

// Общие стили для карточек
export const cardStyles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padding: {
    padding: spacing.lg,
  },
  dark: {
    backgroundColor: colors.surfaceDark,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingBottom: spacing.md,
  },
});

// Общие стили для текста
export const textStyles = StyleSheet.create({
  title: {
    fontSize: typography.xxxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  value: {
    color: colors.textDark,
    fontSize: typography.xl,
    fontWeight: '800',
  },
  caption: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: '600',
  },
});

// Общие стили для индикаторов
export const indicatorStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  item: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  ok: {
    backgroundColor: colors.indicatorOkBg,
    borderColor: colors.indicatorOk,
  },
  bad: {
    backgroundColor: colors.indicatorBadBg,
    borderColor: colors.indicatorBad,
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: '600',
  },
});

// Общие стили для модальных окон
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingRight: spacing.md,
  },
  overlayNoShade: {
    flex: 1,
    backgroundColor: colors.modalTransparent,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingRight: spacing.md,
  },
  dropdown: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.modalTransparent,
    borderRadius: 0,
    padding: 0,
    minWidth: undefined,
    shadowColor: colors.modalTransparent,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  dropdownButton: {
    backgroundColor: colors.borderDark,
    borderRadius: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  dropdownLabel: {
    color: colors.textLight,
    fontSize: typography.md,
    fontWeight: '700',
    textAlign: 'right',
  },
});

// Общие стили для статус-бара
export const statusBarStyles = StyleSheet.create({
  spacer: {
    height: Platform.OS === 'ios' ? spacing.lg : spacing.md,
  },
  stripAbsolute: {
    position: 'absolute',
    top: -100,
    left: -1000,
    right: -1000,
    height: Platform.OS === 'ios' ? 160 : 120,
    backgroundColor: '#1f1f1f',
    zIndex: 1,
  },
});

// Общие стили для логотипа
export const logoStyles = StyleSheet.create({
  large: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.logoBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  small: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.logoBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    color: colors.textLight,
    fontSize: 34,
    fontWeight: '800',
  },
  letterSmall: {
    color: colors.textLight,
    fontSize: typography.lg,
    fontWeight: '800',
  },
});
