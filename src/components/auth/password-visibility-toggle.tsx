import { Eye, EyeOff } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AuthColors } from '@/theme/auth-colors';

interface PasswordVisibilityToggleProps {
  isVisible: boolean;
  onPress: () => void;
}

export function PasswordVisibilityToggle({
  isVisible,
  onPress,
}: PasswordVisibilityToggleProps) {
  return (
    <Pressable
      accessibilityLabel={isVisible ? 'Hide master password' : 'Show master password'}
      accessibilityRole="button"
      accessibilityState={{ selected: isVisible }}
      hitSlop={10}
      onPress={onPress}
      style={styles.button}>
      {isVisible ? (
        <EyeOff color={AuthColors.secondaryText} size={19} />
      ) : (
        <Eye color={AuthColors.secondaryText} size={19} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 36,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -5,
  },
});
