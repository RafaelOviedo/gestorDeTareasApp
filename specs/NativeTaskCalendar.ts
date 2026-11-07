import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type DeviceCalendar = { id: string; title: string };
export type SavedCalendarEvent = {
  eventId: string;
  calendarId: string;
  calendarName: string;
  startDate: number;
  endDate: number;
};

export interface Spec extends TurboModule {
  getCalendars(): Promise<DeviceCalendar[]>;
  createEvent(
    operationId: string,
    calendarId: string,
    title: string,
    startDate: number,
    endDate: number,
    notes: string,
    location: string,
  ): Promise<SavedCalendarEvent>;
}

export default TurboModuleRegistry.get<Spec>('NativeTaskCalendar');
