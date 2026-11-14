import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Device from 'expo-device';
import { Redirect, Stack } from 'expo-router';

import {
  runNativeVaultCryptoValidation,
  type NativeCryptoTestResult,
} from '@/services/native-vault-crypto-validation';

const COLORS = {
  background: '#F8FAFC',
  border: '#E2E8F0',
  danger: '#B91C1C',
  muted: '#64748B',
  navy: '#0F172A',
  success: '#15803D',
  white: '#FFFFFF',
};

export default function NativeCryptoValidationScreen() {
  const [results, setResults] = useState<NativeCryptoTestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [maximumTimerDelayMs, setMaximumTimerDelayMs] = useState<number | null>(null);
  const [runnerError, setRunnerError] = useState(false);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const runValidation = async () => {
    if (running) {
      return;
    }

    setRunning(true);
    setResults([]);
    setMaximumTimerDelayMs(null);
    setRunnerError(false);
    try {
      const report = await runNativeVaultCryptoValidation((result) => {
        setResults((current) => [...current, result]);
      });
      setMaximumTimerDelayMs(report.maximumTimerDelayMs);
    } catch {
      setRunnerError(true);
    } finally {
      setRunning(false);
    }
  };

  const passedCount = results.filter((result) => result.passed).length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Native crypto validation' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Native crypto validation</Text>
        <Text style={styles.description}>
          Runs fixed test vectors and negative tests against the native crypto modules in this
          development build. No account or vault data is used.
        </Text>

        <View style={styles.deviceCard}>
          <Text style={styles.cardTitle}>Runtime</Text>
          <Text style={styles.detail}>Platform: {Platform.OS}</Text>
          <Text style={styles.detail}>Device: {Device.modelName ?? 'Unknown device'}</Text>
          <Text style={styles.detail}>
            Target: {Device.isDevice ? 'Physical device' : 'Emulator / simulator'}
          </Text>
          <Text style={styles.detail}>OS version: {Device.osVersion ?? 'Unknown'}</Text>
          <Text style={styles.detail}>
            Total device memory: {Device.totalMemory ? `${Math.round(Device.totalMemory / 1024 ** 3)} GiB` : 'Unknown'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={running}
          onPress={runValidation}
          style={({ pressed }) => [
            styles.button,
            (pressed || running) && styles.buttonPressed,
          ]}>
          {running ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Run native tests</Text>
          )}
        </Pressable>

        {runnerError && (
          <Text style={styles.failure}>
            Native validation could not run on this platform or development build.
          </Text>
        )}

        {results.length > 0 && (
          <View style={styles.resultsCard}>
            <Text style={styles.cardTitle}>
              Results: {passedCount}/{results.length} passed
            </Text>
            {results.map((result) => (
              <View key={result.name} style={styles.resultRow}>
                <Text
                  style={[
                    styles.resultState,
                    result.passed ? styles.success : styles.failure,
                  ]}>
                  {result.passed ? 'PASS' : 'FAIL'}
                </Text>
                <View style={styles.resultDescription}>
                  <Text style={styles.detail}>{result.name}</Text>
                  <Text style={styles.muted}>{result.durationMs} ms</Text>
                </View>
              </View>
            ))}
            {maximumTimerDelayMs !== null && (
              <Text style={styles.muted}>
                Maximum observed JavaScript timer delay: {maximumTimerDelayMs} ms
              </Text>
            )}
          </View>
        )}

        <Text style={styles.warning}>
          These checks do not measure app-process memory. Use Android Studio Profiler on a
          supported device for memory-pressure testing. Do not copy test secrets from source into
          real credentials.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  deviceCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  resultsCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  cardTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  detail: {
    color: COLORS.navy,
    fontSize: 14,
  },
  muted: {
    color: COLORS.muted,
    fontSize: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  resultRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  resultState: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
  },
  resultDescription: {
    flex: 1,
    gap: 2,
  },
  success: {
    color: COLORS.success,
  },
  failure: {
    color: COLORS.danger,
  },
  warning: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
