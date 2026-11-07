import Contacts from 'react-native-contacts';
import {
  checkResourcePermission,
  requestResourcePermission,
} from './devicePermissions';
import { toTaskContact } from '../utils/contacts';
import type { TaskContact } from '../types/task';

export class ContactsError extends Error {
  constructor(message: string, public readonly settingsAvailable = false) {
    super(message);
    this.name = 'ContactsError';
  }
}

export async function listDeviceContacts(
  requestAccess = true,
): Promise<{ contacts: TaskContact[]; limited: boolean }> {
  let permission;
  try {
    permission = await (requestAccess
      ? requestResourcePermission('contacts')
      : checkResourcePermission('contacts'));
  } catch {
    throw new ContactsError(
      'No se pudo consultar el permiso de contactos. Intentá nuevamente.',
    );
  }
  if (permission === 'unavailable') {
    throw new ContactsError(
      'La agenda de contactos no está disponible en este dispositivo.',
    );
  }
  if (permission !== 'granted' && permission !== 'limited') {
    throw new ContactsError(
      permission === 'blocked'
        ? 'El acceso a contactos está bloqueado. Podés habilitarlo desde Ajustes.'
        : 'No autorizaste el acceso a contactos. Podés reintentar o continuar sin asociar una persona.',
      true,
    );
  }
  try {
    const records = await Contacts.getAllWithoutPhotos();
    const contacts = new Map<string, TaskContact>();
    for (const record of records) {
      const contact = toTaskContact(record);
      if (contact) {
        contacts.set(contact.recordId, contact);
      }
    }
    return {
      contacts: [...contacts.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      ),
      limited: permission === 'limited',
    };
  } catch {
    throw new ContactsError(
      'No se pudieron leer los contactos. Revisá el permiso e intentá nuevamente.',
      true,
    );
  }
}

export async function getDeviceContact(recordId: string): Promise<TaskContact> {
  // Volvemos a leer la selección autorizada: el contacto pudo cambiar o dejar de estar disponible.
  // getAllWithoutPhotos también funciona con el acceso limitado de iOS.
  const { contacts } = await listDeviceContacts(false);
  const contact = contacts.find(item => item.recordId === recordId);
  if (!contact) {
    throw new ContactsError(
      'Ese contacto ya no está disponible. Actualizá la lista y elegí otro.',
    );
  }
  return contact;
}
