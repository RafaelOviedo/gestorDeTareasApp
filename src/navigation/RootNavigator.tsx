import { useState } from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
  // Acceso temporal para revisar las pantallas. No representa una sesión autenticada.
  // En el punto 4 se reemplazará por el estado de AuthContext.
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        {isDemoOpen ? (
          <Stack.Group navigationKey="demo">
            <Stack.Screen name="Home" options={{ title: 'Mis tareas' }}>
              {props => (
                <HomeScreen
                  {...props}
                  onExitDemo={() => setIsDemoOpen(false)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="CreateTask"
              component={CreateTaskScreen}
              options={{ title: 'Crear tarea' }}
            />
          </Stack.Group>
        ) : (
          <Stack.Group navigationKey="guest">
            <Stack.Screen name="Login" options={{ title: 'Gestor de Tareas' }}>
              {props => (
                <LoginScreen
                  {...props}
                  onEnterDemo={() => setIsDemoOpen(true)}
                />
              )}
            </Stack.Screen>
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
