import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { TaskContact } from '../types/task';
import { useAuth } from '../context/AuthContext';
import { useTasksStore } from '../stores/useTasksStore';
import { ContactsError, listDeviceContacts } from '../services/taskContacts';
import { openDeviceSettings } from '../services/devicePermissions';
import { matchesContact } from '../utils/contacts';
import AppButton from '../components/AppButton';
import FormField from '../components/FormField';
import FormMessage from '../components/FormMessage';
import Screen from '../components/Screen';
import { colors, styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectContact'>;

export default function SelectContactScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const taskId = route.params.taskId;
  const taskExists = useTasksStore(state =>
    state.tasks.some(task => task.id === taskId && task.userId === user?.id),
  );
  const attachContact = useTasksStore(state => state.attachContact);
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const [contacts, setContacts] = useState<TaskContact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const mounted = useRef(false);
  const fetching = useRef(false);
  const selecting = useRef(false);

  const load = useCallback(
    async (requestAccess = true) => {
      if (!taskExists || fetching.current || selecting.current) {
        return;
      }
      fetching.current = true;
      setLoading(true);
      setContacts([]);
      setError(null);
      setSettingsAvailable(false);
      setLimited(false);
      try {
        const result = await listDeviceContacts(requestAccess);
        if (mounted.current) {
          setContacts(result.contacts);
          setLimited(result.limited);
        }
      } catch (cause) {
        if (mounted.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudieron leer los contactos.',
          );
          setSettingsAvailable(
            cause instanceof ContactsError && cause.settingsAvailable,
          );
        }
      } finally {
        fetching.current = false;
        if (mounted.current) {
          setLoading(false);
        }
      }
    },
    [taskExists],
  );

  useEffect(() => {
    mounted.current = true;
    load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        load(false);
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [load]);

  async function select(contact: TaskContact) {
    if (fetching.current || selecting.current || !mounted.current) {
      return;
    }
    selecting.current = true;
    setError(null);
    setSettingsAvailable(false);
    try {
      const saved = await attachContact(taskId, contact.recordId);
      if (saved && mounted.current) {
        navigation.goBack();
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo asociar el contacto.',
        );
        setSettingsAvailable(
          cause instanceof ContactsError && cause.settingsAvailable,
        );
        if (cause instanceof ContactsError) {
          setContacts([]);
        }
      }
    } finally {
      selecting.current = false;
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

  if (!taskExists) {
    return (
      <Screen>
        <Text style={styles.title}>Tarea no encontrada</Text>
        <AppButton
          title="Volver al detalle"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const filtered = contacts.filter(contact => matchesContact(contact, query));
  return (
    <SafeAreaView
      style={localStyles.screen}
      edges={['left', 'right', 'bottom']}
    >
      <FlatList
        data={filtered}
        keyExtractor={contact => contact.recordId}
        contentContainerStyle={localStyles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Elegí una persona</Text>
            <Text style={styles.hint}>
              Tocá un contacto para asociarlo a la tarea.
            </Text>
            <FormField
              label="Buscar contacto"
              placeholder="Nombre, teléfono o correo"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {limited ? (
              <Text style={styles.hint}>
                Acceso limitado: se muestran solo los contactos que autorizaste.
              </Text>
            ) : null}
            <FormMessage message={error} />
            {settingsAvailable || limited ? (
              <AppButton
                title="Abrir ajustes de contactos"
                variant="secondary"
                disabled={busy || loading}
                onPress={settings}
              />
            ) : null}
            <AppButton
              title={loading ? 'Cargando contactos…' : 'Actualizar contactos'}
              variant="secondary"
              disabled={busy || loading}
              onPress={() => {
                load();
              }}
            />
            {busy ? (
              <Text accessibilityLiveRegion="polite" style={styles.hint}>
                Guardando contacto…
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Seleccionar contacto: ${item.name}${
              item.phone
                ? `, ${item.phone}`
                : item.email
                ? `, ${item.email}`
                : ''
            }`}
            accessibilityState={{ disabled: busy || loading }}
            disabled={busy || loading}
            style={[styles.card, (busy || loading) && localStyles.disabled]}
            onPress={() => {
              select(item);
            }}
          >
            <Text style={styles.label}>{item.name}</Text>
            <Text style={styles.hint}>{item.phone ?? 'Sin teléfono'}</Text>
            {item.email ? <Text style={styles.hint}>{item.email}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              accessibilityLabel="Cargando agenda"
              color={colors.primary}
            />
          ) : !error ? (
            <Text style={styles.hint}>
              {contacts.length
                ? 'No se encontraron contactos con esa búsqueda.'
                : limited
                ? 'No hay contactos autorizados. Podés elegirlos desde Ajustes.'
                : 'No hay contactos disponibles. Agregá uno en la agenda del dispositivo y actualizá la lista.'}
            </Text>
          ) : null
        }
        ListFooterComponent={
          <AppButton
            title="Cancelar selección"
            variant="secondary"
            disabled={busy}
            onPress={() => navigation.goBack()}
          />
        }
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    padding: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  disabled: { opacity: 0.5 },
});
