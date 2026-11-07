import { Platform } from 'react-native';
import {
  checkMultiple,
  requestMultiple,
  openSettings,
  PERMISSIONS,
  RESULTS,
  type PermissionStatus,
} from 'react-native-permissions';
import {
  checkResourcePermission,
  requestResourcePermission,
  openDeviceSettings,
  hasResourceAccess,
  type DeviceResource,
} from '../src/services/devicePermissions';

type PermissionResults = Awaited<ReturnType<typeof checkMultiple>>;

function checking(status: PermissionStatus) {
  jest
    .mocked(checkMultiple)
    .mockImplementation(
      async permissions =>
        Object.fromEntries(
          permissions.map(permission => [permission, status]),
        ) as PermissionResults,
    );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  checking(RESULTS.DENIED);
  jest
    .mocked(requestMultiple)
    .mockImplementation(
      async permissions =>
        Object.fromEntries(
          permissions.map(permission => [permission, RESULTS.GRANTED]),
        ) as PermissionResults,
    );
});
afterEach(() => jest.restoreAllMocks());

test.each<[DeviceResource, string]>([
  ['camera', PERMISSIONS.IOS.CAMERA],
  ['gallery', PERMISSIONS.IOS.PHOTO_LIBRARY],
  ['location', PERMISSIONS.IOS.LOCATION_WHEN_IN_USE],
  ['contacts', PERMISSIONS.IOS.CONTACTS],
  ['calendar', PERMISSIONS.IOS.CALENDARS_WRITE_ONLY],
])('consulta %s en iOS sin solicitarlo', async (resource, permission) => {
  expect(await checkResourcePermission(resource)).toBe('denied');
  expect(checkMultiple).toHaveBeenCalledWith([permission]);
  expect(requestMultiple).not.toHaveBeenCalled();
});

test('solicita un permiso pendiente y devuelve el resultado nativo', async () => {
  expect(await requestResourcePermission('camera')).toBe('granted');
  expect(requestMultiple).toHaveBeenCalledWith([PERMISSIONS.IOS.CAMERA]);
});

test.each([
  RESULTS.GRANTED,
  RESULTS.LIMITED,
  RESULTS.BLOCKED,
  RESULTS.UNAVAILABLE,
])('no solicita nuevamente un permiso %s', async status => {
  checking(status);
  expect(await requestResourcePermission('gallery')).toBe(status);
  expect(requestMultiple).not.toHaveBeenCalled();
});

test('Android usa el selector de fotos sin pedir acceso amplio a archivos', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(await checkResourcePermission('gallery')).toBe('system-picker');
  expect(await requestResourcePermission('gallery')).toBe('system-picker');
  expect(checkMultiple).not.toHaveBeenCalled();
  expect(requestMultiple).not.toHaveBeenCalled();
});

test('Android solicita coarse y fine juntos y acepta ubicación aproximada', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(requestMultiple).mockResolvedValueOnce({
    [PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION]: RESULTS.GRANTED,
    [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.DENIED,
  } as PermissionResults);
  expect(await requestResourcePermission('location')).toBe('limited');
  expect(requestMultiple).toHaveBeenCalledWith([
    PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  ]);
});

test('detecta BLOCKED después de solicitar en Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(requestMultiple).mockResolvedValueOnce({
    [PERMISSIONS.ANDROID.CAMERA]: RESULTS.BLOCKED,
  } as PermissionResults);
  expect(await requestResourcePermission('camera')).toBe('blocked');
});

test('calendario Android requiere ambos permisos', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.mocked(requestMultiple).mockResolvedValueOnce({
    [PERMISSIONS.ANDROID.READ_CALENDAR]: RESULTS.GRANTED,
    [PERMISSIONS.ANDROID.WRITE_CALENDAR]: RESULTS.DENIED,
  } as PermissionResults);
  expect(await requestResourcePermission('calendar')).toBe('denied');
  expect(requestMultiple).toHaveBeenCalledWith([
    PERMISSIONS.ANDROID.READ_CALENDAR,
    PERMISSIONS.ANDROID.WRITE_CALENDAR,
  ]);
});

test('propaga errores nativos para que la interfaz permita reintentar', async () => {
  jest.mocked(checkMultiple).mockRejectedValueOnce(new Error('native error'));
  await expect(checkResourcePermission('camera')).rejects.toThrow(
    'native error',
  );
});

test('abre los ajustes de la aplicación', async () => {
  await openDeviceSettings();
  expect(openSettings).toHaveBeenCalledWith('application');
});

test('solo considera utilizables permisos concedidos, limitados o el selector', () => {
  expect(
    ([RESULTS.GRANTED, RESULTS.LIMITED, 'system-picker'] as const).map(
      hasResourceAccess,
    ),
  ).toEqual([true, true, true]);
  expect(
    [RESULTS.DENIED, RESULTS.BLOCKED, RESULTS.UNAVAILABLE].map(
      hasResourceAccess,
    ),
  ).toEqual([false, false, false]);
});
