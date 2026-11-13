import { Link, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { AuthTextInput } from '@/components/auth/auth-text-input';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { PasswordVisibilityToggle } from '@/components/auth/password-visibility-toggle';
import {
  RegistrationNotConfiguredError,
  registrationService,
} from '@/services/registration-service';
import { ApiRequestError, getFirstValidationError } from '@/services/api/api-errors';
import {
  validateRegistration,
  type RegistrationErrors,
} from '@/services/registration-validation';
import { AuthColors } from '@/theme/auth-colors';

export default function CreateAccountScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const emailInputRef = useRef<TextInputInstance>(null);
  const passwordInputRef = useRef<TextInputInstance>(null);
  const confirmPasswordInputRef = useRef<TextInputInstance>(null);
  const submitting = useRef(false);
  const router = useRouter();

  async function handleCreateAccount() {
    if (submitting.current) return;

    const nextErrors = validateRegistration({
      fullName,
      email,
      accountPassword,
      confirmPassword,
      acceptedTerms,
    });
    setErrors(nextErrors);
    setRegistrationError(null);
    if (Object.keys(nextErrors).length > 0) return;

    submitting.current = true;
    setIsSubmitting(true);

    try {
      await registrationService.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password: accountPassword,
        passwordConfirmation: confirmPassword,
      });
      router.replace('/account');
    } catch (error) {
      if (error instanceof RegistrationNotConfiguredError) {
        setRegistrationError(error.message);
      } else if (error instanceof ApiRequestError) {
        setErrors({
          fullName: getFirstValidationError(error, 'name'),
          email: getFirstValidationError(error, 'email'),
          accountPassword: getFirstValidationError(error, 'password'),
        });
        setRegistrationError(error.message);
      } else {
        setRegistrationError('We could not create your account. Please try again later.');
      }
    } finally {
      setAccountPassword('');
      setConfirmPassword('');
      setShowAccountPassword(false);
      setShowConfirmPassword(false);
      submitting.current = false;
      setIsSubmitting(false);
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
              <Text style={styles.tagline}>Secure your digital life.</Text>
            </View>

            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>Create Your Account</Text>
              <Text style={styles.welcomeSubtitle}>
                Start protecting your digital life with Lockr.
              </Text>
            </View>

            <View style={styles.form}>
              <AuthTextInput
                autoCapitalize="words"
                autoComplete="name"
                error={errors.fullName}
                label="Full Name"
                leftIcon={<UserRound color={AuthColors.secondaryText} size={19} />}
                onChangeText={(value) => {
                  setFullName(value);
                  setErrors((current) => ({ ...current, fullName: undefined }));
                  setRegistrationError(null);
                }}
                onSubmitEditing={() => emailInputRef.current?.focus()}
                placeholder="Enter your full name"
                returnKeyType="next"
                textContentType="name"
                value={fullName}
              />

              <AuthTextInput
                autoCapitalize="none"
                autoComplete="email"
                error={errors.email}
                inputRef={emailInputRef}
                keyboardType="email-address"
                label="Email Address"
                leftIcon={<Mail color={AuthColors.secondaryText} size={19} />}
                onChangeText={(value) => {
                  setEmail(value);
                  setErrors((current) => ({ ...current, email: undefined }));
                  setRegistrationError(null);
                }}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                placeholder="Enter your email address"
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />

              <View>
                <AuthTextInput
                  autoCapitalize="none"
                  autoComplete="new-password"
                  error={errors.accountPassword}
                  inputRef={passwordInputRef}
                  label="Account Password"
                  leftIcon={<LockKeyhole color={AuthColors.secondaryText} size={19} />}
                  onChangeText={(value) => {
                    setAccountPassword(value);
                    setErrors((current) => ({
                      ...current,
                      accountPassword: undefined,
                      confirmPassword: undefined,
                    }));
                    setRegistrationError(null);
                  }}
                  onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  placeholder="Create an account password"
                  returnKeyType="next"
                  rightAccessory={
                    <PasswordVisibilityToggle
                      isVisible={showAccountPassword}
                      onPress={() => setShowAccountPassword((visible) => !visible)}
                    />
                  }
                  secureTextEntry={!showAccountPassword}
                  textContentType="newPassword"
                  value={accountPassword}
                />
                <PasswordStrengthIndicator password={accountPassword} />
              </View>

              <AuthTextInput
                autoCapitalize="none"
                autoComplete="new-password"
                error={errors.confirmPassword}
                inputRef={confirmPasswordInputRef}
                label="Confirm Account Password"
                leftIcon={<LockKeyhole color={AuthColors.secondaryText} size={19} />}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setErrors((current) => ({ ...current, confirmPassword: undefined }));
                  setRegistrationError(null);
                }}
                onSubmitEditing={() => void handleCreateAccount()}
                placeholder="Confirm your account password"
                returnKeyType="done"
                rightAccessory={
                  <PasswordVisibilityToggle
                    isVisible={showConfirmPassword}
                    onPress={() => setShowConfirmPassword((visible) => !visible)}
                  />
                }
                secureTextEntry={!showConfirmPassword}
                textContentType="newPassword"
                value={confirmPassword}
              />
            </View>

            <View style={styles.securityNote}>
              <View style={styles.securityIcon}>
                <ShieldCheck color={AuthColors.accent} size={19} />
              </View>
              <View style={styles.securityCopy}>
                <Text style={styles.securityTitle}>Your account password protects sign-in.</Text>
                <Text style={styles.securityDescription}>
                  Your separate vault master password is never sent to Laravel and is not set here.
                </Text>
              </View>
            </View>

            <View style={styles.termsSection}>
              <View style={styles.termsRow}>
                <Pressable
                  accessibilityLabel="Agree to the Terms of Service and Privacy Policy"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  hitSlop={6}
                  onPress={() => {
                    setAcceptedTerms((accepted) => !accepted);
                    setErrors((current) => ({ ...current, acceptedTerms: undefined }));
                    setRegistrationError(null);
                  }}
                  style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                  {acceptedTerms && <Check color={AuthColors.white} size={13} strokeWidth={3} />}
                </Pressable>
                <Text style={styles.termsText}>
                  I agree to the <Link href="/legal/terms" style={styles.legalLink}>Terms of Service</Link>
                  {' '}and <Link href="/legal/privacy" style={styles.legalLink}>Privacy Policy</Link>.
                </Text>
              </View>
              {errors.acceptedTerms && (
                <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
                  {errors.acceptedTerms}
                </Text>
              )}
            </View>

            {registrationError && (
              <Text accessibilityLiveRegion="polite" style={styles.registrationError}>
                {registrationError}
              </Text>
            )}

            <AuthButton
              isLoading={isSubmitting}
              label="Create Account"
              onPress={() => void handleCreateAccount()}
            />

            <View style={styles.signInRow}>
              <Text style={styles.signInPrompt}>Already have an account?</Text>
              <Link href="/" asChild>
                <Pressable accessibilityRole="link" hitSlop={8} style={styles.signInLink}>
                  <Text style={styles.signInText}>Sign In</Text>
                  <ArrowLeft color={AuthColors.accent} size={15} strokeWidth={2.5} />
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
    paddingBottom: 12,
  },
  backLink: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  backText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  brand: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 20,
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
  tagline: {
    marginTop: 2,
    color: AuthColors.secondaryText,
    fontSize: 12,
  },
  welcome: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    color: AuthColors.navy,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    marginTop: 6,
    color: AuthColors.secondaryText,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 17,
    padding: 13,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 14,
    backgroundColor: AuthColors.softBlue,
  },
  securityIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: AuthColors.white,
  },
  securityCopy: {
    flex: 1,
    gap: 3,
  },
  securityTitle: {
    color: AuthColors.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  securityDescription: {
    color: AuthColors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
  },
  termsSection: {
    marginTop: 17,
    marginBottom: 15,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderWidth: 1.5,
    borderColor: AuthColors.border,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.white,
  },
  checkboxChecked: {
    borderColor: AuthColors.accent,
    backgroundColor: AuthColors.accent,
  },
  termsText: {
    flex: 1,
    color: AuthColors.secondaryText,
    fontSize: 12,
    lineHeight: 19,
  },
  legalLink: {
    color: AuthColors.accent,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  fieldError: {
    color: AuthColors.errorText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
    marginLeft: 30,
  },
  registrationError: {
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
    marginTop: 20,
  },
  signInPrompt: {
    color: AuthColors.secondaryText,
    fontSize: 13,
  },
  signInLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  signInText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
