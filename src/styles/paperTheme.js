import { MD3LightTheme as PaperLightTheme } from 'react-native-paper';
import { colors as appColors } from './colors';

// Единая тема MD3 для iOS и Android
export const paperTheme = {
  ...PaperLightTheme,
  colors: {
    ...PaperLightTheme.colors,
    primary: appColors.primary,
    secondary: appColors.secondary,
    error: appColors.error,
    background: appColors.background,
    surface: appColors.surface,
    surfaceVariant: appColors.surfaceSecondary,
    onPrimary: appColors.textLight,
    onSurface: appColors.textPrimary,
    outline: appColors.border,
  },
};

export default paperTheme;


