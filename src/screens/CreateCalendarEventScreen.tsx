import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { DeviceCalendar } from '../../specs/NativeTaskCalendar';
import { useAuth } from '../context/AuthContext';
import { useTasksStore } from '../stores/useTasksStore';
import { CalendarError, listDeviceCalendars } from '../services/taskCalendar';
import { openDeviceSettings } from '../services/devicePermissions';
import {
  EVENT_DURATIONS,
  initialEventDate,
  validateCalendarEvent,
} from '../utils/calendar';
import { formatReminderDate } from '../utils/tasks';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import FormMessage from '../components/FormMessage';
import { styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCalendarEvent'>;

export default function CreateCalendarEventScreen({
  route,
  navigation,
}: Props) {
  const { user } = useAuth();
  const task = useTasksStore(state =>
    state.tasks.find(
      item => item.id === route.params.taskId && item.userId === user?.id,
    ),
  );
  const save = useTasksStore(state => state.createCalendarEvent);
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [start, setStart] = useState(() =>
    initialEventDate(task?.reminderAt ?? null),
  );
  const [duration, setDuration] = useState(60);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const mounted = useRef(false);
  const loadSequence = useRef(0);
  const checkingPermission = useRef(false);
  const saving = useRef(false);
  const taskId = task?.id;
  const alreadyLinked = Boolean(task?.calendarEvent);

  const load = useCallback(async (requestAccess: boolean) => {
    const sequence = ++loadSequence.current;
    checkingPermission.current = true;
    setLoading(true);
    setError(null);
    setSettingsAvailable(false);
    try {
      const available = await listDeviceCalendars(requestAccess);
      if (mounted.current && sequence === loadSequence.current) {
        setCalendars(available);
        setCalendarId(previous =>
          available.some(item => item.id === previous)
            ? previous
            : available[0]?.id ?? '',
        );
      }
    } catch (cause) {
      if (mounted.current && sequence === loadSequence.current) {
        setCalendars([]);
        setCalendarId('');
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudieron consultar los calendarios.',
        );
        setSettingsAvailable(
          cause instanceof CalendarError && cause.settingsAvailable,
        );
      }
    } finally {
      if (mounted.current && sequence === loadSequence.current) {
        checkingPermission.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (taskId && !alreadyLinked) {
      load(true);
    }
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (
        next === 'active' &&
        previous !== 'active' &&
        !checkingPermission.current &&
        !saving.current &&
        taskId &&
        !alreadyLinked
      ) {
        load(false);
      }
      previous = next;
    });
    return () => {
      mounted.current = false;
      loadSequence.current += 1;
      subscription.remove();
    };
  }, [load, taskId, alreadyLinked]);

  async function submit() {
    if (!task || busy || saving.current || loading) {
      return;
    }
    const draft = {
      calendarId,
      startAt: start.toISOString(),
      durationMinutes: duration,
    };
    const validation = validateCalendarEvent(draft);
    setError(validation);
    if (validation) {
      return;
    }
    saving.current = true;
    setSettingsAvailable(false);
    try {
      const saved = await save(task.id, draft);
      if (saved && mounted.current) {
        navigation.goBack();
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo crear el evento.',
        );
        setSettingsAvailable(
          cause instanceof CalendarError && cause.settingsAvailable,
        );
      }
    } finally {
      saving.current = false;
    }
  }

  async function openSettings() {
    try {
      await openDeviceSettings();
    } catch {
      if (mounted.current) {
        setError(
          'No se pudieron abrir los ajustes. Abrilos manualmente para autorizar Calendario.',
        );
      }
    }
  }

  if (!task || task.calendarEvent) {
    return (
      <Screen>
        <Text style={styles.title}>
          {task ? 'La tarea ya tiene un evento' : 'Tarea no encontrada'}
        </Text>
        <AppButton
          title="Volver al detalle"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const disabled = busy || loading;
  return (
    <Screen>
      <Text style={styles.title}>Agregar al calendario</Text>
      <Text style={styles.label}>{task.title}</Text>
      <Text style={styles.hint}>
        Elegí cuándo realizar la tarea. El evento se creará al confirmar.
      </Text>
      {loading ? (
        <ActivityIndicator accessibilityLabel="Consultando calendarios" />
      ) : null}
      <FormMessage message={error} />
      {settingsAvailable ? (
        <AppButton
          title="Abrir ajustes de calendario"
          variant="secondary"
          onPress={openSettings}
          disabled={disabled}
        />
      ) : null}
      {!loading && calendars.length === 0 ? (
        <>
          {!error ? (
            <Text style={styles.hint}>
              No hay calendarios disponibles para agregar eventos. Configurá uno
              en la app Calendario del dispositivo y volvé a intentar.
            </Text>
          ) : null}
          <AppButton
            title="Reintentar calendarios"
            onPress={() => load(true)}
            disabled={disabled}
          />
        </>
      ) : null}
      {calendars.length > 0 ? (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Calendario</Text>
            {calendars.map(calendar => (
              <AppButton
                key={calendar.id}
                title={`${calendar.id === calendarId ? '✓ ' : ''}${
                  calendar.title
                }`}
                variant={calendar.id === calendarId ? 'primary' : 'secondary'}
                disabled={disabled}
                onPress={() => setCalendarId(calendar.id)}
              />
            ))}
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Inicio</Text>
            <Text style={styles.hint}>
              {formatReminderDate(start.toISOString())}
            </Text>
            <AppButton
              title="Elegir fecha del evento"
              variant="secondary"
              disabled={disabled}
              onPress={() => setPicker('date')}
            />
            <AppButton
              title="Elegir hora del evento"
              variant="secondary"
              disabled={disabled}
              onPress={() => setPicker('time')}
            />
            {picker && !disabled ? (
              <>
                <DateTimePicker
                  testID="calendar-date-picker"
                  value={start}
                  mode={picker}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={picker === 'date' ? new Date() : undefined}
                  is24Hour
                  onValueChange={(_event, date) => {
                    const next = new Date(start);
                    if (picker === 'date') {
                      next.setFullYear(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate(),
                      );
                    } else {
                      next.setHours(date.getHours(), date.getMinutes(), 0, 0);
                    }
                    setStart(next);
                    if (Platform.OS === 'android') {
                      setPicker(null);
                    }
                  }}
                  onDismiss={() => setPicker(null)}
                />
                {Platform.OS === 'ios' ? (
                  <AppButton
                    title="Listo"
                    variant="secondary"
                    onPress={() => setPicker(null)}
                  />
                ) : null}
              </>
            ) : null}
            <Text style={styles.label}>Duración</Text>
            {EVENT_DURATIONS.map(minutes => (
              <AppButton
                key={minutes}
                title={`${minutes} minutos`}
                variant={duration === minutes ? 'primary' : 'secondary'}
                disabled={disabled}
                onPress={() => setDuration(minutes)}
              />
            ))}
            <Text style={styles.hint}>
              Fin:{' '}
              {formatReminderDate(
                new Date(start.getTime() + duration * 60_000).toISOString(),
              )}
            </Text>
            <Text style={styles.hint}>
              Se usa la zona horaria del dispositivo.
            </Text>
          </View>
          <Text style={styles.hint}>
            Completar o eliminar la tarea no elimina el evento. Los cambios
            posteriores se hacen desde la app Calendario.
          </Text>
          <AppButton
            title={busy ? 'Creando evento…' : 'Crear evento'}
            disabled={disabled}
            onPress={submit}
          />
        </>
      ) : null}
      <AppButton
        title="Cancelar"
        variant="secondary"
        disabled={busy}
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}
