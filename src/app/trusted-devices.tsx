import { useRouter } from 'expo-router';
import { CheckCircle2, Clock3, KeyRound, ShieldAlert } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { AuthColors } from '@/theme/auth-colors';

const REQUIRED_STATES = [
  ['This device identity', 'No device ID or public/private keypair has been provisioned'],
  ['New-device enrollment', 'No request ID or server-enforced expiration is available'],
  ['Existing-device approval', 'No approval inbox or confirmation challenge is connected'],
  ['Encrypted DEK transfer', 'No transfer occurs; a future relay must carry ciphertext only'],
  ['Enrolled-device revocation', 'No enrolled-device list or server revocation endpoint exists'],
] as const;

export default function TrustedDevicesScreen() {
  const router = useRouter();

  return (
    <VaultScreen
      title="Trusted devices"
      subtitle="This recovery method is not enabled. The manual recovery key remains available.">
      <View style={styles.statusCard}>
        <ShieldAlert color={AuthColors.warningText} size={22} />
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>No trusted devices enrolled</Text>
          <Text style={styles.copy}>
            No device keys were created or sent. Do not rely on device-to-device recovery yet.
          </Text>
        </View>
      </View>
      {REQUIRED_STATES.map(([title, detail], index) => (
        <View key={title} style={styles.row}>
          {index === 0 || index === 3 ? (
            <KeyRound color={AuthColors.secondaryText} size={18} />
          ) : index === 1 || index === 4 ? (
            <Clock3 color={AuthColors.secondaryText} size={18} />
          ) : (
            <CheckCircle2 color={AuthColors.secondaryText} size={18} />
          )}
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.copy}>{detail}</Text>
          </View>
          <Text style={styles.pending}>Not enabled</Text>
        </View>
      ))}
      <Text style={styles.notice}>
        Trusted-device recovery is blocked until Phase 2D defines the authenticated relay API and
        an independently reviewed standard key-wrapping implementation is available. The service
        must relay ciphertext only; no direct or plaintext DEK transfer is permitted.
      </Text>
      <AuthButton
        isLoading={false}
        label="Back to vault security"
        onPress={() => router.replace('/vault-settings')}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/vault')}
        style={styles.link}>
        <Text style={styles.linkText}>Return to vault</Text>
      </Pressable>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3D28B',
    borderRadius: 13,
    backgroundColor: '#FFF9E9',
  },
  statusCopy: {
    flex: 1,
    gap: 5,
  },
  statusTitle: {
    color: AuthColors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  copy: {
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: AuthColors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  pending: {
    color: AuthColors.warningText,
    fontSize: 10,
    fontWeight: '700',
  },
  notice: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: AuthColors.white,
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 20,
  },
  link: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
