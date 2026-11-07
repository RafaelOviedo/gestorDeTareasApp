import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppButton from './AppButton';
import { colors, styles } from '../styles';

type Props = {
  mode: 'date' | 'time';
  value: Date;
  onChange: (value: Date) => void;
  onClose: () => void;
};

export default function EventDateTimePicker({
  mode,
  value,
  onChange,
  onClose,
}: Props) {
  const isIOS = Platform.OS === 'ios';
  const picker = (
    <DateTimePicker
      key={mode}
      testID="calendar-date-picker"
      value={value}
      mode={mode}
      display={isIOS ? 'spinner' : 'default'}
      minimumDate={mode === 'date' ? new Date() : undefined}
      {...(isIOS
        ? { themeVariant: 'light' as const, textColor: colors.text }
        : { is24Hour: true })}
      onValueChange={(_event, date) => {
        const next = new Date(value);
        if (mode === 'date') {
          next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        } else {
          next.setHours(date.getHours(), date.getMinutes(), 0, 0);
        }
        onChange(next);
        if (!isIOS) {
          onClose();
        }
      }}
      onDismiss={onClose}
    />
  );

  if (!isIOS) {
    return picker;
  }

  // El selector nativo calcula su propio tamaño. No limitarlo al ancho de la
  // tarjeta: el panel y el scroll permiten mostrarlo también en pantallas pequeñas.
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={localStyles.panel}>
        <ScrollView contentContainerStyle={localStyles.content}>
          <View style={localStyles.controls}>
            <Text accessibilityRole="header" style={styles.title}>
              {mode === 'date' ? 'Fecha del evento' : 'Hora del evento'}
            </Text>
          </View>
          <ScrollView horizontal contentContainerStyle={localStyles.picker}>
            {picker}
          </ScrollView>
          <View style={localStyles.controls}>
            <AppButton title="Listo" onPress={onClose} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24 },
  controls: { paddingHorizontal: 24 },
  picker: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
});
