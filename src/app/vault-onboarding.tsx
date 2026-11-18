import { useRouter } from 'expo-router';
import { LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthInitializingScreen } from '@/components/auth/auth-initializing-screen';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { useVault } from '@/contexts/vault-context';
import { getAuthenticatedVaultRoute } from '@/services/vault-navigation';
import { AuthColors } from '@/theme/auth-colors';

export default function VaultOnboardingScreen() {
  const router = useRouter();
  const vault = useVault();
  const vaultRoute = getAuthenticatedVaultRoute(vault.status);

  useEffect(() => {
    if (vaultRoute && vaultRoute !== '/vault-onboarding') {
      router.replace(vaultRoute);
    }
  }, [router, vaultRoute]);

  if (vault.status === 'loading' || (vaultRoute && vaultRoute !== '/vault-onboarding')) {
    return <AuthInitializingScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <ShieldCheck color={AuthColors.white} size={28} strokeWidth={2.2} />
          </View>
          <Text style={styles.brandName}>Lockr</Text>
        </View>

        <View style={styles.heading}>
          <Text style={styles.title}>Your account is ready</Text>
          <Text style={styles.subtitle}>
            Your account password protects sign-in. Your Vault Master Password separately
            protects the encrypted vault stored on this device.
          </Text>
        </View>

        <View style={styles.choiceCard}>
          <LockKeyhole color={AuthColors.accent} size={22} />
          <View style={styles.choiceCopy}>
            <Text style={styles.choiceTitle}>Set up your local vault</Text>
            <Text style={styles.choiceDescription}>
              Create a separate Vault Master Password. It encrypts your vault locally and is
              never sent to Laravel.
            </Text>
          </View>
        </View>

        {vault.status === 'error' && (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {vault.error ?? 'The local vault could not be checked safely.'}
          </Text>
        )}
        <AuthButton
          isLoading={false}
          isDisabled={vault.status !== 'uninitialized'}
          label="Set Up My Vault"
          onPress={() => router.push('/vault-setup')}
        />
        <SignOutButton />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.navy,
    elevation: 4,
  },
  brandName: {
    marginTop: 7,
    color: AuthColors.navy,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  heading: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: AuthColors.navy,
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: AuthColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 15,
    backgroundColor: AuthColors.white,
  },
  choiceCopy: {
    flex: 1,
    gap: 5,
  },
  choiceTitle: {
    color: AuthColors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  choiceDescription: {
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
