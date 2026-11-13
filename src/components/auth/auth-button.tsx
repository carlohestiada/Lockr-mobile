import { ArrowRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { AuthColors } from '@/theme/auth-colors';

interface AuthButtonProps {
  isLoading: boolean;
  label: string;
  onPress: () => void;
}

export function AuthButton({ isLoading, label, onPress }: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: isLoading, disabled: isLoading }}
      disabled={isLoading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && !isLoading && styles.pressed]}>
      {isLoading ? (
        <ActivityIndicator color={AuthColors.white} />
      ) : (
        <>
          <Text style={styles.label}>{label}</Text>
          <ArrowRight color={AuthColors.white} size={18} />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: AuthColors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: AuthColors.accent,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.19,
    shadowRadius: 12,
    elevation: 4,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  label: {
    color: AuthColors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
