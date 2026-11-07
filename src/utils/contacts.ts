import type { Contact } from 'react-native-contacts';
import type { TaskContact } from '../types/task';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function toTaskContact(contact: Contact): TaskContact | null {
  const recordId = text(contact.recordID);
  if (!recordId) {
    return null;
  }
  const phone =
    contact.phoneNumbers?.map(item => text(item.number)).find(Boolean) ?? null;
  const email =
    contact.emailAddresses?.map(item => text(item.email)).find(Boolean) ?? null;
  const fullName = [contact.givenName, contact.middleName, contact.familyName]
    .map(text)
    .filter(Boolean)
    .join(' ');
  const name =
    text(contact.displayName) ||
    fullName ||
    text(contact.company) ||
    phone ||
    email ||
    'Contacto sin nombre';
  return { recordId, name, phone, email };
}

export function isTaskContact(value: unknown): value is TaskContact {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const contact = value as Partial<TaskContact>;
  return (
    text(contact.recordId).length > 0 &&
    text(contact.name).length > 0 &&
    (contact.phone === null || text(contact.phone).length > 0) &&
    (contact.email === null || text(contact.email).length > 0)
  );
}

function searchable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesContact(contact: TaskContact, query: string): boolean {
  const search = searchable(query);
  if (
    searchable(
      `${contact.name} ${contact.phone ?? ''} ${contact.email ?? ''}`,
    ).includes(search)
  ) {
    return true;
  }
  const digits = query.replace(/\D/g, '');
  return (
    digits.length > 0 &&
    /^[\d\s()+.-]+$/.test(query) &&
    (contact.phone ?? '').replace(/\D/g, '').includes(digits)
  );
}
