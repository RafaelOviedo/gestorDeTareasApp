import { useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { taskImageUri } from '../services/taskImages';
import { colors, styles } from '../styles';

type Props = { path: string; title: string; compact?: boolean };

function Preview({ path, title, compact }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <Text style={styles.hint}>
        No se pudo mostrar la foto. Podés reemplazarla desde el detalle.
      </Text>
    );
  }
  return (
    <Image
      source={{ uri: taskImageUri(path) }}
      accessibilityLabel={`Foto de la tarea: ${title}`}
      accessible
      resizeMode="contain"
      style={[imageStyles.image, compact && imageStyles.compact]}
      onError={() => setFailed(true)}
    />
  );
}

export default function TaskImage(props: Props) {
  return <Preview key={props.path} {...props} />;
}

const imageStyles = StyleSheet.create({
  image: {
    width: '100%',
    height: 240,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 16,
  },
  compact: { height: 120 },
});
