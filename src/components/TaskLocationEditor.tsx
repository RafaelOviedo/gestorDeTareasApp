import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { Task } from '../types/task';
import { useTasksStore } from '../stores/useTasksStore';
import { LocationError } from '../services/taskLocation';
import { openDeviceSettings } from '../services/devicePermissions';
import { formatCoordinates } from '../utils/location';
import { formatReminderDate } from '../utils/tasks';
import AppButton from './AppButton';
import FormMessage from './FormMessage';
import { styles } from '../styles';

export default function TaskLocationEditor({ task }: { task: Task }) {
  const captureLocation = useTasksStore(state => state.captureLocation);
  const removeLocation = useTasksStore(state => state.removeLocation);
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const [error, setError] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function updateLocation(remove = false) {
    if (pending.current || !mounted.current) {
      return;
    }
    pending.current = true;
    setError(null);
    setSettingsAvailable(false);
    setIsLocating(!remove);
    try {
      if (remove) {
        await removeLocation(task.id);
      } else {
        await captureLocation(task.id);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo actualizar la ubicación. Intentá nuevamente.',
        );
        setSettingsAvailable(
          cause instanceof LocationError && cause.settingsAvailable,
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) {
        setIsLocating(false);
      }
    }
  }

  async function settings() {
    try {
      await openDeviceSettings();
    } catch {
      if (mounted.current) {
        setError('No se pudieron abrir los ajustes. Intentá nuevamente.');
      }
    }
  }

  function confirmRemove() {
    Alert.alert(
      'Quitar ubicación',
      '¿Querés quitar el lugar asociado a esta tarea?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            updateLocation(true);
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Lugar de la tarea</Text>
      {task.location ? (
        <>
          <Text selectable style={styles.hint}>
            Coordenadas: {formatCoordinates(task.location)}
          </Text>
          <Text style={styles.hint}>
            Precisión estimada: {Math.ceil(task.location.accuracy)} m
          </Text>
          <Text style={styles.hint}>
            Registrada: {formatReminderDate(task.location.capturedAt)}
          </Text>
        </>
      ) : (
        <Text style={styles.hint}>
          Esta tarea todavía no tiene una ubicación.
        </Text>
      )}
      <Text style={styles.hint}>
        Usá este botón cuando estés en el lugar de la tarea. Se guarda tu
        posición actual.
      </Text>
      <FormMessage message={error} />
      <AppButton
        title={
          isLocating
            ? 'Obteniendo ubicación…'
            : task.location
            ? 'Actualizar ubicación'
            : 'Usar ubicación actual'
        }
        disabled={busy || isLocating}
        onPress={() => {
          updateLocation();
        }}
      />
      {task.location ? (
        <AppButton
          title="Quitar ubicación"
          variant="secondary"
          disabled={busy}
          onPress={confirmRemove}
        />
      ) : null}
      {settingsAvailable ? (
        <AppButton
          title="Abrir ajustes de ubicación"
          variant="secondary"
          disabled={busy}
          onPress={settings}
        />
      ) : null}
    </View>
  );
}
