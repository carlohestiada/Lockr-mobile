import { LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { useAuth } from '@/contexts/auth-context';
import { useVault } from '@/contexts/vault-context';
import { AuthStorageError } from '@/services/token-storage';
import { AuthColors } from '@/theme/auth-colors';

export default function AccountScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sessionNotice, signOut, user } = useAuth();
  const vault = useVault();
  const router = useRouter();

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setError(null);
    let localSignedOut = false;

    try {
      const result = await signOut();
      if (!result.localSignedOut) {
        setError('We could not securely clear this device session. Please try again.');
      } else {
        localSignedOut = true;
      }
    } catch (requestError) {
      if (requestError instanceof AuthStorageError) {
        setError('We could not securely clear this device session. Please try again.');
      } else {
        setError('We could not complete sign out. Please try again.');
      }
    } finally {
      if (!localSignedOut) {
        setIsSigningOut(false);
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <ShieldCheck color={AuthColors.white} size={29} strokeWidth={2.2} />
            </View>
            <Text style={styles.brandName}>Lockr</Text>
          </View>

          {user ? (
            <>
              <View style={styles.welcome}>
                <Text style={styles.title}>Account Connected</Text>
                <Text style={styles.subtitle}>You are signed in as</Text>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>

              <View style={styles.vaultNotice}>
                <LockKeyhole color={AuthColors.accent} size={20} />
                <View style={styles.vaultCopy}>
                  <Text style={styles.vaultTitle}>
                    {vault.status === 'unlocked'
                      ? 'Local vault is unlocked'
                      : vault.status === 'error'
                        ? 'Local vault unavailable'
                        : vault.metadata
                        ? 'Local vault is locked'
                        : 'Set up your local vault'}
                  </Text>
                  <Text style={styles.vaultDescription}>
                    {vault.error ??
                      'Account sign-in is separate. Your master password and vault contents stay on this device; the account password does not unlock the vault.'}
                  </Text>
                </View>
              </View>
              <AuthButton
                isLoading={false}
                isDisabled={vault.status === 'error' || vault.status === 'loading'}
                label={
                  vault.status === 'unlocked'
                    ? 'Open local vault'
                    : vault.status === 'error'
                      ? 'Vault unavailable'
                    : vault.metadata
                      ? 'Unlock local vault'
                      : 'Set up local vault'
                }
                onPress={() => router.push(
                  vault.status === 'unlocked'
                    ? '/vault'
                    : vault.metadata
                      ? '/vault-unlock'
                      : '/vault-setup',
                )}
              />

              {sessionNotice && (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {sessionNotice}
                </Text>
              )}

              {error && (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {error}
                </Text>
              )}

              <AuthButton
                isLoading={isSigningOut}
                label="Sign Out"
                onPress={() => void handleSignOut()}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  content: {
    width: '100%',
    maxWidth: 440,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 34,
  },
  logoMark: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.navy,
    elevation: 4,
  },
  brandName: {
    marginTop: 8,
    color: AuthColors.navy,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  welcome: {
    alignItems: 'center',
    marginBottom: 27,
  },
  title: {
    color: AuthColors.navy,
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    color: AuthColors.secondaryText,
    fontSize: 14,
  },
  userName: {
    marginTop: 5,
    color: AuthColors.navy,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  email: {
    marginTop: 3,
    color: AuthColors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
  vaultNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 23,
    padding: 16,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 15,
    backgroundColor: AuthColors.white,
  },
  vaultCopy: {
    flex: 1,
    gap: 5,
  },
  vaultTitle: {
    color: AuthColors.navy,
    fontSize: 13,
    fontWeight: '700',
  },
  vaultDescription: {
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: AuthColors.errorText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
