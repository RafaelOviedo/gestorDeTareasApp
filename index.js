/**
 * @format
 */

import notifee from '@notifee/react-native';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// El sistema presenta los avisos. Tocarlos abre la app y conserva el control de acceso.
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
