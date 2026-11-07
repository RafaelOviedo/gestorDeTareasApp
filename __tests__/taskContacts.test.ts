import Contacts, { type Contact } from 'react-native-contacts';
import * as permissions from '../src/services/devicePermissions';
import {
  ContactsError,
  getDeviceContact,
  listDeviceContacts,
} from '../src/services/taskContacts';
import {
  isTaskContact,
  matchesContact,
  toTaskContact,
} from '../src/utils/contacts';

const nativeContact = {
  recordID: '1',
  givenName: ' José ',
  middleName: '',
  familyName: 'Pérez',
  displayName: '',
  phoneNumbers: [{ label: 'móvil', number: ' +54 11 1234-5678 ' }],
  emailAddresses: [{ label: 'casa', email: ' jose@example.com ' }],
} as Contact;
const contact = {
  recordId: '1',
  name: 'José Pérez',
  phone: '+54 11 1234-5678',
  email: 'jose@example.com',
};

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(permissions, 'requestResourcePermission')
    .mockResolvedValue('granted');
  jest
    .spyOn(permissions, 'checkResourcePermission')
    .mockResolvedValue('granted');
  jest.mocked(Contacts.getAllWithoutPhotos).mockResolvedValue([nativeContact]);
});
afterEach(() => jest.restoreAllMocks());

test('pide permiso antes de leer la agenda y devuelve solo los datos para la tarea', async () => {
  expect(await listDeviceContacts()).toEqual({
    contacts: [contact],
    limited: false,
  });
  expect(permissions.requestResourcePermission).toHaveBeenCalledWith(
    'contacts',
  );
  expect(
    jest.mocked(permissions.requestResourcePermission).mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    jest.mocked(Contacts.getAllWithoutPhotos).mock.invocationCallOrder[0],
  );
});

test.each(['denied', 'blocked', 'unavailable'] as const)(
  'no lee contactos si el permiso es %s',
  async permission => {
    jest
      .mocked(permissions.requestResourcePermission)
      .mockResolvedValueOnce(permission);
    await expect(listDeviceContacts()).rejects.toBeInstanceOf(ContactsError);
    expect(Contacts.getAllWithoutPhotos).not.toHaveBeenCalled();
  },
);

test('admite acceso limitado y distingue una lista vacía', async () => {
  jest
    .mocked(permissions.requestResourcePermission)
    .mockResolvedValueOnce('limited');
  jest.mocked(Contacts.getAllWithoutPhotos).mockResolvedValueOnce([]);
  expect(await listDeviceContacts()).toEqual({ contacts: [], limited: true });
});

test('al volver de ajustes consulta el permiso sin volver a solicitarlo', async () => {
  await listDeviceContacts(false);
  expect(permissions.checkResourcePermission).toHaveBeenCalledWith('contacts');
  expect(permissions.requestResourcePermission).not.toHaveBeenCalled();
});

test('ordena por nombre, conserva homónimos y descarta ids inválidos o repetidos', async () => {
  jest
    .mocked(Contacts.getAllWithoutPhotos)
    .mockResolvedValueOnce([
      nativeContact,
      nativeContact,
      { ...nativeContact, recordID: '2' },
      { ...nativeContact, recordID: '3', displayName: 'Ana' },
      { ...nativeContact, recordID: '' },
    ]);
  expect(
    (await listDeviceContacts()).contacts.map(item => item.recordId),
  ).toEqual(['3', '1', '2']);
});

test('obtiene una selección fresca y rechaza un contacto borrado o no autorizado', async () => {
  jest
    .mocked(Contacts.getAllWithoutPhotos)
    .mockResolvedValueOnce([
      { ...nativeContact, displayName: 'Nombre actualizado' },
    ])
    .mockResolvedValueOnce([]);
  expect((await getDeviceContact('1')).name).toBe('Nombre actualizado');
  await expect(getDeviceContact('1')).rejects.toThrow('ya no está disponible');
});

test('un fallo nativo se informa como error y no como agenda vacía', async () => {
  jest
    .mocked(Contacts.getAllWithoutPhotos)
    .mockRejectedValueOnce(new Error('native'));
  await expect(listDeviceContacts()).rejects.toThrow('No se pudieron leer');
});

test('usa empresa o un nombre alternativo para contactos incompletos', () => {
  const unnamed = {
    ...nativeContact,
    givenName: '',
    familyName: '',
    phoneNumbers: [],
    emailAddresses: [],
  };
  expect(toTaskContact({ ...unnamed, company: 'Facultad' })).toEqual({
    recordId: '1',
    name: 'Facultad',
    phone: null,
    email: null,
  });
  expect(toTaskContact(unnamed)?.name).toBe('Contacto sin nombre');
  expect(toTaskContact({ ...unnamed, recordID: ' ' })).toBeNull();
});

test.each(['jose', 'PÉREZ', 'jose@example.com', '1112345678', '+54 11'])(
  'encuentra contactos con la búsqueda %s',
  query => {
    expect(matchesContact(contact, query)).toBe(true);
  },
);

test('valida contactos guardados sin exigir teléfono o correo y rechaza campos inválidos', () => {
  expect(isTaskContact({ ...contact, phone: null, email: null })).toBe(true);
  expect(isTaskContact({ ...contact, name: '' })).toBe(false);
  expect(isTaskContact({ ...contact, recordId: 3 })).toBe(false);
  expect(isTaskContact({ ...contact, phone: {} })).toBe(false);
  expect(matchesContact(contact, 'María')).toBe(false);
});
