import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { Task } from '../types/task';
import { useTasksStore } from '../stores/useTasksStore';
import { ImagePermissionError, type ImageSource } from '../services/taskImages';
import { openDeviceSettings } from '../services/devicePermissions';
import AppButton from './AppButton';
import FormMessage from './FormMessage';
import TaskImage from './TaskImage';
import { styles } from '../styles';

export default function TaskPhotoEditor({ task }: { task: Task }) {
  const attachImage = useTasksStore(state => state.attachImage);
  const removeImage = useTasksStore(state => state.removeImage);
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const [error, setError] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function updateImage(source: ImageSource | null) {
    setError(null);
    setSettingsAvailable(false);
    try {
      if (source) {
        await attachImage(task.id, source);
      } else {
        await removeImage(task.id);
      }
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo actualizar la foto. Intentá nuevamente.',
        );
        setSettingsAvailable(
          cause instanceof ImagePermissionError &&
            cause.status !== 'unavailable',
        );
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
    Alert.alert('Quitar foto', '¿Querés quitar la foto de esta tarea?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          updateImage(null);
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Foto adjunta</Text>
      {task.imagePath ? (
        <TaskImage path={task.imagePath} title={task.title} />
      ) : (
        <Text style={styles.hint}>Esta tarea todavía no tiene una foto.</Text>
      )}
      <Text style={styles.hint}>
        {task.imagePath
          ? 'La nueva foto reemplazará la actual al guardarse.'
          : 'Tomá una foto o elegí una de la galería. Se guarda automáticamente en esta tarea.'}
      </Text>
      <FormMessage message={error} />
      {busy ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          Procesando…
        </Text>
      ) : null}
      <AppButton
        title="Tomar foto"
        disabled={busy}
        onPress={() => {
          updateImage('camera');
        }}
      />
      <AppButton
        title="Elegir de galería"
        variant="secondary"
        disabled={busy}
        onPress={() => {
          updateImage('gallery');
        }}
      />
      {task.imagePath ? (
        <AppButton
          title="Quitar foto"
          variant="secondary"
          disabled={busy}
          onPress={confirmRemove}
        />
      ) : null}
      {settingsAvailable ? (
        <AppButton
          title="Abrir ajustes para fotos"
          variant="secondary"
          disabled={busy}
          onPress={settings}
        />
      ) : null}
    </View>
  );
}
