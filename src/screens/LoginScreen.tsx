import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import FormField from '../components/FormField';
import Screen from '../components/Screen';
import { styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'> & {
  onEnterDemo: () => void;
};

export default function LoginScreen({ navigation, onEnterDemo }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen>
      <Text style={styles.title}>Todo en un lugar.</Text>
      <Text style={styles.subtitle}>
        Organizá tus pendientes y hacé espacio para lo importante.
      </Text>
      <DemoNotice />
      <View style={styles.card}>
        <FormField
          label="Usuario"
          placeholder="Tu usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
        />
        <FormField
          label="Contraseña"
          placeholder="Tu contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
        />
        <AppButton title="Iniciar sesión" disabled />
        <AppButton
          title="Ir al registro"
          variant="secondary"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
      <AppButton title="Explorar demo" onPress={onEnterDemo} />
    </Screen>
  );
}
