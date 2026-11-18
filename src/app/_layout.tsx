import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useVault, VaultProvider } from '@/contexts/vault-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <VaultProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </VaultProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();
  const vault = useVault();

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        vault.touch();
        return false;
      }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected
          guard={status === 'authenticated'}
          redirectTo="/">
          <Stack.Screen name="account" />
          <Stack.Screen name="explore" />
          <Stack.Screen name="vault-onboarding" />
        </Stack.Protected>
        <Stack.Protected
          guard={status === 'authenticated' && __DEV__}
          redirectTo="/account">
          <Stack.Screen name="native-crypto-validation" />
        </Stack.Protected>
        <Stack.Protected
          guard={status !== 'authenticated'}
          redirectTo="/account">
          <Stack.Screen name="index" />
          <Stack.Screen name="create-account" />
        </Stack.Protected>
        <Stack.Protected
          guard={vault.status === 'uninitialized'}
          redirectTo="/vault-unlock">
          <Stack.Screen name="vault-setup" />
        </Stack.Protected>
        <Stack.Protected
          guard={vault.status === 'locked' || vault.status === 'error'}
          redirectTo="/account">
          <Stack.Screen name="vault-unlock" />
          <Stack.Screen name="vault-recovery" />
        </Stack.Protected>
        <Stack.Protected
          guard={vault.status === 'unlocked'}
          redirectTo="/vault-unlock">
          <Stack.Screen name="vault-setup-complete" />
          <Stack.Screen name="vault" />
          <Stack.Screen name="vault-credential" />
          <Stack.Screen name="vault-settings" />
          <Stack.Screen name="trusted-devices" />
        </Stack.Protected>
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
      </Stack>
    </View>
  );
}
