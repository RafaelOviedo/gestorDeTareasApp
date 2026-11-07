import type { TaskLocation } from '../types/task';

export function isTaskLocation(value: unknown): value is TaskLocation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const location = value as Partial<TaskLocation>;
  return (
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180 &&
    typeof location.accuracy === 'number' &&
    Number.isFinite(location.accuracy) &&
    location.accuracy >= 0 &&
    typeof location.capturedAt === 'string' &&
    Number.isFinite(Date.parse(location.capturedAt))
  );
}

export function formatCoordinates(location: TaskLocation): string {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}
