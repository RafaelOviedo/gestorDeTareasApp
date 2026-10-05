import { useState } from 'react';
import { View } from 'react-native';
import AppButton from './AppButton';
import FormMessage from './FormMessage';
import {
  openReminderSettings,
  ReminderPermissionError,
} from '../services/notifications';

type Props = { error: ReminderPermissionError | null; disabled?: boolean };

export default function ReminderPermissionHelp({
  error,
  disabled = false,
}: Props) {
  const [opening, setOpening] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  if (!error) {
    return null;
  }
  async function openSettings() {
    if (!error || opening) {
      return;
    }
    setOpening(true);
    setSettingsError(null);
    try {
      await openReminderSettings(error.settingsTarget);
    } catch {
      setSettingsError(
        'No se pudieron abrir los ajustes. Abrilos desde la configuración del dispositivo.',
      );
    } finally {
      setOpening(false);
    }
  }
  return (
    <View>
      <AppButton
        title={
          error.settingsTarget === 'alarms'
            ? 'Permitir alarmas y recordatorios'
            : 'Abrir ajustes de notificaciones'
        }
        onPress={openSettings}
        variant="secondary"
        disabled={disabled || opening}
      />
      <FormMessage message={settingsError} />
    </View>
  );
}
