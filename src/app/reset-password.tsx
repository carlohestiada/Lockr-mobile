import { Link, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { AuthTextInput } from '@/components/auth/auth-text-input';
import { PasswordVisibilityToggle } from '@/components/auth/password-visibility-toggle';
import {
  parsePasswordResetLink,
  type PasswordResetLink,
} from '@/services/password-reset-link';
import { RecoveryServiceError, recoveryService } from '@/services/recovery-service';
import { getAccountPasswordError } from '@/services/registration-validation';
import { AuthColors } from '@/theme/auth-colors';

export default function ResetPasswordScreen() {
  const linkingUrl = Linking.useLinkingURL();
  const resetLink = useMemo(() => parsePasswordResetLink(linkingUrl), [linkingUrl]);

  return <ResetPasswordForm key={linkingUrl ?? 'missing-reset-link'} resetLink={resetLink} />;
}

function ResetPasswordForm({ resetLink }: { resetLink: PasswordResetLink | null }) {
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [confirmationError, setConfirmationError] = useState<string>();
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const submitting = useRef(false);
  const requestSequence = useRef(0);
  const router = useRouter();

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  async function submitPasswordReset() {
    if (submitting.current || !resetLink) {
      return;
    }

    const nextPasswordError = getAccountPasswordError(password);
    const nextConfirmationError = !passwordConfirmation
      ? 'Confirm your new account password.'
      : passwordConfirmation !== password
        ? 'Your passwords do not match.'
        : undefined;

    setPasswordError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    setResetError(null);
    if (nextPasswordError || nextConfirmationError) {
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    const requestId = ++requestSequence.current;

    try {
      await recoveryService.resetPassword({
        ...resetLink,
        password,
        passwordConfirmation,
      });

      if (requestId === requestSequence.current) {
        setIsComplete(true);
      }
    } catch (error) {
      if (requestId !== requestSequence.current) {
        return;
      }

      if (error instanceof RecoveryServiceError) {
        if (error.code === 'invalid-token') {
          setResetError(
            'This reset link is invalid, expired, or has already been used. Request a new email to continue.',
          );
        } else if (error.code === 'validation') {
          setPasswordError(error.validationErrors.password?.[0]);
          setConfirmationError(error.validationErrors.password_confirmation?.[0]);
          setResetError(
            error.validationErrors.password || error.validationErrors.password_confirmation
              ? null
              : 'This reset link could not be verified. Request a new email to continue.',
          );
        } else if (error.code === 'rate-limited') {
          setResetError('Too many attempts. Wait a moment, then try again.');
        } else if (error.code === 'network') {
          setResetError('The service could not be reached. Check your connection and try again.');
        } else if (error.code === 'timeout') {
          setResetError('The service took too long to respond. Try again when your connection is stable.');
        } else {
          setResetError('Password reset is temporarily unavailable. Please try again later.');
        }
      } else {
        setResetError('We could not reset your password. Please try again later.');
      }
    } finally {
      if (requestId === requestSequence.current) {
        submitting.current = false;
        setIsSubmitting(false);
        setPassword('');
        setPasswordConfirmation('');
      }
    }
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
                {isComplete ? (
                  <ShieldCheck color={AuthColors.success} size={34} strokeWidth={1.8} />
                ) : (
                  <KeyRound color={AuthColors.accent} size={34} strokeWidth={1.8} />
                )}
              </View>
              <Text style={styles.title}>
                {isComplete
                  ? 'Password Reset Complete'
                  : resetLink
                    ? 'Choose a New Password'
                    : 'Reset Link Unavailable'}
              </Text>
              <Text style={styles.description}>
                {isComplete
                  ? 'Your account password has been updated. Sign in with your new password to continue.'
                  : resetLink
                    ? 'Choose a strong new password for your Lockr account.'
                    : 'This password-reset link is malformed or incomplete. Request a new email to continue.'}
              </Text>
            </View>

            {isComplete ? (
              <AuthButton
                isLoading={false}
                label="Return to Sign In"
                onPress={() => router.replace('/')}
              />
            ) : resetLink ? (
              <>
                <View style={styles.form}>
                  <AuthTextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    error={passwordError}
                    label="New Account Password"
                    leftIcon={<LockKeyhole color={AuthColors.secondaryText} size={19} />}
                    onChangeText={(value) => {
                      setPassword(value);
                      setPasswordError(undefined);
                      setResetError(null);
                    }}
                    onSubmitEditing={() => void submitPasswordReset()}
                    placeholder="Enter a new account password"
                    returnKeyType="done"
                    rightAccessory={
                      <PasswordVisibilityToggle
                        isVisible={isPasswordVisible}
                        onPress={() => setIsPasswordVisible((visible) => !visible)}
                      />
                    }
                    secureTextEntry={!isPasswordVisible}
                    textContentType="newPassword"
                    value={password}
                  />

                  <AuthTextInput
                    autoCapitalize="none"
                    autoComplete="new-password"
                    error={confirmationError}
                    label="Confirm New Password"
                    leftIcon={<LockKeyhole color={AuthColors.secondaryText} size={19} />}
                    onChangeText={(value) => {
                      setPasswordConfirmation(value);
                      setConfirmationError(undefined);
                      setResetError(null);
                    }}
                    onSubmitEditing={() => void submitPasswordReset()}
                    placeholder="Re-enter your new password"
                    returnKeyType="done"
                    rightAccessory={
                      <PasswordVisibilityToggle
                        isVisible={isConfirmationVisible}
                        onPress={() => setIsConfirmationVisible((visible) => !visible)}
                      />
                    }
                    secureTextEntry={!isConfirmationVisible}
                    textContentType="newPassword"
                    value={passwordConfirmation}
                  />
                </View>

                <View style={styles.securityNotice}>
                  <ShieldCheck color={AuthColors.secondaryText} size={17} />
                  <Text style={styles.securityNoticeText}>
                    This changes only your account password. It does not reset your vault master
                    password or automatically sign you in.
                  </Text>
                </View>

                {resetError && (
                  <Text accessibilityLiveRegion="polite" style={styles.errorMessage}>
                    {resetError}
                  </Text>
                )}

                <AuthButton
                  isLoading={isSubmitting}
                  label="Reset Password"
                  onPress={() => void submitPasswordReset()}
                />
              </>
            ) : (
              <>
                <View style={styles.invalidNotice}>
                  <Text style={styles.invalidNoticeText}>
                    Reset links can only be used once and may expire. For your security, request a
                    fresh password-reset email.
                  </Text>
                </View>
                <Link href="/forgot-password" asChild>
                  <Pressable accessibilityRole="link" style={styles.forgotLink}>
                    <Text style={styles.forgotLinkText}>Request a new reset email</Text>
                  </Pressable>
                </Link>
              </>
            )}
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
    gap: 18,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 17,
    marginBottom: 17,
    padding: 14,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  securityNoticeText: {
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
  invalidNotice: {
    padding: 14,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    backgroundColor: AuthColors.white,
  },
  invalidNoticeText: {
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  forgotLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: 12,
  },
  forgotLinkText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
