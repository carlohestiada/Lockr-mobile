import { Link, useNavigation } from 'expo-router';
import { ArrowLeft, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
import { RecoveryConfirmationScreen } from '@/components/auth/recovery-confirmation-screen';
import { AuthTextInput } from '@/components/auth/auth-text-input';
import { recoveryService } from '@/services/recovery-service';
import {
  getRecoveryEmailError,
  normalizeRecoveryEmail,
} from '@/services/recovery-validation';
import { AuthColors } from '@/theme/auth-colors';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const submitting = useRef(false);
  const requestSequence = useRef(0);
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      requestSequence.current += 1;
      submitting.current = false;
      setIsSubmitting(false);
      setRecoveryError(null);
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!isConfirmationVisible || cooldownRemaining === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCooldownRemaining((remaining) => Math.max(remaining - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownRemaining, isConfirmationVisible]);

  async function submitRecoveryRequest(isResend = false) {
    if (submitting.current || (isResend && cooldownRemaining > 0)) {
      return;
    }

    const nextEmailError = getRecoveryEmailError(email);
    if (nextEmailError) {
      if (!isResend) {
        setEmailError(nextEmailError);
      }
      setRecoveryError(null);
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    setRecoveryError(null);
    const requestId = ++requestSequence.current;

    try {
      const result = await recoveryService.requestPasswordReset({
        email: normalizeRecoveryEmail(email),
      });

      if (requestId !== requestSequence.current) {
        return;
      }

      if (result.status === 'not-configured') {
        setRecoveryError(
          isResend
            ? 'Email recovery is not available yet. No message was sent.'
            : 'Email recovery is not available yet. No request was sent.',
        );
        return;
      }

      setIsConfirmationVisible(true);
      setEmailError(undefined);
      setCooldownRemaining(RESEND_COOLDOWN_SECONDS);
      setRecoveryError(null);
    } catch {
      if (requestId === requestSequence.current) {
        setRecoveryError('We could not process your request right now. Please try again later.');
      }
    } finally {
      if (requestId === requestSequence.current) {
        submitting.current = false;
        setIsSubmitting(false);
      }
    }
  }

  if (isConfirmationVisible) {
    return (
      <RecoveryConfirmationScreen
        cooldownRemaining={cooldownRemaining}
        email={normalizeRecoveryEmail(email)}
        error={recoveryError}
        isLoading={isSubmitting}
        onResend={() => void submitRecoveryRequest(true)}
      />
    );
  }

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

            <View style={styles.hero}>
              <View style={styles.illustration}>
                <KeyRound color={AuthColors.accent} size={34} strokeWidth={1.8} />
              </View>
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.description}>
                Don&apos;t worry. Enter your registered email address and we&apos;ll guide you through
                the account recovery process.
              </Text>
            </View>

            <View style={styles.form}>
              <AuthTextInput
                autoCapitalize="none"
                autoComplete="email"
                error={emailError}
                keyboardType="email-address"
                label="Email Address"
                leftIcon={<Mail color={AuthColors.secondaryText} size={19} />}
                onChangeText={(value) => {
                  setEmail(value);
                  setEmailError(undefined);
                  setRecoveryError(null);
                }}
                onSubmitEditing={() => void submitRecoveryRequest()}
                placeholder="Enter your registered email"
                returnKeyType="done"
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.vaultNotice}>
              <LockKeyhole color={AuthColors.secondaryText} size={17} />
              <Text style={styles.vaultNoticeText}>
                Account recovery cannot reset your master password or decrypt your vault. Secure
                vault recovery is not available yet. Keep your existing vault data.
              </Text>
            </View>

            {recoveryError && (
              <Text accessibilityLiveRegion="polite" style={styles.errorMessage}>
                {recoveryError}
              </Text>
            )}

            <AuthButton
              isLoading={isSubmitting}
              label="Continue"
              onPress={() => void submitRecoveryRequest()}
            />

            <View style={styles.signInRow}>
              <Text style={styles.signInPrompt}>Remember your password?</Text>
              <Link href="/" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.signInText}>Sign In</Text>
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
    marginBottom: 27,
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
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  illustration: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 39,
    backgroundColor: AuthColors.softBlue,
    marginBottom: 20,
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
  form: {
    marginBottom: 16,
  },
  vaultNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 3,
    marginBottom: 18,
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
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: 'center',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 24,
  },
  signInPrompt: {
    color: AuthColors.secondaryText,
    fontSize: 13,
  },
  signInText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
