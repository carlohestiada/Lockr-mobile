import { useRouter } from 'expo-router';
import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { ApiConfigurationError } from '@/services/api/api-config';
import { ApiRequestError } from '@/services/api/api-errors';
import { authService } from '@/services/auth-service';
import { AuthColors } from '@/theme/auth-colors';
import type { AuthUser } from '@/types/auth';

export default function AccountScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutMessage, setSignOutMessage] = useState<string | null>(null);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    void authService
      .getCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser);
        }
      })
      .catch((requestError: unknown) => {
        if (!isMounted) {
          return;
        }

        if (
          requestError instanceof ApiRequestError &&
          requestError.code === 'unauthorized'
        ) {
          router.replace('/');
          return;
        }

        setError('We could not verify your account session. Check your connection and try again.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refreshAttempt, router]);

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setError(null);
    setSignOutMessage(null);

    try {
      await authService.signOut();
      setUser(null);
      setSignOutMessage('You are signed out on this device.');
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        setUser(null);
        setSignOutMessage(
          'This device is signed out, but the server could not confirm token revocation. The token will expire automatically.',
        );
      } else if (requestError instanceof ApiConfigurationError) {
        setUser(null);
        setSignOutMessage(
          'This device is signed out, but the API was not configured to confirm server-side revocation.',
        );
      } else {
        setError('We could not securely clear this device session. Please try again.');
      }
    } finally {
      setIsSigningOut(false);
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

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={AuthColors.accent} size="large" />
              <Text style={styles.mutedText}>Verifying your account…</Text>
            </View>
          ) : signOutMessage ? (
            <View style={styles.messageCard}>
              <Text accessibilityLiveRegion="polite" style={styles.messageText}>
                {signOutMessage}
              </Text>
              <AuthButton
                isLoading={false}
                label="Back to Sign In"
                onPress={() => router.replace('/')}
              />
            </View>
          ) : error ? (
            <View style={styles.messageCard}>
              <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                {error}
              </Text>
              <AuthButton
                isLoading={isLoading}
                label="Try Again"
                onPress={() => {
                  setError(null);
                  setIsLoading(true);
                  setRefreshAttempt((attempt) => attempt + 1);
                }}
              />
            </View>
          ) : user ? (
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
                  <Text style={styles.vaultTitle}>Vault remains separate</Text>
                  <Text style={styles.vaultDescription}>
                    Account sign-in does not unlock a local vault. Vault unlocking is not
                    configured yet, and your account password is never used as the vault master
                    password.
                  </Text>
                </View>
              </View>

              <AuthButton
                isLoading={isSigningOut}
                label="Sign Out"
                onPress={() => void handleSignOut()}
              />
            </>
          ) : (
            <View style={styles.messageCard}>
              <Text style={styles.errorText}>No active account session was found.</Text>
              <AuthButton
                isLoading={false}
                label="Back to Sign In"
                onPress={() => router.replace('/')}
              />
            </View>
          )}

          {!isLoading && !signOutMessage && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.replace('/')}
              style={styles.backLink}>
              <ArrowLeft color={AuthColors.accent} size={16} />
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>
          )}
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
  loading: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 36,
  },
  mutedText: {
    color: AuthColors.secondaryText,
    fontSize: 14,
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
  messageCard: {
    gap: 16,
  },
  messageText: {
    color: AuthColors.navy,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  errorText: {
    color: AuthColors.errorText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  backLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 24,
    padding: 8,
  },
  signInText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
