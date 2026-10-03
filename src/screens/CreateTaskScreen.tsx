import { useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import FormField from '../components/FormField';
import Screen from '../components/Screen';
import { colors, styles } from '../styles';

const reminderOptions = [
  { label: 'Sin recordatorio', seconds: 0 },
  { label: '30 segundos', seconds: 30 },
  { label: '1 minuto', seconds: 60 },
  { label: '5 minutos', seconds: 300 },
];

type Props = NativeStackScreenProps<RootStackParamList, 'CreateTask'>;

export default function CreateTaskScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [reminderSeconds, setReminderSeconds] = useState(0);

  return (
    <Screen>
      <Text style={styles.title}>¿Qué tenés pendiente?</Text>
      <Text style={styles.subtitle}>
        Dale un título a tu tarea y elegí cuándo querés recordarla.
      </Text>
      <DemoNotice />
      <View style={styles.card}>
        <FormField
          label="Título de la tarea"
          placeholder="Por ejemplo: repasar para el parcial"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
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
              }}
              onPress={() => setReminderSeconds(option.seconds)}
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
          En esta vista previa no se programan notificaciones.
        </Text>
        <AppButton title="Guardar tarea" disabled />
      </View>
      <Button
        title="Cancelar"
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
