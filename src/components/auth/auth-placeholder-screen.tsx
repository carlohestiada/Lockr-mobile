import { Link } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthColors } from '@/theme/auth-colors';

interface AuthPlaceholderScreenProps {
  description: string;
  icon: ReactNode;
  title: string;
}

export function AuthPlaceholderScreen({
  description,
  icon,
  title,
}: AuthPlaceholderScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.logoMark}>
            <ShieldCheck color={AuthColors.white} size={28} />
          </View>
          <Text style={styles.brandName}>Lockr</Text>
          <View style={styles.messageCard}>
            <View style={styles.featureIcon}>{icon}</View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
          </View>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" style={styles.backLink}>
              <ArrowLeft color={AuthColors.accent} size={17} />
              <Text style={styles.backText}>Back to sign in</Text>
            </Pressable>
          </Link>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'center',
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: AuthColors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: AuthColors.navy,
    fontSize: 25,
    fontWeight: '700',
    marginTop: 9,
  },
  messageCard: {
    width: '100%',
    alignItems: 'center',
    marginTop: 34,
    padding: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: AuthColors.border,
    backgroundColor: AuthColors.white,
    shadowColor: AuthColors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: AuthColors.softBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: AuthColors.navy,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 19,
    textAlign: 'center',
  },
  description: {
    color: AuthColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    textAlign: 'center',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    padding: 8,
  },
  backText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
