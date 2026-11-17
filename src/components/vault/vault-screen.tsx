import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/theme/auth-colors';

interface VaultScreenProps extends PropsWithChildren {
  title: string;
  subtitle: string;
}

export function VaultScreen({ children, title, subtitle }: VaultScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.brand}>Lockr Vault</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.body}>{children}</View>
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
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  content: {
    width: '100%',
    maxWidth: 480,
  },
  brand: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 16,
    color: AuthColors.navy,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    color: AuthColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
  },
  body: {
    gap: 16,
    marginTop: 26,
  },
});
