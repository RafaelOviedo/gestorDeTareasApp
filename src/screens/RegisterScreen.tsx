import { useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { registerUser } from '../services/auth';
import AppButton from '../components/AppButton';
import FormField from '../components/FormField';
import FormMessage from '../components/FormMessage';
import Screen from '../components/Screen';
import { colors, styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  async function handleRegister() {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const user = await registerUser(username, password);
      if (navigation.isFocused()) {
        navigation.popTo('Login', { registeredUsername: user.username });
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo crear la cuenta. Intentá nuevamente.',
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Tu espacio personal.</Text>
      <Text style={styles.subtitle}>
        Elegí un usuario y una contraseña. Tu cuenta se guardará en este
        dispositivo.
      </Text>
      <View style={styles.card}>
        <FormField
          label="Usuario"
          placeholder="Elegí un usuario"
          value={username}
          onChangeText={setUsername}
          editable={!isSubmitting}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
        />
        <FormField
          label="Contraseña"
          placeholder="Elegí una contraseña"
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />
        <FormMessage message={error} />
        <AppButton
          title={isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          onPress={handleRegister}
          disabled={isSubmitting}
        />
      </View>
      <Button
        title="Volver al login"
        onPress={() => navigation.goBack()}
        color={colors.primary}
        disabled={isSubmitting}
      />
    </Screen>
  );
}
