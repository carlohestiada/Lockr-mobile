import { Link } from 'expo-router';
import { ArrowLeft, Check, LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthColors } from '@/theme/auth-colors';

interface RecoveryConfirmationScreenProps {
  cooldownRemaining: number;
  email: string;
  error: string | null;
  isLoading: boolean;
  onResend: () => void;
}

const INSTRUCTIONS = [
  'Check your inbox for a message from Lockr.',
  'Look in your spam or junk folder if it is not there.',
  'Verify that you entered the correct email address.',
  'Contact Lockr support if you continue experiencing issues.',
];

export function RecoveryConfirmationScreen({
  cooldownRemaining,
  email,
  error,
  isLoading,
  onResend,
}: RecoveryConfirmationScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Link href="/" asChild>
              <Pressable accessibilityRole="link" hitSlop={8} style={styles.backLink}>
                <ArrowLeft color={AuthColors.accent} size={18} />
                <Text style={styles.backText}>Back to sign in</Text>
              </Pressable>
            </Link>

            <View style={styles.brand}>
              <View style={styles.logoMark}>
                <ShieldCheck color={AuthColors.white} size={28} strokeWidth={2.2} />
              </View>
              <Text style={styles.brandName}>Lockr</Text>
            </View>

            <View style={styles.confirmation}>
              <View style={styles.illustration}>
                <Mail color={AuthColors.accent} size={34} strokeWidth={1.8} />
                <View style={styles.illustrationBadge}>
                  <Check color={AuthColors.white} size={16} strokeWidth={2.8} />
                </View>
              </View>
              <Text style={styles.title}>Check Your Email</Text>
              <Text style={styles.description}>
                If an account exists for this email address, you&apos;ll receive instructions to
                continue.
              </Text>

              <View style={styles.emailCard}>
                <Text style={styles.emailCardLabel}>Recovery instructions were requested for:</Text>
                <View style={styles.emailValueRow}>
                  <Mail color={AuthColors.accent} size={17} />
                  <Text accessibilityLabel="Submitted recovery email" style={styles.emailValue}>
                    {email}
                  </Text>
                </View>
              </View>

              <View style={styles.instructions}>
                <Text style={styles.instructionsTitle}>What to do next</Text>
                {INSTRUCTIONS.map((instruction) => (
                  <View key={instruction} style={styles.instructionRow}>
                    <View style={styles.instructionBullet} />
                    <Text style={styles.instructionText}>{instruction}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.vaultNotice}>
                <LockKeyhole color={AuthColors.secondaryText} size={17} />
                <Text style={styles.vaultNoticeText}>
                  Account recovery does not automatically restore access to your encrypted vault.
                  Keep your existing vault data safe. Resetting your account password does not
                  reset your master password.
                </Text>
              </View>

              {error && (
                <Text accessibilityLiveRegion="polite" style={styles.errorMessage}>
                  {error}
                </Text>
              )}

              <Text style={styles.resendTitle}>Didn&apos;t receive the email?</Text>
              <View style={styles.fullWidthAction}>
                <AuthButton
                  isDisabled={cooldownRemaining > 0}
                  isLoading={isLoading}
                  label={
                    cooldownRemaining > 0 ? `Resend email · ${cooldownRemaining}s` : 'Resend email'
                  }
                  onPress={onResend}
                />
              </View>

              <Text style={styles.resendHint}>
                {cooldownRemaining > 0
                  ? 'You can request another message when the timer ends.'
                  : 'Still waiting? You can request another message.'}
              </Text>

              <Link href="/" asChild>
                <Pressable accessibilityRole="link" style={styles.loginLink}>
                  <ArrowLeft color={AuthColors.accent} size={17} />
                  <Text style={styles.loginLinkText}>Back to Login</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 12,
  },
  backLink: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  backText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.navy,
    shadowColor: AuthColors.navy,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 11,
    elevation: 4,
  },
  brandName: {
    marginTop: 7,
    color: AuthColors.navy,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  confirmation: {
    width: '100%',
    alignItems: 'center',
  },
  illustration: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 39,
    backgroundColor: AuthColors.softBlue,
    marginBottom: 18,
  },
  illustrationBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: AuthColors.success,
    borderWidth: 2,
    borderColor: AuthColors.background,
  },
  title: {
    color: AuthColors.navy,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  description: {
    marginTop: 9,
    color: AuthColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  emailCard: {
    width: '100%',
    marginTop: 19,
    marginBottom: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  emailCardLabel: {
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  emailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 7,
  },
  emailValue: {
    flex: 1,
    color: AuthColors.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  instructions: {
    width: '100%',
    gap: 9,
    marginBottom: 17,
  },
  instructionsTitle: {
    color: AuthColors.navy,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  instructionBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: AuthColors.success,
    marginTop: 6,
  },
  instructionText: {
    flex: 1,
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  vaultNotice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  vaultNoticeText: {
    flex: 1,
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  errorMessage: {
    alignSelf: 'stretch',
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: 'center',
  },
  resendTitle: {
    alignSelf: 'flex-start',
    color: AuthColors.navy,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 9,
  },
  fullWidthAction: {
    width: '100%',
  },
  resendHint: {
    marginTop: 11,
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  loginLink: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  loginLinkText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
