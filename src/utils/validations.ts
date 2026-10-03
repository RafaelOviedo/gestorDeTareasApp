export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateCredentials(
  username: string,
  password: string,
): string | null {
  if (!username.trim()) {
    return 'Ingresá un nombre de usuario.';
  }
  if (!password.trim()) {
    return 'Ingresá una contraseña.';
  }
  return null;
}
