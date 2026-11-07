export type TaskLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

export type TaskContact = {
  recordId: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type TaskCalendarEvent = {
  eventId: string;
  calendarId: string;
  calendarName: string;
  startAt: string;
  endAt: string;
};

export type CalendarEventDraft = {
  calendarId: string;
  startAt: string;
  durationMinutes: number;
};

export type Task = {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: string;
  reminderAt: string | null;
  notificationId: string | null;
  imagePath?: string | null;
  location?: TaskLocation | null;
  contact?: TaskContact | null;
  calendarEvent?: TaskCalendarEvent | null;
};

export type TaskDraft = {
  title: string;
  reminderSeconds: number;
};
