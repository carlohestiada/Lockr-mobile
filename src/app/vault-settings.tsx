import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { VaultTextField } from '@/components/vault/vault-text-field';
import { useVault } from '@/contexts/vault-context';
import type { PreparedRecoveryKeyRotation } from '@/services/vault-recovery-service';
import { AuthColors } from '@/theme/auth-colors';

const LOCK_OPTIONS = [1, 5, 15, 30] as const;

export default function VaultSettingsScreen() {
  const router = useRouter();
  const {
    changeMasterPassword,
    confirmRecoveryRotation,
    lock,
    lockTimeoutMinutes,
    metadata,
    prepareRecoveryRotation,
    registerSensitiveCacheCleaner,
    setLockTimeout,
  } = useVault();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [preparedRotation, setPreparedRotation] = useState<PreparedRecoveryKeyRotation | null>(null);
  const [rotationConfirmation, setRotationConfirmation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearSensitiveValues = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setPasswordConfirmation('');
    setRotationConfirmation('');
    setPreparedRotation(null);
  }, []);

  useEffect(
    () => registerSensitiveCacheCleaner(clearSensitiveValues),
    [clearSensitiveValues, registerSensitiveCacheCleaner],
  );

  async function handlePasswordChange() {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      await changeMasterPassword(currentPassword, newPassword, passwordConfirmation);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordConfirmation('');
      setNotice('Master password changed. Credentials were not re-encrypted.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The master password could not be changed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePrepareRotation() {
    setError(null);
    setNotice(null);
    try {
      setPreparedRotation(await prepareRecoveryRotation());
      setRotationConfirmation('');
    } catch {
      setError('A new recovery key could not be prepared. The current key remains active.');
    }
  }

  async function handleConfirmRotation() {
    if (!preparedRotation) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      await confirmRecoveryRotation(preparedRotation, rotationConfirmation);
      setPreparedRotation(null);
      setRotationConfirmation('');
      setNotice('Recovery key rotated. The previous recovery key no longer unlocks this vault.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Recovery-key rotation failed. The previous key remains active.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLock() {
    await lock();
    router.replace('/vault-unlock');
  }

  return (
    <VaultScreen
      title="Vault security"
      subtitle="Manage local lock behavior and the keys that protect this vault.">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Automatic lock</Text>
        <Text style={styles.copy}>The vault locks immediately when the app leaves the foreground.</Text>
        <View style={styles.options}>
          {LOCK_OPTIONS.map((minutes) => (
            <Pressable
              key={minutes}
              accessibilityRole="radio"
              accessibilityState={{ selected: lockTimeoutMinutes === minutes }}
              onPress={() => {
                void setLockTimeout(minutes).catch(() =>
                  setError('The auto-lock setting could not be saved.'),
                );
              }}
              style={[
                styles.option,
                lockTimeoutMinutes === minutes && styles.optionSelected,
              ]}>
              <Text style={[
                styles.optionText,
                lockTimeoutMinutes === minutes && styles.optionTextSelected,
              ]}>
                {minutes} min
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change master password</Text>
        <Text style={styles.copy}>The same data-encryption key is re-wrapped; stored records are not re-encrypted.</Text>
        <VaultTextField
          label="Current master password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
        />
        <VaultTextField
          label="New master password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          placeholder="At least 14 characters"
        />
        <VaultTextField
          label="Confirm new master password"
          value={passwordConfirmation}
          onChangeText={setPasswordConfirmation}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <AuthButton
          isLoading={isLoading}
          isDisabled={!currentPassword || !newPassword || !passwordConfirmation}
          label="Change master password"
          onPress={() => void handlePasswordChange()}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual recovery key</Text>
        <Text style={styles.copy}>
          {metadata?.recovery?.enabled
            ? 'A recovery key is configured. Keep it separate from this device.'
            : 'No manual recovery key is configured.'}
        </Text>
        {!preparedRotation ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void handlePrepareRotation()}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Rotate recovery key</Text>
          </Pressable>
        ) : (
          <View style={styles.rotationCard}>
            <Text style={styles.warning}>
              Save this new key securely. It will replace the previous key after confirmation.
            </Text>
            <Text selectable={false} style={styles.keyText}>{preparedRotation.recoveryKey}</Text>
            <VaultTextField
              label="Type the new recovery key to confirm"
              value={rotationConfirmation}
              onChangeText={setRotationConfirmation}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="none"
            />
            <AuthButton
              isLoading={isLoading}
              isDisabled={!rotationConfirmation}
              label="Confirm recovery-key rotation"
              onPress={() => void handleConfirmRotation()}
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trusted devices</Text>
        <Text style={styles.copy}>
          Trusted-device recovery requires the reviewed API and relay protocol planned for Phase 2D.
        </Text>
        <Link href="/trusted-devices" asChild>
          <Pressable accessibilityRole="link" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>View trusted-device status</Text>
          </Pressable>
        </Link>
      </View>

      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      <AuthButton isLoading={false} label="Lock vault now" onPress={() => void handleLock()} />
      <SignOutButton />
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  sectionTitle: {
    color: AuthColors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  copy: {
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  options: {
    flexDirection: 'row',
    gap: 7,
  },
  option: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 10,
  },
  optionSelected: {
    borderColor: AuthColors.accent,
    backgroundColor: '#EFF6FF',
  },
  optionText: {
    color: AuthColors.secondaryText,
    fontSize: 12,
  },
  optionTextSelected: {
    color: AuthColors.accent,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 11,
  },
  secondaryButtonText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  rotationCard: {
    gap: 12,
  },
  warning: {
    color: AuthColors.warningText,
    fontSize: 13,
    lineHeight: 19,
  },
  keyText: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#F4F7FB',
    color: AuthColors.navy,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
  },
  notice: {
    color: AuthColors.accent,
    fontSize: 13,
    lineHeight: 19,
  },
});
