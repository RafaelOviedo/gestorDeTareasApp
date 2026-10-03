export type User = {
  id: string;
  username: string;
};

// Solo se usa al leer/escribir cuentas locales, nunca como sesión ni parámetro de navegación.
export type StoredUser = User & {
  password: string;
};
