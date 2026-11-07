import Geolocation from '@react-native-community/geolocation';
import { requestResourcePermission } from './devicePermissions';
import { isTaskLocation } from '../utils/location';
import type { TaskLocation } from '../types/task';

export class LocationError extends Error {
  constructor(message: string, public readonly settingsAvailable = false) {
    super(message);
    this.name = 'LocationError';
  }
}

export async function getTaskLocation(): Promise<TaskLocation> {
  let permission;
  try {
    permission = await requestResourcePermission('location');
  } catch {
    throw new LocationError(
      'No se pudo solicitar el permiso de ubicación. Intentá nuevamente.',
    );
  }
  if (permission === 'unavailable') {
    throw new LocationError(
      'La ubicación no está disponible en este dispositivo. Revisá que los servicios de ubicación estén activados.',
    );
  }
  if (permission !== 'granted' && permission !== 'limited') {
    throw new LocationError(
      permission === 'blocked'
        ? 'El acceso a la ubicación está bloqueado. Podés habilitarlo desde Ajustes.'
        : 'No autorizaste el acceso a la ubicación. Podés reintentar o continuar sin asociar un lugar.',
      true,
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutMessage =
      'Se agotó el tiempo para obtener la ubicación. Intentá nuevamente en un lugar con mejor señal.';
    // Respaldo para que un proveedor que no responde no bloquee las acciones de la app.
    const timer = setTimeout(
      () => fail(new LocationError(timeoutMessage)),
      25000,
    );
    function fail(error: LocationError) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
    try {
      // Los permisos los gestiona nuestro servicio. Solo consultamos una posición en primer plano.
      Geolocation.setRNConfiguration({
        skipPermissionRequests: true,
        authorizationLevel: 'whenInUse',
        enableBackgroundLocationUpdates: false,
        locationProvider: 'android',
      });
      Geolocation.getCurrentPosition(
        position => {
          if (settled) {
            return;
          }
          const date = new Date(position.timestamp);
          const location: TaskLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: Number.isFinite(date.getTime())
              ? date.toISOString()
              : '',
          };
          if (!isTaskLocation(location)) {
            fail(
              new LocationError(
                'El dispositivo devolvió una ubicación inválida. Intentá nuevamente.',
              ),
            );
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(location);
        },
        error => {
          if (error.code === 1) {
            fail(
              new LocationError(
                'No hay permiso para obtener la ubicación. Revisá el acceso desde Ajustes.',
                true,
              ),
            );
          } else if (error.code === 3) {
            fail(new LocationError(timeoutMessage));
          } else {
            fail(
              new LocationError(
                'No se pudo obtener la ubicación. Revisá que los servicios de ubicación estén activados e intentá nuevamente.',
              ),
            );
          }
        },
        {
          timeout: 20000,
          maximumAge: 0,
          enableHighAccuracy: permission !== 'limited',
        },
      );
    } catch {
      fail(
        new LocationError(
          'No se pudo consultar la ubicación. Intentá nuevamente.',
        ),
      );
    }
  });
}
