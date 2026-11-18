import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { AuthColors } from '@/theme/auth-colors';

export default function VaultSetupCompleteScreen() {
  const router = useRouter();

  return (
    <VaultScreen
      title="Your vault is ready"
      subtitle="Your local encrypted vault was created successfully. Your account password remains separate.">
      <View style={styles.confirmation}>
        <CheckCircle2 color={AuthColors.success} size={30} />
        <Text style={styles.confirmationText}>
          Your encrypted vault is unlocked and ready to use on this device.
        </Text>
      </View>
      <AuthButton
        isLoading={false}
        label="Open My Vault"
        onPress={() => router.replace('/vault')}
      />
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
  },
  confirmationText: {
    flex: 1,
    color: AuthColors.navy,
    fontSize: 14,
    lineHeight: 20,
  },
});
