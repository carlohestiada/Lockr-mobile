import { UserRoundPlus } from 'lucide-react-native';

import { AuthPlaceholderScreen } from '@/components/auth/auth-placeholder-screen';
import { AuthColors } from '@/theme/auth-colors';

export default function CreateAccountScreen() {
  return (
    <AuthPlaceholderScreen
      description="Account registration will be available when Lockr is connected to its authentication service."
      icon={<UserRoundPlus color={AuthColors.accent} size={22} />}
      title="Create your account"
    />
  );
}
