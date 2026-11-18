import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { PasswordVisibilityToggle } from '@/components/auth/password-visibility-toggle';
import { VaultScreen } from '@/components/vault/vault-screen';
import { VaultTextField } from '@/components/vault/vault-text-field';
import { useVault } from '@/contexts/vault-context';
import { generateVaultRecoveryKey } from '@/services/vault-initialization-service';
import { AuthColors } from '@/theme/auth-colors';

export default function VaultSetupScreen() {
  const router = useRouter();
  const { initialize, registerSensitiveCacheCleaner } = useVault();
  const [masterPassword, setMasterPassword] = useState('');
  const [masterConfirmation, setMasterConfirmation] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryConfirmation, setRecoveryConfirmation] = useState('');
  const [masterVisible, setMasterVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSensitiveValues = useCallback(() => {
    setMasterPassword('');
    setMasterConfirmation('');
    setRecoveryKey('');
    setRecoveryConfirmation('');
  }, []);

  useEffect(
    () => registerSensitiveCacheCleaner(clearSensitiveValues),
    [clearSensitiveValues, registerSensitiveCacheCleaner],
  );

  async function handleGenerateRecoveryKey() {
    setError(null);
    try {
      setRecoveryKey(await generateVaultRecoveryKey());
      setRecoveryConfirmation('');
    } catch {
      setError('A secure recovery key could not be generated. No vault was initialized.');
    }
  }

  async function handleInitialize() {
    if (isLoading) {
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await initialize({
        masterPassword,
        masterPasswordConfirmation: masterConfirmation,
        recoveryKey,
        recoveryKeyConfirmation: recoveryConfirmation,
      });
      setMasterPassword('');
      setMasterConfirmation('');
      setRecoveryKey('');
      setRecoveryConfirmation('');
      router.replace('/vault-setup-complete');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Vault setup failed. No data was changed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <VaultScreen
      title="Set Up Your Vault"
      subtitle="Create a separate Vault Master Password to protect your locally encrypted vault. It is never sent to Laravel and is different from your account password.">
      <VaultTextField
        label="Master Password"
        value={masterPassword}
        onChangeText={setMasterPassword}
        secureTextEntry={!masterVisible}
        autoCapitalize="none"
        textContentType="newPassword"
        placeholder="At least 14 characters"
        rightAccessory={
          <PasswordVisibilityToggle
            isVisible={masterVisible}
            onPress={() => setMasterVisible((value) => !value)}
          />
        }
      />
      <VaultTextField
        label="Confirm Master Password"
        value={masterConfirmation}
        onChangeText={setMasterConfirmation}
        secureTextEntry={!confirmationVisible}
        autoCapitalize="none"
        textContentType="newPassword"
        placeholder="Enter it again"
        rightAccessory={
          <PasswordVisibilityToggle
            accessibilityLabel={confirmationVisible
              ? 'Hide master password confirmation'
              : 'Show master password confirmation'}
            isVisible={confirmationVisible}
            onPress={() => setConfirmationVisible((value) => !value)}
          />
        }
      />
      <Text style={styles.passwordGuidance}>
        Use 14–4096 characters. A longer, unique passphrase is easier to remember and harder to
        guess.
      </Text>
      {!recoveryKey ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleGenerateRecoveryKey()}
          style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Generate recovery key</Text>
        </Pressable>
      ) : (
        <View style={styles.recoveryCard}>
          <Text style={styles.warningTitle}>Save this recovery key somewhere safe</Text>
          <Text style={styles.warningCopy}>
            It is the only way to recover this vault if you forget the master password. Lockr
            cannot restore it. Do not send it to anyone or store it with your account password.
          </Text>
          <Text selectable={false} style={styles.recoveryKey}>{recoveryKey}</Text>
          <VaultTextField
            label="Type the recovery key to confirm you saved it"
            value={recoveryConfirmation}
            onChangeText={setRecoveryConfirmation}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="none"
            placeholder="Enter the complete key"
          />
        </View>
      )}
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <AuthButton
        isLoading={isLoading}
        isDisabled={!recoveryKey || !recoveryConfirmation}
        label="Create encrypted vault"
        onPress={() => void handleInitialize()}
      />
      <Link href="/vault-onboarding" asChild>
        <Pressable accessibilityRole="link" style={styles.link}>
          <Text style={styles.linkText}>Back to vault options</Text>
        </Pressable>
      </Link>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.white,
  },
  secondaryButtonText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  passwordGuidance: {
    marginTop: -8,
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  recoveryCard: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3D28B',
    borderRadius: 14,
    backgroundColor: '#FFF9E9',
  },
  warningTitle: {
    color: AuthColors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  warningCopy: {
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  recoveryKey: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: AuthColors.white,
    color: AuthColors.navy,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 22,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
