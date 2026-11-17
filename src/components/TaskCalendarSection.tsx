import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Task } from '../types/task';
import { useTasksStore } from '../stores/useTasksStore';
import { formatReminderDate } from '../utils/tasks';
import { styles } from '../styles';
import AppButton from './AppButton';
import FormMessage from './FormMessage';
import { CalendarError } from '../services/taskCalendar';
import { openDeviceSettings } from '../services/devicePermissions';

export default function TaskCalendarSection({
  task,
  onCreate,
}: {
  task: Task;
  onCreate: () => void;
}) {
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const event = task.calendarEvent;
  const refreshEvent = useTasksStore(state => state.refreshCalendarEvent);
  const deleteEvent = useTasksStore(state => state.deleteCalendarEvent);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const active = useRef(false);
  const working = useRef(false);
  const eventId = event?.eventId;
  const taskId = task.id;

  const refresh = useCallback(
    async (requestAccess: boolean) => {
      if (!active.current || working.current || !eventId) {
        return;
      }
      working.current = true;
      setError(null);
      setNotice(null);
      setSettingsAvailable(false);
      try {
        const updated = await refreshEvent(taskId, requestAccess);
        if (updated && active.current) {
          const current = useTasksStore
            .getState()
            .tasks.find(item => item.id === taskId);
          setNotice(
            current?.calendarEvent
              ? 'Evento actualizado desde el calendario.'
              : 'El evento ya no está disponible en Calendario. Se quitó el vínculo de esta tarea.',
          );
        }
      } catch (cause) {
        if (active.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudo verificar el evento.',
          );
          setSettingsAvailable(
            cause instanceof CalendarError && cause.settingsAvailable,
          );
        }
      } finally {
        working.current = false;
      }
    },
    [eventId, refreshEvent, taskId],
  );

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      // Consultas automáticas nunca abren el diálogo de permisos.
      refresh(false);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
          refresh(false);
        }
      });
      return () => {
        active.current = false;
        subscription.remove();
      };
    }, [refresh]),
  );

  async function remove() {
    if (!active.current || working.current) {
      return;
    }
    working.current = true;
    setError(null);
    setNotice(null);
    setSettingsAvailable(false);
    try {
      if (await deleteEvent(taskId)) {
        if (active.current) {
          setNotice('Evento eliminado del calendario.');
        }
      }
    } catch (cause) {
      if (active.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo eliminar el evento.',
        );
        setSettingsAvailable(
          cause instanceof CalendarError && cause.settingsAvailable,
        );
      }
    } finally {
      working.current = false;
    }
  }

  function confirmRemove() {
    Alert.alert(
      'Eliminar evento del calendario',
      'Se eliminará el evento vinculado en Calendario. La tarea y su recordatorio se conservarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar evento',
          style: 'destructive',
          onPress: () => {
            remove();
          },
        },
      ],
    );
  }

  async function openSettings() {
    try {
      await openDeviceSettings();
    } catch {
      if (active.current) {
        setError(
          'No se pudieron abrir los ajustes. Buscá Gestor de Tareas en Ajustes para cambiar el permiso de Calendario.',
        );
      }
    }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Evento en el calendario</Text>
      <FormMessage message={error} />
      <FormMessage message={notice} variant="success" />
      {event ? (
        <>
          <Text style={styles.label}>{event.calendarName}</Text>
          <Text style={styles.hint}>
            Inicio: {formatReminderDate(event.startAt)}
          </Text>
          <Text style={styles.hint}>
            Fin: {formatReminderDate(event.endAt)}
          </Text>
          <Text style={styles.hint}>
            El vínculo se verifica al abrir este detalle o volver desde
            Calendario. Si no se puede verificar, se conservan los últimos datos
            guardados.
          </Text>
          <AppButton
            title="Actualizar evento"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              refresh(true);
            }}
          />
          {settingsAvailable ? (
            <AppButton
              title="Abrir ajustes de calendario"
              variant="secondary"
              disabled={busy}
              onPress={openSettings}
            />
          ) : null}
          <AppButton
            title="Eliminar evento del calendario"
            variant="secondary"
            disabled={busy}
            onPress={confirmRemove}
          />
          <Text style={styles.hint}>
            Completar o eliminar la tarea conserva el evento en el calendario.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Reservá un horario para realizar esta tarea.
          </Text>
          <AppButton
            title="Agregar al calendario"
            disabled={busy}
            onPress={onCreate}
          />
        </>
      )}
    </View>
  );
}
