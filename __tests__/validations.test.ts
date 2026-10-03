import {
  normalizeUsername,
  validateCredentials,
} from '../src/utils/validations';

test.each(['', '   ', '\t'])('rechaza un usuario vacío: %j', username => {
  expect(validateCredentials(username, 'clave')).toBe(
    'Ingresá un nombre de usuario.',
  );
});

test.each(['', '   ', '\t'])('rechaza una contraseña vacía: %j', password => {
  expect(validateCredentials('Ana', password)).toBe('Ingresá una contraseña.');
});

test('normaliza el usuario y permite contraseñas con espacios significativos', () => {
  expect(normalizeUsername('  ANA  ')).toBe('ana');
  expect(validateCredentials('Ana', ' Clave ')).toBeNull();
});
