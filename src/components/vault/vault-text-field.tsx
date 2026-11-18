import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useVault } from '@/contexts/vault-context';
import { AuthColors } from '@/theme/auth-colors';

interface VaultTextFieldProps extends TextInputProps {
  label: string;
  rightAccessory?: ReactNode;
}

export function VaultTextField({
  label,
  multiline,
  rightAccessory,
  style,
  ...props
}: VaultTextFieldProps) {
  const { touch } = useVault();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          {...props}
          autoCorrect={false}
          multiline={multiline}
          onChangeText={(value) => {
            touch();
            props.onChangeText?.(value);
          }}
          placeholderTextColor={AuthColors.secondaryText}
          style={[
            styles.input,
            multiline && styles.multiline,
            rightAccessory ? styles.inputWithAccessory : undefined,
            style,
          ]}
        />
        {rightAccessory && <View style={styles.accessory}>{rightAccessory}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 7,
  },
  inputWrapper: {
    position: 'relative',
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
  inputWithAccessory: {
    paddingRight: 54,
  },
  accessory: {
    position: 'absolute',
    top: 2,
    right: 6,
  },
  multiline: {
    minHeight: 112,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
