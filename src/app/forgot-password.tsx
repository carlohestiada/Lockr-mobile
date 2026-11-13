import { KeyRound } from 'lucide-react-native';

import { AuthPlaceholderScreen } from '@/components/auth/auth-placeholder-screen';
import { AuthColors } from '@/theme/auth-colors';

export default function ForgotPasswordScreen() {
  return (
    <AuthPlaceholderScreen
      description="Password recovery will be available when Lockr is connected to its authentication service."
      icon={<KeyRound color={AuthColors.accent} size={22} />}
      title="Recover access"
    />
  );
}
