// Цветовая палитра приложения
export const colors = {
  // Основные цвета
  primary: '#007AFF',
  secondary: '#FF9800',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FFC107',
  
  // Фоновые цвета
  background: '#f5f5f5',
  surface: '#fff',
  surfaceSecondary: '#f7f9fc',
  surfaceDark: '#1C1C1E',
  surfaceDarkSecondary: '#2C2C2E',
  
  // Текстовые цвета
  textPrimary: '#333',
  textSecondary: '#666',
  textTertiary: '#98989F',
  textDark: '#1d1d1f',
  textLight: '#fff',
  
  // Цвета статусов
  statusActive: '#2E7D32',
  statusInactive: '#B71C1C',
  statusOk: '#2e7d32',
  statusBad: '#c62828',
  
  // Цвета индикаторов
  indicatorOk: '#4CAF50',
  indicatorBad: '#F44336',
  indicatorOkBg: '#E8F5E9',
  indicatorBadBg: '#FFEBEE',
  
  // Цвета границ
  border: '#eee',
  borderSecondary: '#e2e8f0',
  borderDark: '#3A3A3C',
  
  // Цвета для кнопок
  buttonPrimary: '#007AFF',
  buttonSecondary: '#FF9800',
  buttonSuccess: '#4CAF50',
  buttonError: '#F44336',
  buttonDisabled: '#ccc',
  buttonLogout: '#F44336',
  
  // Цвета для баннеров
  bannerWarning: '#FFF7E6',
  bannerWarningBorder: '#FFC107',
  bannerWarningText: '#7A5D00',
  
  // Цвета для бейджей
  badgeWarning: '#FFF3E0',
  badgeWarningBorder: '#FF9800',
  badgeWarningText: '#7A4F00',
  badgeOrange: '#FF9800',
  
  // Цвета для модальных окон
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  modalTransparent: 'transparent',
  
  // Цвета для теней
  shadow: '#000',
  
  // Цвета для пользовательского интерфейса
  userHeader: '#e6eef6',
  logoBackground: '#007AFF',
  
  // Цвета для статистики
  statsActiveBg: 'rgba(76, 175, 80, 0.15)',
  statsActiveBorder: 'rgba(76, 175, 80, 1)',
  statsInactiveBg: 'rgba(244, 67, 54, 0.15)',
  statsInactiveBorder: 'rgba(244, 67, 54, 1)',
};

// Размеры и отступы
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Размеры шрифтов
export const typography = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  xxxxl: 32,
};

// Радиусы скругления
export const borderRadius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  xxxl: 20,
  full: 999,
};

// Тени
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
};
