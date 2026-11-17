import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useVault } from '@/contexts/vault-context';
import { AuthColors } from '@/theme/auth-colors';

interface VaultTextFieldProps extends TextInputProps {
  label: string;
}

export function VaultTextField({ label, multiline, style, ...props }: VaultTextFieldProps) {
  const { touch } = useVault();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        autoCorrect={false}
        multiline={multiline}
        onChangeText={(value) => {
          touch();
          props.onChangeText?.(value);
        }}
        placeholderTextColor={AuthColors.secondaryText}
        style={[styles.input, multiline && styles.multiline, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  label: {
    color: AuthColors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 12,
    backgroundColor: AuthColors.white,
    color: AuthColors.navy,
    fontSize: 15,
  },
  multiline: {
    minHeight: 112,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
