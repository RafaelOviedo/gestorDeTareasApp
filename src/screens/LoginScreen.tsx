import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import AppButton from '../components/AppButton';
import FormField from '../components/FormField';
import FormMessage from '../components/FormMessage';
import Screen from '../components/Screen';
import { styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation, route }: Props) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (route.params?.registeredUsername) {
      setUsername(route.params.registeredUsername);
      setPassword('');
      setError(null);
      setSuccess('Cuenta creada. Iniciá sesión con tu contraseña.');
      navigation.setParams({ registeredUsername: undefined });
    }
  }, [navigation, route.params?.registeredUsername]);

  async function handleSignIn() {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await signIn(username, password);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo iniciar sesión. Intentá nuevamente.',
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Todo en un lugar.</Text>
      <Text style={styles.subtitle}>
        Iniciá sesión para acceder a tus pendientes.
      </Text>
      <View style={styles.card}>
        <FormMessage message={success} variant="success" />
        <FormField
          label="Usuario"
          placeholder="Tu usuario"
          value={username}
          onChangeText={setUsername}
          editable={!isSubmitting}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
        />
        <FormField
          label="Contraseña"
          placeholder="Tu contraseña"
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />
        <FormMessage message={error} />
        <AppButton
          title={isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
          onPress={handleSignIn}
          disabled={isSubmitting}
        />
        <AppButton
          title="Ir al registro"
          variant="secondary"
          onPress={() => navigation.navigate('Register')}
          disabled={isSubmitting}
        />
      </View>
    </Screen>
  );
}
