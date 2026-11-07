import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import {
  checkResourcePermission,
  deviceResources,
  openDeviceSettings,
  requestResourcePermission,
  type DeviceResource,
  type ResourcePermission,
} from '../services/devicePermissions';
import AppButton from './AppButton';
import FormMessage from './FormMessage';
import { styles } from '../styles';

const labels: Record<DeviceResource, string> = {
  camera: 'Cámara',
  gallery: 'Galería',
  location: 'Ubicación',
  contacts: 'Contactos',
  calendar: 'Calendario',
};
const descriptions: Record<DeviceResource, string> = {
  camera: 'Tomar una foto para una tarea.',
  gallery: 'Elegir una imagen para una tarea.',
  location: 'Obtener el lugar de una tarea mientras usás la app.',
  contacts: 'Elegir un contacto relacionado con una tarea.',
  calendar: 'Crear un evento vinculado a una tarea.',
};
type Entry = {
  status?: ResourcePermission;
  rejected?: boolean;
  error?: string;
};
type Entries = Partial<Record<DeviceResource, Entry>>;

function statusMessage(resource: DeviceResource, entry: Entry): string {
  switch (entry.status) {
    case 'granted':
      return 'Acceso concedido.';
    case 'limited':
      return resource === 'location'
        ? 'Acceso a la ubicación aproximada.'
        : 'Acceso limitado a los elementos que autorizaste.';
    case 'blocked':
      return 'Acceso bloqueado. Podés habilitarlo desde Ajustes.';
    case 'unavailable':
      return 'Este recurso no está disponible en el dispositivo.';
    case 'system-picker':
      return 'El selector del sistema permite elegir fotos sin autorizar toda la galería.';
    case 'denied':
      return entry.rejected
        ? 'Permiso rechazado. Podés seguir usando tus tareas sin este acceso.'
        : 'Pendiente de autorización.';
    default:
      return 'Permiso pendiente de comprobar.';
  }
}

// Se monta al abrir el panel. Consultar estados nunca muestra solicitudes nativas.
export default function DevicePermissions() {
  const [entries, setEntries] = useState<Entries>({});
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<DeviceResource | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (locked.current) {
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      await Promise.all(
        deviceResources.map(async resource => {
          try {
            const status = await checkResourcePermission(resource);
            if (mounted.current) {
              setEntries(previous => ({
                ...previous,
                [resource]: {
                  ...previous[resource],
                  // Android no distingue DENIED de BLOCKED al consultar.
                  status:
                    status === 'denied' &&
                    previous[resource]?.status === 'blocked'
                      ? 'blocked'
                      : status,
                  error: undefined,
                },
              }));
            }
          } catch {
            if (mounted.current) {
              setEntries(previous => ({
                ...previous,
                [resource]: {
                  error: 'No se pudo consultar el permiso. Intentá nuevamente.',
                },
              }));
            }
          }
        }),
      );
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [refresh]);

  async function handlePermission(resource: DeviceResource, settings = false) {
    if (locked.current) {
      return;
    }
    locked.current = true;
    setBusy(true);
    setPending(resource);
    setEntries(previous => ({
      ...previous,
      [resource]: { ...previous[resource], error: undefined },
    }));
    try {
      if (settings) {
        await openDeviceSettings();
      } else {
        const status = await requestResourcePermission(resource);
        if (mounted.current) {
          setEntries(previous => ({
            ...previous,
            [resource]: { status, rejected: status === 'denied' },
          }));
        }
      }
    } catch {
      if (mounted.current) {
        setEntries(previous => ({
          ...previous,
          [resource]: {
            ...previous[resource],
            error: settings
              ? 'No se pudieron abrir los ajustes. Intentá nuevamente.'
              : 'No se pudo solicitar el permiso. Intentá nuevamente.',
          },
        }));
      }
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        setPending(null);
      }
    }
  }

  return (
    <View>
      <Text style={styles.hint}>
        Vos elegís qué accesos autorizar. Solo se solicitan cuando pulsás el
        botón correspondiente.
      </Text>
      {deviceResources.map(resource => {
        const entry = entries[resource] ?? {};
        const canAsk = entry.status === 'denied';
        const canOpenSettings = ['blocked', 'limited', 'granted'].includes(
          entry.status ?? '',
        );
        return (
          <View key={resource} style={styles.card}>
            <Text style={styles.label}>{labels[resource]}</Text>
            <Text style={styles.hint}>{descriptions[resource]}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {pending === resource
                ? 'Procesando permiso…'
                : statusMessage(resource, entry)}
            </Text>
            <FormMessage message={entry.error ?? null} />
            {canAsk || canOpenSettings ? (
              <AppButton
                title={`${canAsk ? 'Autorizar' : 'Abrir ajustes de'} ${labels[
                  resource
                ].toLowerCase()}`}
                variant="secondary"
                disabled={busy}
                onPress={() => {
                  handlePermission(resource, canOpenSettings);
                }}
              />
            ) : null}
          </View>
        );
      })}
      <AppButton
        title={busy ? 'Consultando permisos…' : 'Actualizar permisos'}
        variant="secondary"
        disabled={busy}
        onPress={refresh}
      />
    </View>
  );
}
