import Geolocation, {
  type GeolocationResponse,
  type GeolocationError,
} from '@react-native-community/geolocation';
import * as permissions from '../src/services/devicePermissions';
import { getTaskLocation, LocationError } from '../src/services/taskLocation';
import { isTaskLocation, formatCoordinates } from '../src/utils/location';

const position: GeolocationResponse = {
  coords: {
    latitude: -34.603722,
    longitude: -58.381592,
    accuracy: 12,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.parse('2026-11-07T15:00:00Z'),
};
const location = {
  latitude: -34.603722,
  longitude: -58.381592,
  accuracy: 12,
  capturedAt: '2026-11-07T15:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(permissions, 'requestResourcePermission')
    .mockResolvedValue('granted');
  jest
    .mocked(Geolocation.getCurrentPosition)
    .mockImplementation(success => success(position));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('pide permiso antes de consultar una posición actual sin habilitar segundo plano', async () => {
  expect(await getTaskLocation()).toEqual(location);
  expect(permissions.requestResourcePermission).toHaveBeenCalledWith(
    'location',
  );
  expect(
    jest.mocked(permissions.requestResourcePermission).mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    jest.mocked(Geolocation.getCurrentPosition).mock.invocationCallOrder[0],
  );
  expect(Geolocation.setRNConfiguration).toHaveBeenCalledWith(
    expect.objectContaining({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
      enableBackgroundLocationUpdates: false,
    }),
  );
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    { maximumAge: 0, timeout: 20000, enableHighAccuracy: true },
  );
});

test.each(['denied', 'blocked', 'unavailable'] as const)(
  'no consulta el GPS con permiso %s',
  async status => {
    jest
      .mocked(permissions.requestResourcePermission)
      .mockResolvedValueOnce(status);
    await expect(getTaskLocation()).rejects.toBeInstanceOf(LocationError);
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  },
);

test('acepta ubicación aproximada sin exigir GPS preciso', async () => {
  jest
    .mocked(permissions.requestResourcePermission)
    .mockResolvedValueOnce('limited');
  expect(await getTaskLocation()).toEqual(location);
  expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    expect.objectContaining({ enableHighAccuracy: false }),
  );
});

test.each([
  [1, 'No hay permiso'],
  [2, 'servicios de ubicación'],
  [3, 'Se agotó el tiempo'],
] as const)('traduce el error nativo %s', async (code, message) => {
  jest
    .mocked(Geolocation.getCurrentPosition)
    .mockImplementationOnce((_success, error) =>
      error?.({
        code,
        message: 'native',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationError),
    );
  await expect(getTaskLocation()).rejects.toThrow(message);
});

test('libera la espera si el proveedor no responde e ignora resultados tardíos', async () => {
  jest.useFakeTimers();
  let callback!: (value: GeolocationResponse) => void;
  jest
    .mocked(Geolocation.getCurrentPosition)
    .mockImplementationOnce(success => {
      callback = success;
    });
  const result = getTaskLocation().catch(error => error);
  await Promise.resolve();
  jest.advanceTimersByTime(25000);
  expect(await result).toEqual(
    expect.objectContaining({
      message: expect.stringContaining('Se agotó el tiempo'),
    }),
  );
  callback(position);
  expect(jest.getTimerCount()).toBe(0);
});

test('rechaza coordenadas inválidas del proveedor y libera el temporizador', async () => {
  jest.useFakeTimers();
  jest
    .mocked(Geolocation.getCurrentPosition)
    .mockImplementationOnce(success =>
      success({ ...position, coords: { ...position.coords, latitude: NaN } }),
    );
  await expect(getTaskLocation()).rejects.toThrow('ubicación inválida');
  expect(jest.getTimerCount()).toBe(0);
});

test.each([
  { latitude: 91 },
  { latitude: -91 },
  { longitude: 181 },
  { longitude: -181 },
  { accuracy: -1 },
  { accuracy: Infinity },
  { capturedAt: 'invalid' },
])('rechaza datos inválidos antes de persistir: %j', change => {
  expect(isTaskLocation({ ...location, ...change })).toBe(false);
});

test('acepta coordenadas cero y formatea el lugar sin invertir latitud y longitud', () => {
  expect(
    isTaskLocation({ ...location, latitude: 0, longitude: 0, accuracy: 0 }),
  ).toBe(true);
  expect(formatCoordinates(location)).toBe('-34.603722, -58.381592');
});
