import { Link, useRouter } from 'expo-router';
import { LockKeyhole } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { VaultTextField } from '@/components/vault/vault-text-field';
import { useVault } from '@/contexts/vault-context';
import { AuthColors } from '@/theme/auth-colors';

export default function VaultUnlockScreen() {
  const router = useRouter();
  const { registerSensitiveCacheCleaner, status, unlock, error: vaultError } = useVault();
  const [masterPassword, setMasterPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSensitiveValues = useCallback(() => setMasterPassword(''), []);
  useEffect(
    () => registerSensitiveCacheCleaner(clearSensitiveValues),
    [clearSensitiveValues, registerSensitiveCacheCleaner],
  );

  async function handleUnlock() {
    if (isLoading) {
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await unlock(masterPassword);
      setMasterPassword('');
      router.replace('/vault');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The vault could not be unlocked.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <VaultScreen
      title="Vault locked"
      subtitle="Unlocking is performed locally and works without an account connection.">
      <View style={styles.statusCard}>
        <LockKeyhole color={AuthColors.accent} size={22} />
        <Text style={styles.statusText}>Protected operations are unavailable until unlock succeeds.</Text>
      </View>
      <VaultTextField
        label="Vault master password"
        value={masterPassword}
        onChangeText={setMasterPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        onSubmitEditing={() => void handleUnlock()}
        returnKeyType="done"
        placeholder="Enter your vault master password"
      />
      {(vaultError || error) && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>{vaultError || error}</Text>
      )}
      <AuthButton
        isLoading={isLoading}
        isDisabled={status !== 'locked' || !masterPassword}
        label="Unlock vault"
        onPress={() => void handleUnlock()}
      />
      <Link href="/vault-recovery" asChild>
        <Pressable accessibilityRole="link" style={styles.link}>
          <Text style={styles.linkText}>Forgot your vault master password?</Text>
        </Pressable>
      </Link>
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" style={styles.link}>
          <Text style={styles.secondaryLink}>Back to account sign in</Text>
        </Pressable>
      </Link>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 13,
    backgroundColor: AuthColors.white,
  },
  statusText: {
    flex: 1,
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
  },
  link: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  linkText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryLink: {
    color: AuthColors.secondaryText,
    fontSize: 13,
  },
});
