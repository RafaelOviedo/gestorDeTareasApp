import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredUser, User } from '../types/user';
import { normalizeUsername, validateCredentials } from '../utils/validations';

export const USERS_STORAGE_KEY = 'users';
export const SESSION_STORAGE_KEY = 'session';

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const user = value as Partial<StoredUser>;
  return (
    typeof user.id === 'string' &&
    user.id.length > 0 &&
    typeof user.username === 'string' &&
    user.username.trim().length > 0 &&
    typeof user.password === 'string' &&
    user.password.trim().length > 0
  );
}

async function readUsers(): Promise<StoredUser[]> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(USERS_STORAGE_KEY);
  } catch {
    throw new Error('No se pudieron leer las cuentas. Intentá nuevamente.');
  }
  if (raw === null) {
    return [];
  }
  try {
    const users: unknown = JSON.parse(raw);
    if (!Array.isArray(users) || !users.every(isStoredUser)) {
      throw new Error('Invalid stored accounts');
    }
    return users;
  } catch {
    // No reemplazar datos dañados por una lista vacía: se perderían las cuentas existentes.
    throw new Error(
      'Las cuentas guardadas tienen un formato inválido. No se modificaron los datos.',
    );
  }
}

function checkCredentials(username: string, password: string) {
  const error = validateCredentials(username, password);
  if (error) {
    throw new Error(error);
  }
}

function toUser(user: StoredUser): User {
  return { id: user.id, username: user.username };
}

export async function registerUser(
  username: string,
  password: string,
): Promise<User> {
  checkCredentials(username, password);
  const users = await readUsers();
  const normalized = normalizeUsername(username);
  if (users.some(user => normalizeUsername(user.username) === normalized)) {
    throw new Error('Ese usuario ya está registrado. Elegí otro nombre.');
  }
  const user: StoredUser = {
    // El nombre normalizado es único e inmutable en este proyecto.
    id: `user:${normalized}`,
    username: username.trim(),
    password,
  };
  try {
    await AsyncStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify([...users, user]),
    );
  } catch {
    throw new Error('No se pudo guardar la cuenta. Intentá nuevamente.');
  }
  return toUser(user);
}

export async function authenticateUser(
  username: string,
  password: string,
): Promise<User> {
  checkCredentials(username, password);
  const users = await readUsers();
  const user = users.find(
    account =>
      normalizeUsername(account.username) === normalizeUsername(username) &&
      account.password === password,
  );
  if (!user) {
    throw new Error('Usuario o contraseña incorrectos.');
  }
  return toUser(user);
}

// La sesión guarda únicamente el id; los datos del usuario se recuperan de users.
export async function saveSession(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, userId);
  } catch {
    throw new Error('No se pudo guardar la sesión. Intentá nuevamente.');
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    throw new Error('No se pudo cerrar la sesión. Intentá nuevamente.');
  }
}

export async function restoreSession(): Promise<User | null> {
  let userId: string | null;
  try {
    userId = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    throw new Error('No se pudo recuperar la sesión. Intentá nuevamente.');
  }
  if (userId === null) {
    return null;
  }
  const users = await readUsers();
  const user = users.find(account => account.id === userId);
  if (!user) {
    await clearSession();
    return null;
  }
  return toUser(user);
}
