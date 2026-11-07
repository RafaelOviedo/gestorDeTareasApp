import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { Task } from '../types/task';
import { useTasksStore } from '../stores/useTasksStore';
import AppButton from './AppButton';
import FormMessage from './FormMessage';
import { styles } from '../styles';

export default function TaskContactEditor({
  task,
  onChoose,
}: {
  task: Task;
  onChoose: () => void;
}) {
  const removeContact = useTasksStore(state => state.removeContact);
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function remove() {
    if (!mounted.current) {
      return;
    }
    setError(null);
    try {
      await removeContact(task.id);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'No se pudo quitar el contacto. Intentá nuevamente.',
        );
      }
    }
  }

  function confirmRemove() {
    Alert.alert(
      'Quitar contacto',
      '¿Querés quitar el contacto asociado a esta tarea?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            remove();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Contacto relacionado</Text>
      {task.contact ? (
        <>
          <Text style={styles.label}>{task.contact.name}</Text>
          <Text selectable style={styles.hint}>
            {task.contact.phone
              ? `Teléfono: ${task.contact.phone}`
              : 'Sin teléfono'}
          </Text>
          {task.contact.email ? (
            <Text selectable style={styles.hint}>
              Correo: {task.contact.email}
            </Text>
          ) : null}
          <Text style={styles.hint}>
            Datos guardados al seleccionar el contacto.
          </Text>
        </>
      ) : (
        <Text style={styles.hint}>
          Asociá a la persona responsable o relacionada con esta tarea.
        </Text>
      )}
      <FormMessage message={error} />
      <AppButton
        title={task.contact ? 'Cambiar contacto' : 'Elegir contacto'}
        disabled={busy}
        onPress={() => {
          setError(null);
          onChoose();
        }}
      />
      {task.contact ? (
        <AppButton
          title="Quitar contacto"
          variant="secondary"
          disabled={busy}
          onPress={confirmRemove}
        />
      ) : null}
    </View>
  );
}
