import { Dirs, FileSystem } from 'react-native-file-access';
import { FileSystem as mockFiles } from 'react-native-file-access/jest/mock';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import * as permissions from '../src/services/devicePermissions';
import {
  pickTaskImage,
  persistTaskImage,
  removeTaskImageFile,
  taskImageUri,
  ImagePermissionError,
} from '../src/services/taskImages';

beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.filesystem.clear();
  jest
    .spyOn(permissions, 'requestResourcePermission')
    .mockResolvedValue('granted');
});
afterEach(() => jest.restoreAllMocks());

test.each(['camera', 'gallery'] as const)(
  'pide permiso antes de abrir %s y devuelve una foto',
  async source => {
    const picker = source === 'camera' ? launchCamera : launchImageLibrary;
    jest
      .mocked(picker)
      .mockResolvedValueOnce({
        assets: [{ uri: 'file:///cache/photo.jpg', type: 'image/jpeg' }],
      });
    expect(await pickTaskImage(source)).toEqual({
      uri: 'file:///cache/photo.jpg',
      extension: 'jpeg',
    });
    expect(permissions.requestResourcePermission).toHaveBeenCalledWith(source);
    expect(
      jest.mocked(permissions.requestResourcePermission).mock
        .invocationCallOrder[0],
    ).toBeLessThan(jest.mocked(picker).mock.invocationCallOrder[0]);
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        includeBase64: false,
        includeExtra: false,
      }),
    );
  },
);

test.each(['denied', 'blocked', 'unavailable'] as const)(
  'no abre el selector si el permiso es %s',
  async status => {
    jest
      .mocked(permissions.requestResourcePermission)
      .mockResolvedValueOnce(status);
    await expect(pickTaskImage('camera')).rejects.toBeInstanceOf(
      ImagePermissionError,
    );
    expect(launchCamera).not.toHaveBeenCalled();
  },
);

test.each(['limited', 'system-picker'] as const)(
  'acepta acceso %s sin exigir permiso amplio',
  async status => {
    jest
      .mocked(permissions.requestResourcePermission)
      .mockResolvedValueOnce(status);
    jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
    expect(await pickTaskImage('gallery')).toBeNull();
    expect(launchImageLibrary).toHaveBeenCalled();
  },
);

test('distingue cámara no disponible, errores nativos y una respuesta sin foto', async () => {
  jest
    .mocked(launchCamera)
    .mockResolvedValueOnce({ errorCode: 'camera_unavailable' });
  await expect(pickTaskImage('camera')).rejects.toThrow('no está disponible');
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValueOnce({
      errorCode: 'others',
      errorMessage: 'native details',
    });
  await expect(pickTaskImage('gallery')).rejects.toThrow(
    'No se pudo obtener la foto',
  );
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ assets: [{}] });
  await expect(pickTaskImage('gallery')).rejects.toThrow('imagen válida');
});

test('copia archivos temporales a Documents y guarda solo la ruta relativa', async () => {
  mockFiles.filesystem.set('/cache/foto prueba.jpg', 'photo');
  const path = await persistTaskImage({
    uri: 'file:///cache/foto%20prueba.jpg',
    extension: 'jpg',
  });
  expect(path).toMatch(/^task-images\/.+\.jpg$/);
  expect(await FileSystem.readFile(`${Dirs.DocumentDir}/${path}`)).toBe(
    'photo',
  );
  expect(taskImageUri(path)).toBe(`file://${Dirs.DocumentDir}/${path}`);
  expect(await FileSystem.exists('/cache/foto prueba.jpg')).toBe(true);
});

test('copia content URIs de Android y no sobrescribe archivos existentes', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(123);
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  mockFiles.filesystem.set('content://photos/1', 'one');
  const first = await persistTaskImage({
    uri: 'content://photos/1',
    extension: 'png',
  });
  const second = await persistTaskImage({
    uri: 'content://photos/1',
    extension: 'png',
  });
  expect(first).not.toBe(second);
  expect(await FileSystem.exists(`${Dirs.DocumentDir}/${first}`)).toBe(true);
});

test('limpia una copia parcial si falla y no elimina archivos externos', async () => {
  jest
    .spyOn(FileSystem, 'cp')
    .mockImplementationOnce(async (_source, target) => {
      mockFiles.filesystem.set(target, 'partial');
      throw new Error('disk full');
    });
  await expect(
    persistTaskImage({ uri: 'file:///cache/photo.jpg', extension: 'jpg' }),
  ).rejects.toThrow('No se pudo guardar la foto');
  expect(
    [...mockFiles.filesystem.keys()].filter(path => path.endsWith('.jpg')),
  ).toEqual([]);
  await removeTaskImageFile('../users');
  await removeTaskImageFile('file:///cache/photo.jpg');
  expect(FileSystem.unlink).toHaveBeenCalledTimes(1);
  expect(() => taskImageUri('../users')).toThrow('inválida');
});
