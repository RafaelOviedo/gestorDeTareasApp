import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import AppButton from '../components/AppButton';
import DemoNotice from '../components/DemoNotice';
import Screen from '../components/Screen';
import { styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'> & {
  onExitDemo: () => void;
};

export default function HomeScreen({ navigation, onExitDemo }: Props) {
  return (
    <Screen>
      <Text style={styles.title}>Un pendiente a la vez.</Text>
      <Text style={styles.subtitle}>
        Este será el lugar para consultar y organizar tus tareas.
      </Text>
      <DemoNotice />
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
      <AppButton
        title="Salir de la demo"
        variant="secondary"
        onPress={onExitDemo}
      />
    </Screen>
  );
}
