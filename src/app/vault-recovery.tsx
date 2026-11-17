import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { VaultTextField } from '@/components/vault/vault-text-field';
import { useVault } from '@/contexts/vault-context';
import { AuthColors } from '@/theme/auth-colors';

export default function VaultRecoveryScreen() {
  const router = useRouter();
  const { recoverAndReplaceMasterPassword, registerSensitiveCacheCleaner } = useVault();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSensitiveValues = useCallback(() => {
    setRecoveryKey('');
    setNewPassword('');
    setConfirmation('');
  }, []);
  useEffect(
    () => registerSensitiveCacheCleaner(clearSensitiveValues),
    [clearSensitiveValues, registerSensitiveCacheCleaner],
  );

  async function handleRecovery() {
    if (isLoading) {
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await recoverAndReplaceMasterPassword(recoveryKey.trim(), newPassword, confirmation);
      setRecoveryKey('');
      setNewPassword('');
      setConfirmation('');
      router.replace('/vault');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vault recovery failed. No data was changed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <VaultScreen
      title="Recover your vault"
      subtitle="Use the recovery key saved during setup. Then choose a new master password.">
      <VaultTextField
        label="Recovery key"
        value={recoveryKey}
        onChangeText={setRecoveryKey}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="none"
        placeholder="Enter your complete recovery key"
      />
      <VaultTextField
        label="New vault master password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        placeholder="At least 14 characters"
      />
      <VaultTextField
        label="Confirm new master password"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        placeholder="Enter it again"
      />
      <Text style={styles.notice}>
        Recovery only works with the manual key. Lockr and the Laravel account service cannot
        reconstruct a lost recovery key.
      </Text>
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <AuthButton
        isLoading={isLoading}
        isDisabled={!recoveryKey || !newPassword || !confirmation}
        label="Recover and replace password"
        onPress={() => void handleRecovery()}
      />
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
  },
});
