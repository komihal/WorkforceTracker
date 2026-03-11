import { Alert } from 'react-native';
import { openSettings } from 'react-native-permissions';

/**
 * Показывает диалог с предложением открыть настройки для выдачи разрешения.
 * @param {string} title
 * @param {string} message
 * @param {'Отмена'|'Позже'} [cancelLabel]
 */
export function showPermissionAlert(title, message, cancelLabel = 'Позже') {
  Alert.alert(title, message, [
    { text: 'Открыть настройки', onPress: () => openSettings() },
    { text: cancelLabel, style: 'cancel' },
  ]);
}
