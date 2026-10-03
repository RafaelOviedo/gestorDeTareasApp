import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  text: '#19243B',
  muted: '#596579',
  primary: '#5145CD',
  border: '#D5DAE5',
  soft: '#EEECFF',
};

export const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  hint: { fontSize: 14, lineHeight: 21, color: colors.muted, marginBottom: 16 },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
});
