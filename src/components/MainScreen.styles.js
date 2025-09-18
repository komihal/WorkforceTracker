import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/colors';
import { 
  buttonStyles, 
  cardStyles, 
  textStyles, 
  indicatorStyles, 
  modalStyles, 
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
  content: {
    flex: 1,
  },
  
  // FAB (Floating Action Button) контейнер - оставляем только контейнер
  fabContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  
  // Заголовок и навигация
  header: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  headerArea: {
    alignItems: 'center',
    paddingTop: 76,
    paddingBottom: spacing.md,
  },
  topBar: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  
  // Логотип и название приложения
  ...logoStyles,
  appName: {
    fontSize: typography.xxxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  appNameInline: {
    fontSize: typography.xl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  title: {
    fontSize: typography.xxxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  
  // Пользовательская информация
  userTopRow: {
    paddingTop: spacing.lg,
    marginLeft: -6,
    paddingHorizontal: 12,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  userHeader: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSecondary,
  },
  userQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  metricsRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  metricsText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  userMenu: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  userRoleTop: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  userNameTop: {
    fontSize: typography.xl,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  nameWithBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.badgeOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: typography.sm,
    marginTop: -1,
  },
  
  // Карточка пользователя
  userCard: {
    ...cardStyles.base,
    padding: spacing.lg,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  userCardTitle: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userCardChevron: {
    fontSize: typography.md,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: typography.sm,
    color: '#555',
    marginBottom: spacing.sm,
  },
  userDetails: {
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  detailLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  detailValue: {
    marginRight: spacing.sm,
    fontWeight: '700',
  },
  ok: { color: colors.statusOk },
  bad: { color: colors.statusBad },
  
  // Статистика смен
  shiftStatsCard: {
    ...cardStyles.base,
    margin: spacing.lg,
    marginTop: spacing.md,
  },
  shiftStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  monthLabel: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  monthChevron: {
    fontSize: typography.xxxl,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shiftStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  statBox: {
    width: '48%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: spacing.md,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.textDark,
    fontSize: typography.lg,
    fontWeight: '800',
  },
  statSub: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: '600',
  },
  
  // Темная карточка статистики
  statsCardDark: {
    ...cardStyles.dark,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surfaceDarkSecondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
  },
  pillActive: {
    backgroundColor: colors.surface,
  },
  pillText: {
    color: colors.textLight,
    fontWeight: '700',
  },
  pillTextActive: {
    color: colors.textDark,
  },
  statsAmount: {
    color: colors.textLight,
    fontSize: typography.xxxl,
    fontWeight: '800',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sbList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sbItem: {
    backgroundColor: colors.surfaceDarkSecondary,
    borderRadius: spacing.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sbItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sbIcon: {
    width: 32,
    height: 32,
    borderRadius: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sbIconText: { color: colors.textDark, fontWeight: '800' },
  sbTitle: { color: colors.textLight, fontWeight: '700' },
  sbSub: { color: colors.textTertiary, fontSize: typography.xs, fontWeight: '600' },
  sbValue: { color: colors.textLight, fontWeight: '800', fontSize: typography.md },
  
  // Модальные окна
  ...modalStyles,
  
  // Кнопки выхода
  logoutTopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.xl,
    borderWidth: 0,
    ...shadows.small,
  },
  logoutTopLabel: {
    color: colors.textDark,
    fontSize: typography.md,
    fontWeight: '700',
  },
  logoutButtonSmall: {
    backgroundColor: colors.buttonLogout,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: 0,
  },
  logoutIconBtn: {
    width: 44,
    height: 44,
    borderRadius: spacing.sm,
    borderWidth: 2,
    borderColor: colors.buttonLogout,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.modalTransparent,
  },
  logoutIconText: {
    color: colors.buttonLogout,
    fontSize: typography.xl,
    fontWeight: '800',
    marginTop: -1,
  },
  logoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.buttonLogout,
  },
  logoutEmoji: {
    color: colors.buttonLogout,
    fontSize: typography.lg,
    fontWeight: '800',
    marginTop: -1,
  },
  logoutLabel: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: '700',
  },
  
  // Карточка статуса
  statusCard: {
    ...cardStyles.base,
    padding: spacing.xl,
    alignItems: 'center',
  },
  statusIndicatorFullWidth: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  ...indicatorStyles,
  
  // Бейджи
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  badge: {
    backgroundColor: colors.badgeWarning,
    borderColor: colors.badgeWarningBorder,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    color: colors.badgeWarningText,
    fontSize: typography.xs,
    fontWeight: '700',
  },
  
  // Панель доступа
  accessPanel: {
    ...cardStyles.base,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  accessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  accessTitle: {
    fontSize: typography.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  accessClose: {
    color: colors.buttonPrimary,
    fontWeight: '700',
    fontSize: typography.sm,
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  accessLabel: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: '600',
  },
  accessRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accessStatus: {
    fontWeight: '700',
  },
  accessBtn: {
    backgroundColor: colors.buttonSecondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
  },
  accessBtnText: {
    color: colors.textLight,
    fontWeight: '700',
    fontSize: typography.xs,
  },
  
  // Статус индикаторы
  statusTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  statusIndicator: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: spacing.xl,
  },
  activeStatus: {
    backgroundColor: colors.statsActiveBg,
    borderWidth: 1,
    borderColor: colors.statsActiveBorder,
  },
  inactiveStatus: {
    backgroundColor: colors.statsInactiveBg,
    borderWidth: 1,
    borderColor: colors.statsInactiveBorder,
  },
  statusText: {
    fontSize: typography.md,
    fontWeight: '600',
    alignSelf: 'center',
  },
  statusTextActive: {
    color: colors.statusActive,
  },
  statusTextInactive: {
    color: colors.statusInactive,
  },
  
  // Кнопки действий
  actions: {
    marginBottom: spacing.xl,
  },
  ...buttonStyles,
  
  // Дополнительные стили кнопок для MainScreen
  punchInButton: {
    backgroundColor: colors.buttonPrimary,
  },
  buttonText: {
    color: colors.textLight,
    fontSize: typography.md,
    fontWeight: '600',
  },
  
  // Секции и заголовки
  ...textStyles,
  
  // Нижние кнопки
  bottomButtons: {
    flexDirection: 'column',
    gap: spacing.md,
  },
  
  // Баннеры
  banner: {
    backgroundColor: colors.bannerWarning,
    borderColor: colors.bannerWarningBorder,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    color: colors.bannerWarningText,
    marginBottom: spacing.sm,
    textAlign: 'center',
    fontSize: typography.sm,
    fontWeight: '600'
  },
  bannerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: spacing.sm,
  },
  
  // Тестовые кнопки
  testButton: {
    backgroundColor: '#2196F3',
  },
  testButtonActive: {
    backgroundColor: colors.buttonSuccess,
  },
  
  // Вспомогательные стили
  fill: { flex: 1, alignSelf: 'stretch' },
  
  // Endpoint toggle section (если используется)
  endpointToggleSection: {
    ...cardStyles.base,
    padding: spacing.xl,
  },
  endpointToggleButton: {
    backgroundColor: '#2196F3',
    marginBottom: spacing.md,
  },
  endpointDescription: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  
  // Стили для кнопки накопленных точек (PaperButton)
  queuedButton: {
    marginBottom: spacing.md,
  },
  
  // Стили для модального окна выхода
  logoutModalOverlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingTop: 96,
  },
  menuDropdown: {
    position: 'absolute',
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    padding: 0,
    minWidth: 200,
    ...shadows.medium,
  },
  
  
  // Appbar стили
  appbarHeader: {
    backgroundColor: colors.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    width: '100%',
    paddingHorizontal: 0,
  },
  appbarTitle: {
    color: colors.textLight,
    fontSize: typography.lg,
    fontWeight: '600',
  },
  appbarRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  statusChip: {
    height: 32,
    marginRight: spacing.xs,
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  appbarBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.badgeOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  appbarBadgeText: {
    color: colors.textLight,
    fontWeight: '800',
    fontSize: 12,
    marginTop: -1,
  },
  appbarUserName: {
    color: colors.textLight,
    fontSize: 14,
    fontWeight: '600',
    marginRight: spacing.sm,
    maxWidth: 120,
  },
  menuContent: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  menuLogoutText: {
    color: colors.buttonLogout,
    fontWeight: '600',
  },
  
  // Выпадающее меню профиля
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  menuOverlayTouchable: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    minWidth: 200,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemIcon: {
    marginRight: spacing.md,
    width: 24,
    textAlign: 'center',
  },
  menuItemText: {
    fontSize: typography.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  
  // Алиасы для совместимости с существующим кодом (удалены, так как заменены на Appbar)
  // statusBarStripAbsolute и statusBarSpacer больше не нужны
});