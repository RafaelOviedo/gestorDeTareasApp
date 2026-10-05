import { StyleSheet, Text, View } from "react-native";
import { colors } from "../styles";

export default function ReminderNotice() {
  return (
    <View style={styles.notice}>
      <Text style={styles.title}>Recordatorios locales</Text>
      <Text style={styles.text}>
        Al guardar con recordatorio, te pediremos permiso para enviar notificaciones.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    padding: 16,
    backgroundColor: colors.soft,
    borderRadius: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 4,
  },
  text: { fontSize: 14, lineHeight: 20, color: colors.text },
});
