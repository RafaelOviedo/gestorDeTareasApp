import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authenticateUser,
  registerUser,
  USERS_STORAGE_KEY,
} from '../src/services/auth';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('guarda varias cuentas y devuelve una identidad estable sin la contraseña', async () => {
  const ana = await registerUser('  Ana  ', 'Clave');
  const juan = await registerUser('Juan', 'otra');
  expect(ana.username).toBe('Ana');
  expect(ana.id).not.toBe(juan.id);
  expect(ana).not.toHaveProperty('password');
  expect(await authenticateUser('ANA', 'Clave')).toEqual(ana);
  expect(await authenticateUser(' juan ', 'otra')).toEqual(juan);
  expect(
    JSON.parse((await AsyncStorage.getItem(USERS_STORAGE_KEY))!),
  ).toHaveLength(2);
});

test('rechaza duplicados sin sobrescribir la cuenta ni su contraseña', async () => {
  const ana = await registerUser('Ana', 'original');
  const before = await AsyncStorage.getItem(USERS_STORAGE_KEY);
  await expect(registerUser(' ANA ', 'nueva')).rejects.toThrow(
    'Ese usuario ya está registrado.',
  );
  expect(await AsyncStorage.getItem(USERS_STORAGE_KEY)).toBe(before);
  expect(await authenticateUser('ana', 'original')).toEqual(ana);
  await expect(authenticateUser('ana', 'nueva')).rejects.toThrow(
    'Usuario o contraseña incorrectos.',
  );
});

test('compara la contraseña exactamente y rechaza usuarios inexistentes', async () => {
  await registerUser('Ana', ' Clave ');
  await expect(authenticateUser('Ana', 'Clave')).rejects.toThrow(
    'Usuario o contraseña incorrectos.',
  );
  await expect(authenticateUser('Ana', ' clave ')).rejects.toThrow(
    'Usuario o contraseña incorrectos.',
  );
  await expect(authenticateUser('Otro', ' Clave ')).rejects.toThrow(
    'Usuario o contraseña incorrectos.',
  );
  expect(await authenticateUser('Ana', ' Clave ')).toHaveProperty(
    'username',
    'Ana',
  );
});

test('valida antes de escribir datos', async () => {
  await expect(registerUser(' ', 'clave')).rejects.toThrow(
    'Ingresá un nombre de usuario.',
  );
  await expect(registerUser('Ana', ' ')).rejects.toThrow(
    'Ingresá una contraseña.',
  );
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('un fallo de escritura no informa éxito y permite reintentar', async () => {
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk unavailable'));
  await expect(registerUser('Ana', 'clave')).rejects.toThrow(
    'No se pudo guardar la cuenta.',
  );
  await expect(authenticateUser('Ana', 'clave')).rejects.toThrow(
    'Usuario o contraseña incorrectos.',
  );
  await registerUser('Ana', 'clave');
  expect(await authenticateUser('Ana', 'clave')).toHaveProperty(
    'username',
    'Ana',
  );
});

test('un fallo de lectura no reemplaza cuentas guardadas', async () => {
  await registerUser('Ana', 'clave');
  const before = await AsyncStorage.getItem(USERS_STORAGE_KEY);
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('Disk unavailable'));
  await expect(registerUser('Juan', 'clave')).rejects.toThrow(
    'No se pudieron leer las cuentas.',
  );
  expect(await AsyncStorage.getItem(USERS_STORAGE_KEY)).toBe(before);
});

test.each(['{invalid', 'null', '{}', '[{"id":"1"}]'])(
  'conserva datos corruptos y no permite el acceso: %s',
  async raw => {
    await AsyncStorage.setItem(USERS_STORAGE_KEY, raw);
    await expect(registerUser('Ana', 'clave')).rejects.toThrow(
      'formato inválido',
    );
    await expect(authenticateUser('Ana', 'clave')).rejects.toThrow(
      'formato inválido',
    );
    expect(await AsyncStorage.getItem(USERS_STORAGE_KEY)).toBe(raw);
  },
);
