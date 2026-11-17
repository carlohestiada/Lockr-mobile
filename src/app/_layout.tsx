import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { status } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected
        guard={status === 'authenticated'}
        redirectTo="/">
        <Stack.Screen name="account" />
        <Stack.Screen name="explore" />
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
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/terms" />
    </Stack>
  );
}
