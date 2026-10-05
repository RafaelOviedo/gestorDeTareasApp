/* eslint-env jest */

import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  ...require('@notifee/react-native/jest-mock'),
  default: {
    ...require('@notifee/react-native/jest-mock').default,
    openAlarmPermissionSettings: jest.fn(async () => {}),
  },
}));
