import { ActivityIndicator, Text } from 'react-native';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import FormMessage from '../components/FormMessage';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import type { RootStackParamList } from '../types/navigation';
import { colors } from '../styles';

const Stack = createNativeStackNavigator<RootStackParamList>();
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootNavigator() {
  const { user, isRestoring, restoreError, retryRestore } = useAuth();

  if (isRestoring) {
    return (
      <Screen>
        <ActivityIndicator
          accessibilityLabel="Recuperando sesión"
          color={colors.primary}
        />
        <Text>Recuperando sesión…</Text>
      </Screen>
    );
  }
  if (restoreError) {
    return (
      <Screen>
        <FormMessage message={restoreError} />
        <AppButton title="Reintentar sesión" onPress={retryRestore} />
      </Screen>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {user ? (
          <Stack.Group navigationKey={user.id}>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Mis tareas' }}
            />
            <Stack.Screen
              name="CreateTask"
              component={CreateTaskScreen}
              options={{ title: 'Crear tarea' }}
            />
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey="guest">
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ title: 'Gestor de Tareas' }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Registro' }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
