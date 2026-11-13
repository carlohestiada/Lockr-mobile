import { useState, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { AuthColors } from '@/theme/auth-colors';

interface AuthTextInputProps {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
  inputRef?: Ref<TextInputInstance>;
  keyboardType?: TextInputProps['keyboardType'];
  label: string;
  leftIcon: ReactNode;
  onBlur?: TextInputProps['onBlur'];
  onChangeText: (value: string) => void;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  placeholder: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  rightAccessory?: ReactNode;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
  value: string;
}

export function AuthTextInput({
  autoCapitalize,
  autoComplete,
  error,
  inputRef,
  keyboardType,
  label,
  leftIcon,
  onBlur,
  onChangeText,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  rightAccessory,
  secureTextEntry,
  textContentType,
  value,
}: AuthTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputInvalid,
        ]}>
        <View style={styles.leadingIcon}>{leftIcon}</View>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={AuthColors.placeholder}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          selectionColor={AuthColors.accent}
          style={styles.input}
          textContentType={textContentType}
          value={value}
          keyboardType={keyboardType}
        />
        {rightAccessory}
      </View>
      {error && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: AuthColors.navy,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: AuthColors.white,
    shadowColor: AuthColors.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 1,
  },
  inputFocused: {
    borderColor: AuthColors.accent,
  },
  inputInvalid: {
    borderColor: AuthColors.error,
  },
  leadingIcon: {
    width: 24,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 0,
    color: AuthColors.navy,
    fontSize: 14,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 12,
    marginTop: 5,
  },
});
