/* eslint-env jest */

import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({ didCancel: true })),
  launchImageLibrary: jest.fn(async () => ({ didCancel: true })),
}));
jest.mock('react-native-file-access', () => {
  const mock = require('react-native-file-access/jest/mock').mockRnfaModule;
  return {
    ...mock,
    FileSystem: {
      ...mock.FileSystem,
      // El mock oficial no incluye mkdir, aunque la API nativa sí.
      mkdir: jest.fn(async path => path),
    },
  };
});

jest.mock('react-native-permissions', () =>
  require('react-native-permissions/mock'),
);

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
