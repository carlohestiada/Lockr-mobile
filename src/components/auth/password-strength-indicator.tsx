import { StyleSheet, Text, View } from 'react-native';

import { getPasswordStrength } from '@/services/registration-validation';
import { AuthColors } from '@/theme/auth-colors';

interface PasswordStrengthIndicatorProps {
  password: string;
}

const STRENGTH_LEVELS = ['Weak', 'Fair', 'Good', 'Strong'] as const;

const STRENGTH_COLORS = {
  Weak: AuthColors.error,
  Fair: AuthColors.warningText,
  Good: AuthColors.accent,
  Strong: AuthColors.success,
} as const;

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = getPasswordStrength(password);
  const strengthIndex = STRENGTH_LEVELS.indexOf(strength);
  const strengthColor = STRENGTH_COLORS[strength];

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={styles.labelRow}>
        <Text style={styles.label}>Password strength</Text>
        <Text style={[styles.strengthLabel, password.length > 0 && { color: strengthColor }]}>
          {password.length > 0 ? strength : 'Add a passphrase'}
        </Text>
      </View>
      <View style={styles.meter} accessibilityLabel={`Password strength: ${strength}`}>
        {STRENGTH_LEVELS.map((level, index) => (
          <View
            key={level}
            style={[
              styles.segment,
              password.length > 0 && index <= strengthIndex && { backgroundColor: strengthColor },
            ]}
          />
        ))}
      </View>
      <Text style={styles.guidance}>
        Use at least 14 characters with a mix of uppercase and lowercase letters, numbers, and
        symbols. Avoid reusing passwords.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 9,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: AuthColors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  strengthLabel: {
    color: AuthColors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  meter: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 7,
  },
  segment: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    backgroundColor: AuthColors.border,
  },
  guidance: {
    color: AuthColors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 7,
  },
});
