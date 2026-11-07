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
};

export type TaskDraft = {
  title: string;
  reminderSeconds: number;
};
