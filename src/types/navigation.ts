export type RootStackParamList = {
  Login: { registeredUsername?: string } | undefined;
  Register: undefined;
  Home: undefined;
  CreateTask: undefined;
  TaskDetail: { taskId: string };
};
