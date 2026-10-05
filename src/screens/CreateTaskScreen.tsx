import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import AppButton from '../components/AppButton';
import ReminderPermissionHelp from '../components/ReminderPermissionHelp';
import { ReminderPermissionError } from '../services/notifications';
import ReminderNotice from '../components/ReminderNotice';
import FormMessage from '../components/FormMessage';
import { useAuth } from '../context/AuthContext';
import { addTask } from '../services/tasks';
import { MAX_TASK_TITLE_LENGTH, reminderOptions } from '../utils/tasks';
import FormField from '../components/FormField';
import Screen from '../components/Screen';
import { colors, styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTask'>;

export default function CreateTaskScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [reminderSeconds, setReminderSeconds] = useState(0);

  const [permissionError, setPermissionError] =
    useState<ReminderPermissionError | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);

  async function handleSave() {
    if (saving.current) {
      return;
    }
    if (!user) {
      setError('Iniciá sesión para guardar una tarea.');
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setError(null);
    setPermissionError(null);
    try {
      await addTask(user.id, { title, reminderSeconds });
      if (navigation.isFocused()) {
        navigation.goBack();
      }
    } catch (cause) {
      setPermissionError(
        cause instanceof ReminderPermissionError ? cause : null,
      );
      setError(
        cause instanceof Error ? cause.message : 'No se pudo guardar la tarea.',
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>¿Qué tenés pendiente?</Text>
      <Text style={styles.subtitle}>
        Dale un título a tu tarea y elegí cuándo querés recordarla.
      </Text>
      <ReminderNotice />
      <View style={styles.card}>
        <FormField
          label="Título de la tarea"
          placeholder="Por ejemplo: repasar para el parcial"
          value={title}
          onChangeText={setTitle}
          maxLength={MAX_TASK_TITLE_LENGTH}
          editable={!isSaving}
          autoCapitalize="sentences"
        />
        <Text style={styles.label}>Recordatorio</Text>
        <View style={localStyles.options}>
          {reminderOptions.map(option => (
            <TouchableOpacity
              key={option.seconds}
              accessibilityRole="radio"
              accessibilityState={{
                checked: reminderSeconds === option.seconds,
                disabled: isSaving,
              }}
              onPress={() => setReminderSeconds(option.seconds)}
              disabled={isSaving}
              style={[
                localStyles.option,
                reminderSeconds === option.seconds && localStyles.selected,
              ]}
            >
              <Text
                style={[
                  localStyles.optionText,
                  reminderSeconds === option.seconds &&
                    localStyles.selectedText,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          El plazo comienza después de aceptar los permisos y guardar la tarea.
        </Text>
        <FormMessage message={error} />
        <ReminderPermissionHelp error={permissionError} disabled={isSaving} />
        <AppButton
          title={isSaving ? 'Guardando…' : 'Guardar tarea'}
          onPress={handleSave}
          disabled={isSaving}
        />
      </View>
      <Button
        title="Cancelar"
        disabled={isSaving}
        onPress={() => navigation.goBack()}
        color={colors.primary}
      />
    </Screen>
  );
}

const localStyles = StyleSheet.create({
  options: { gap: 10, marginBottom: 16 },
  option: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.soft },
  optionText: { color: colors.text, fontSize: 15 },
  selectedText: { color: colors.primary, fontWeight: '600' },
});
