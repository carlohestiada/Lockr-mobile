import { Link } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ArrowRight, Check, LockKeyhole, Mail, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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
import { PasswordVisibilityToggle } from '@/components/auth/password-visibility-toggle';
import { authService, AuthServiceUnavailableError } from '@/services/auth-service';
import { AuthColors } from '@/theme/auth-colors';

const REMEMBERED_EMAIL_KEY = 'lockr.remembered-email';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loginError, setLoginError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const emailInputRef = useRef<TextInputInstance>(null);
  const passwordInputRef = useRef<TextInputInstance>(null);
  const emailWasEdited = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let isMounted = true;
    void SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY)
      .then((savedEmail) => {
        if (isMounted && savedEmail && !emailWasEdited.current) {
          setEmail(savedEmail);
          setRememberEmail(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStorageError('Your saved email could not be loaded. You can enter it manually.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function persistRememberedEmail(value: string) {
    if (Platform.OS === 'web') {
      return;
    }

    try {
      if (value) {
        await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, value);
      } else {
        await SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY);
      }
      setStorageError(null);
    } catch {
      setStorageError('Your email preference could not be saved. You can still sign in.');
    }
  }

  async function toggleRememberEmail() {
    const shouldRemember = !rememberEmail;
    setRememberEmail(shouldRemember);
    setStorageError(null);

    if (!shouldRemember) {
      await persistRememberedEmail('');
      return;
    }

    const normalizedEmail = email.trim();
    if (isValidEmail(normalizedEmail)) {
      await persistRememberedEmail(normalizedEmail);
    }
  }

  async function handleSignIn() {
    if (submitting.current) {
      return;
    }

    const normalizedEmail = email.trim();
    const nextErrors: { email?: string; password?: string } = {};
    if (!normalizedEmail) {
      nextErrors.email = 'Enter your email address.';
    } else if (!isValidEmail(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!masterPassword) {
      nextErrors.password = 'Enter your master password.';
    }

    setFieldErrors(nextErrors);
    setLoginError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    if (rememberEmail) {
      await persistRememberedEmail(normalizedEmail);
    }

    try {
      await authService.signIn({ email: normalizedEmail, masterPassword });
    } catch (error) {
      setLoginError(
        error instanceof AuthServiceUnavailableError
          ? error.message
          : 'We could not sign you in. Please try again.',
      );
    } finally {
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
            <View pointerEvents="none" style={styles.backgroundOrb} />
            <View style={styles.brand}>
              <View style={styles.logoMark}>
                <ShieldCheck color={AuthColors.white} size={30} strokeWidth={2.2} />
              </View>
              <Text style={styles.brandName}>Lockr</Text>
              <Text style={styles.tagline}>Your passwords. Your security. Your control.</Text>
            </View>

            <View style={styles.welcome}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to securely access your personal vault.
              </Text>
            </View>

            <View style={styles.form}>
              <AuthTextInput
                autoCapitalize="none"
                autoComplete="email"
                error={fieldErrors.email}
                inputRef={emailInputRef}
                keyboardType="email-address"
                label="Email Address"
                leftIcon={<Mail color={AuthColors.secondaryText} size={19} />}
                onBlur={() => {
                  if (rememberEmail && isValidEmail(email.trim())) {
                    void persistRememberedEmail(email.trim());
                  }
                }}
                onChangeText={(value) => {
                  emailWasEdited.current = true;
                  setEmail(value);
                  setFieldErrors((current) => ({ ...current, email: undefined }));
                  setLoginError(null);
                }}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                placeholder="Enter your email address"
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />

              <AuthTextInput
                autoCapitalize="none"
                autoComplete="current-password"
                error={fieldErrors.password}
                inputRef={passwordInputRef}
                label="Master Password"
                leftIcon={<LockKeyhole color={AuthColors.secondaryText} size={19} />}
                onChangeText={(value) => {
                  setMasterPassword(value);
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                  setLoginError(null);
                }}
                onSubmitEditing={() => void handleSignIn()}
                placeholder="Enter your master password"
                returnKeyType="done"
                rightAccessory={
                  <PasswordVisibilityToggle
                    isVisible={isPasswordVisible}
                    onPress={() => setIsPasswordVisible((visible) => !visible)}
                  />
                }
                secureTextEntry={!isPasswordVisible}
                textContentType="password"
                value={masterPassword}
              />
            </View>

            <View style={styles.optionsRow}>
              <Pressable
                accessibilityLabel="Remember email on this device"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberEmail }}
                onPress={() => void toggleRememberEmail()}
                style={styles.rememberOption}>
                <View style={[styles.checkbox, rememberEmail && styles.checkboxChecked]}>
                  {rememberEmail && <Check color={AuthColors.white} size={13} strokeWidth={3} />}
                </View>
                <Text style={styles.rememberLabel}>Remember email</Text>
              </Pressable>

              <Link href="/forgot-password" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
                </Pressable>
              </Link>
            </View>

            {storageError && (
              <Text accessibilityLiveRegion="polite" style={styles.storageError}>
                {storageError}
              </Text>
            )}
            {loginError && (
              <Text accessibilityLiveRegion="polite" style={styles.loginError}>
                {loginError}
              </Text>
            )}

            <AuthButton
              isLoading={isSubmitting}
              label="Unlock My Vault"
              onPress={() => void handleSignIn()}
            />

            <View style={styles.registrationRow}>
              <Text style={styles.registrationPrompt}>Don&apos;t have an account?</Text>
              <Link href="/create-account" asChild>
                <Pressable accessibilityRole="link" hitSlop={8} style={styles.createAccountLink}>
                  <Text style={styles.createAccountText}>Create Account</Text>
                  <ArrowRight color={AuthColors.accent} size={15} strokeWidth={2.5} />
                </Pressable>
              </Link>
            </View>

            <View style={styles.securityFooter}>
              <LockKeyhole color={AuthColors.secondaryText} size={14} />
              <Text style={styles.securityText}>Your security is our priority.</Text>
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
    paddingVertical: 20,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  backgroundOrb: {
    position: 'absolute',
    top: -150,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#EFF6FF',
  },
  brand: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoMark: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.navy,
    shadowColor: AuthColors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 5,
  },
  brandName: {
    marginTop: 10,
    color: AuthColors.navy,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  tagline: {
    marginTop: 4,
    color: AuthColors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
  },
  welcome: {
    alignItems: 'center',
    marginBottom: 26,
  },
  welcomeTitle: {
    color: AuthColors.navy,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  welcomeSubtitle: {
    marginTop: 8,
    color: AuthColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  form: {
    gap: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 16,
  },
  rememberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
  },
  checkbox: {
    width: 19,
    height: 19,
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
  rememberLabel: {
    color: AuthColors.secondaryText,
    fontSize: 13,
  },
  forgotLink: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  storageError: {
    color: AuthColors.warningText,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  loginError: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    textAlign: 'center',
  },
  registrationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 24,
  },
  registrationPrompt: {
    color: AuthColors.secondaryText,
    fontSize: 13,
  },
  createAccountLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  createAccountText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  securityFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 32,
  },
  securityText: {
    color: AuthColors.secondaryText,
    fontSize: 12,
  },
});
