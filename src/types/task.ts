export type Task = {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  createdAt: string;
  reminderAt: string | null;
  notificationId: string | null;
};

export type TaskDraft = {
  title: string;
  reminderSeconds: number;
};
