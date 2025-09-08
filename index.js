/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Импортируем headless task для фоновой отправки HTTP
import './src/bg/headless';

AppRegistry.registerComponent(appName, () => App);
console.log('[RN] registered:', appName);