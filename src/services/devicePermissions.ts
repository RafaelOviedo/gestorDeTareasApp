import { Platform } from 'react-native';
import {
  checkMultiple,
  requestMultiple,
  openSettings,
  PERMISSIONS,
  RESULTS,
  type Permission,
  type PermissionStatus,
} from 'react-native-permissions';

export const deviceResources = [
  'camera',
  'gallery',
  'location',
  'contacts',
  'calendar',
] as const;
export type DeviceResource = (typeof deviceResources)[number];
export type ResourcePermission = PermissionStatus | 'system-picker';

function permissionsFor(resource: DeviceResource): Permission[] {
  if (Platform.OS === 'ios') {
    const permissions = {
      camera: PERMISSIONS.IOS.CAMERA,
      gallery: PERMISSIONS.IOS.PHOTO_LIBRARY,
      location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      contacts: PERMISSIONS.IOS.CONTACTS,
      // El handler también utiliza la API anterior en iOS < 17.
      calendar: PERMISSIONS.IOS.CALENDARS_WRITE_ONLY,
    };
    return [permissions[resource]];
  }
  if (Platform.OS === 'android') {
    const permissions = {
      camera: [PERMISSIONS.ANDROID.CAMERA],
      gallery: [], // El selector del sistema concede acceso a la foto elegida.
      location: [
        PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
        PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
      ],
      contacts: [PERMISSIONS.ANDROID.READ_CONTACTS],
      calendar: [
        PERMISSIONS.ANDROID.READ_CALENDAR,
        PERMISSIONS.ANDROID.WRITE_CALENDAR,
      ],
    };
    return permissions[resource];
  }
  return [];
}

function summarize(
  resource: DeviceResource,
  statuses: Record<string, PermissionStatus>,
): ResourcePermission {
  if (Platform.OS === 'android' && resource === 'location') {
    if (
      statuses[PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION] === RESULTS.GRANTED
    ) {
      return RESULTS.GRANTED;
    }
    if (
      statuses[PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION] === RESULTS.GRANTED
    ) {
      return RESULTS.LIMITED;
    }
  }
  const values = Object.values(statuses);
  for (const status of [
    RESULTS.UNAVAILABLE,
    RESULTS.BLOCKED,
    RESULTS.DENIED,
    RESULTS.LIMITED,
  ]) {
    if (values.includes(status)) {
      return status;
    }
  }
  return RESULTS.GRANTED;
}

export function hasResourceAccess(status: ResourcePermission): boolean {
  return (
    status === RESULTS.GRANTED ||
    status === RESULTS.LIMITED ||
    status === 'system-picker'
  );
}

export async function checkResourcePermission(
  resource: DeviceResource,
): Promise<ResourcePermission> {
  if (Platform.OS === 'android' && resource === 'gallery') {
    return 'system-picker';
  }
  const permissions = permissionsFor(resource);
  if (!permissions.length) {
    return RESULTS.UNAVAILABLE;
  }
  return summarize(resource, await checkMultiple(permissions));
}

export async function requestResourcePermission(
  resource: DeviceResource,
): Promise<ResourcePermission> {
  const current = await checkResourcePermission(resource);
  if (current !== RESULTS.DENIED) {
    return current;
  }
  // En Android check no detecta BLOCKED; request sí devuelve ese estado.
  return summarize(resource, await requestMultiple(permissionsFor(resource)));
}

export async function openDeviceSettings(): Promise<void> {
  await openSettings('application');
}
