import { Dirs, FileSystem } from 'react-native-file-access';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import {
  hasResourceAccess,
  requestResourcePermission,
  type ResourcePermission,
} from './devicePermissions';

export type ImageSource = 'camera' | 'gallery';
export type SelectedImage = { uri: string; extension: string };

export class ImagePermissionError extends Error {
  constructor(public readonly status: ResourcePermission, source: ImageSource) {
    const resource = source === 'camera' ? 'la cámara' : 'la galería';
    super(
      status === 'unavailable'
        ? `${
            resource === 'la cámara' ? 'La cámara' : 'La galería'
          } no está disponible en este dispositivo.`
        : status === 'blocked'
        ? `El acceso a ${resource} está bloqueado. Podés habilitarlo desde Ajustes.`
        : `No autorizaste el acceso a ${resource}. Podés reintentar o continuar sin una foto.`,
    );
    this.name = 'ImagePermissionError';
  }
}

const pickerOptions: ImageLibraryOptions = {
  mediaType: 'photo',
  selectionLimit: 1,
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
  includeBase64: false,
  includeExtra: false,
  assetRepresentationMode: 'compatible',
};
const extensions = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif'];

function selectedImage(asset?: Asset): SelectedImage {
  if (
    !asset?.uri ||
    !/^(file:\/\/|content:\/\/)/.test(asset.uri) ||
    (asset.type && !asset.type.startsWith('image/'))
  ) {
    throw new Error('No se recibió una imagen válida. Intentá con otra foto.');
  }
  const suffix =
    asset.type?.split('/')[1] ??
    asset.fileName?.split('.').pop()?.toLowerCase() ??
    'jpg';
  return {
    uri: asset.uri,
    extension: extensions.includes(suffix) ? suffix : 'jpg',
  };
}

export async function pickTaskImage(
  source: ImageSource,
): Promise<SelectedImage | null> {
  let status: ResourcePermission;
  try {
    status = await requestResourcePermission(source);
  } catch {
    throw new Error(
      'No se pudo solicitar el permiso para la foto. Intentá nuevamente.',
    );
  }
  if (!hasResourceAccess(status)) {
    throw new ImagePermissionError(status, source);
  }
  let response: ImagePickerResponse;
  try {
    response =
      source === 'camera'
        ? await launchCamera({ ...pickerOptions, saveToPhotos: false })
        : await launchImageLibrary(pickerOptions);
  } catch {
    throw new Error(
      'No se pudo abrir la cámara o galería. Intentá nuevamente.',
    );
  }
  if (response.didCancel) {
    return null;
  }
  if (response.errorCode === 'camera_unavailable') {
    throw new ImagePermissionError('unavailable', 'camera');
  }
  if (response.errorCode === 'permission') {
    throw new ImagePermissionError('blocked', source);
  }
  if (response.errorCode) {
    throw new Error('No se pudo obtener la foto. Intentá nuevamente.');
  }
  return selectedImage(response.assets?.[0]);
}

// Guardamos una ruta relativa: el directorio de la app en iOS puede cambiar.
export function isTaskImagePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^task-images\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|heic|heif|webp|gif)$/.test(
      value,
    )
  );
}

export function taskImageUri(path: string): string {
  if (!isTaskImagePath(path)) {
    throw new Error('Ruta de imagen inválida.');
  }
  return `file://${Dirs.DocumentDir}/${path}`;
}

export async function removeTaskImageFile(path?: string | null): Promise<void> {
  if (!isTaskImagePath(path)) {
    return;
  }
  // La limpieza no debe revertir una tarea ya guardada ni eliminar fotos externas.
  try {
    const absolute = `${Dirs.DocumentDir}/${path}`;
    if (await FileSystem.exists(absolute)) {
      await FileSystem.unlink(absolute);
    }
  } catch {
    console.warn('No se pudo limpiar un archivo de imagen sin uso.');
  }
}

export async function persistTaskImage(image: SelectedImage): Promise<string> {
  if (
    !extensions.includes(image.extension) ||
    !/^(file:\/\/|content:\/\/)/.test(image.uri)
  ) {
    throw new Error('No se recibió una imagen válida.');
  }
  let path: string | undefined;
  let copyingStarted = false;
  try {
    await FileSystem.mkdir(`${Dirs.DocumentDir}/task-images`);
    let name = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    path = `task-images/${name}.${image.extension}`;
    while (await FileSystem.exists(`${Dirs.DocumentDir}/${path}`)) {
      name += '-1';
      path = `task-images/${name}.${image.extension}`;
    }
    const source = image.uri.startsWith('file://')
      ? decodeURIComponent(image.uri.slice(7))
      : image.uri;
    copyingStarted = true;
    await FileSystem.cp(source, `${Dirs.DocumentDir}/${path}`);
    return path;
  } catch {
    if (copyingStarted) {
      await removeTaskImageFile(path);
    }
    throw new Error(
      'No se pudo guardar la foto en el dispositivo. Intentá nuevamente.',
    );
  }
}
