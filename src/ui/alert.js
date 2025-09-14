import { Alert } from 'react-native';

let dialogOpen = false;

export function guardedAlert(title, message, buttons = [{ text: 'OK', style: 'cancel' }], options = { cancelable: false }) {
  if (dialogOpen) return;
  dialogOpen = true;
  try {
    Alert.alert(title, message, buttons, options);
  } finally {
    setTimeout(() => { dialogOpen = false; }, 500);
  }
}



