import { StyleSheet, Text } from 'react-native';

type Props = {
  message: string | null;
  variant?: 'error' | 'success';
};

export default function FormMessage({ message, variant = 'error' }: Props) {
  if (!message) {
    return null;
  }
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.message, styles[variant]]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  error: { color: '#B42318' },
  success: { color: '#17613C' },
});
