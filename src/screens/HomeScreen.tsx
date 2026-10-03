import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import AppButton from '../components/AppButton';
import TasksPreviewNotice from '../components/TasksPreviewNotice';
import Screen from '../components/Screen';
import { styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <Text style={styles.title}>Hola, {user?.username}.</Text>
      <Text style={styles.subtitle}>
        Un pendiente a la vez. Este es tu espacio personal.
      </Text>
      <TasksPreviewNotice />
      <View style={styles.card}>
        <Text style={styles.emptyTitle}>Todavía no hay tareas</Text>
        <Text style={styles.subtitle}>
          Explorá el formulario para crear tu primer pendiente.
        </Text>
        <AppButton
          title="Crear tarea"
          onPress={() => navigation.navigate('CreateTask')}
        />
      </View>
      <AppButton title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
