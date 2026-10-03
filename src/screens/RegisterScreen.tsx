import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import FormField from '../components/FormField';
import Screen from '../components/Screen';
import { colors, styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen>
      <Text style={styles.title}>Tu espacio personal.</Text>
      <Text style={styles.subtitle}>
        Elegí un usuario y una contraseña para organizar tus tareas.
      </Text>
      <DemoNotice />
      <View style={styles.card}>
        <FormField
          label="Usuario"
          placeholder="Elegí un usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
        />
        <FormField
          label="Contraseña"
          placeholder="Elegí una contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
        />
        <AppButton title="Crear cuenta" disabled />
      </View>
      <Button
        title="Volver al login"
        onPress={() => navigation.goBack()}
        color={colors.primary}
      />
    </Screen>
  );
}
