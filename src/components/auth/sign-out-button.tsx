import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useVault } from '@/contexts/vault-context';
import { AuthStorageError } from '@/services/token-storage';
import { AuthColors } from '@/theme/auth-colors';

export function SignOutButton() {
  const router = useRouter();
  const { signOut, status } = useAuth();
  const vault = useVault();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== 'authenticated') {
    return null;
  }

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setError(null);
    try {
      await vault.lock();
      const result = await signOut();
      if (!result.localSignedOut) {
        setError('We could not securely clear this device session. Please try again.');
        setIsSigningOut(false);
        return;
      }
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof AuthStorageError
        ? 'We could not securely clear this device session. Please try again.'
        : 'We could not complete sign out. Please try again.');
      setIsSigningOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: isSigningOut, disabled: isSigningOut }}
        disabled={isSigningOut}
        onPress={() => void handleSignOut()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        {isSigningOut ? (
          <ActivityIndicator color={AuthColors.accent} />
        ) : (
          <>
            <LogOut color={AuthColors.secondaryText} size={17} />
            <Text style={styles.label}>Sign Out</Text>
          </>
        )}
      </Pressable>
      {error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  label: {
    color: AuthColors.secondaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
