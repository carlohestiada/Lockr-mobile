import { Link, useRouter } from 'expo-router';
import { LockKeyhole, Search, Settings, Star, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { useVault } from '@/contexts/vault-context';
import {
  clearVaultCredential,
  deleteVaultCredential,
  listVaultCredentials,
  updateVaultCredential,
} from '@/services/vault-credential-service';
import { assertVaultSessionActive } from '@/services/vault-session';
import type { NewVaultCredential, VaultCredential } from '@/services/vault-types';
import { AuthColors } from '@/theme/auth-colors';

export default function VaultHomeScreen() {
  const router = useRouter();
  const {
    lock,
    registerSensitiveCacheCleaner,
    session,
    touch,
  } = useVault();
  const [credentials, setCredentials] = useState<VaultCredential[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!session) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await listVaultCredentials(session);
      try {
        assertVaultSessionActive(session);
      } catch (caught) {
        next.forEach(clearVaultCredential);
        throw caught;
      }
      setCredentials((current) => {
        current.forEach(clearVaultCredential);
        return next;
      });
    } catch {
      setError('Encrypted vault records could not be opened. No plaintext was saved.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  useEffect(
    () => registerSensitiveCacheCleaner(() => {
      setCredentials((current) => {
        current.forEach(clearVaultCredential);
        return [];
      });
      setQuery('');
    }),
    [registerSensitiveCacheCleaner],
  );

  const visibleCredentials = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return credentials
      .filter((credential) => {
        if (!needle) {
          return true;
        }
        return [
          credential.title,
          credential.username,
          credential.websiteUrl,
          credential.notes,
          credential.folderName,
          ...credential.customFields.flatMap(({ name, value }) => [name, value]),
        ].join('\n').toLocaleLowerCase().includes(needle);
      })
      .sort((left, right) => Number(right.favorite) - Number(left.favorite) ||
        left.title.localeCompare(right.title));
  }, [credentials, query]);

  async function toggleFavorite(credential: VaultCredential) {
    if (!session) {
      return;
    }
    touch();
    const input: NewVaultCredential = {
      title: credential.title,
      username: credential.username,
      password: credential.password,
      websiteUrl: credential.websiteUrl,
      notes: credential.notes,
      folderName: credential.folderName,
      favorite: !credential.favorite,
      customFields: credential.customFields.map((field) => ({ ...field })),
    };
    try {
      await updateVaultCredential(session, credential.id, input);
      await reload();
    } catch {
      setError('The favorite change could not be saved.');
    }
  }

  function confirmDelete(credential: VaultCredential) {
    Alert.alert('Delete credential?', 'This removes the encrypted local record from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!session) {
            return;
          }
          void deleteVaultCredential(session, credential.id)
            .then(reload)
            .catch(() => setError('The credential could not be deleted.'));
        },
      },
    ]);
  }

  return (
    <VaultScreen
      title="Your vault"
      subtitle={`${credentials.length} encrypted ${credentials.length === 1 ? 'credential' : 'credentials'} on this device`}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vault security settings"
          onPress={() => router.push('/vault-settings')}
          style={styles.iconButton}>
          <Settings color={AuthColors.navy} size={19} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lock vault"
          onPress={() => void lock()}
          style={styles.iconButton}>
          <LockKeyhole color={AuthColors.navy} size={19} />
        </Pressable>
      </View>
      <View style={styles.searchBox}>
        <Search color={AuthColors.secondaryText} size={18} />
        <TextInput
          accessibilityLabel="Search decrypted vault contents"
          value={query}
          onChangeText={(value) => {
            touch();
            setQuery(value);
          }}
          placeholder="Search in this unlocked vault"
          placeholderTextColor={AuthColors.secondaryText}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {isLoading ? (
        <Text style={styles.secondaryText}>Opening encrypted records…</Text>
      ) : visibleCredentials.length === 0 ? (
        <Text style={styles.emptyText}>
          {query ? 'No matching credentials.' : 'Your vault is empty. Add your first credential.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {visibleCredentials.map((credential) => (
            <View key={credential.id} style={styles.credentialCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({
                  pathname: '/vault-credential',
                  params: { id: credential.id },
                })}
                style={styles.credentialBody}>
                <Text numberOfLines={1} style={styles.credentialTitle}>{credential.title}</Text>
                <Text numberOfLines={1} style={styles.secondaryText}>
                  {credential.username || credential.websiteUrl || 'Credential'}
                </Text>
                {!!credential.folderName && (
                  <Text style={styles.folder}>{credential.folderName}</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={credential.favorite ? 'Remove favorite' : 'Add favorite'}
                onPress={() => void toggleFavorite(credential)}
                style={styles.smallButton}>
                <Star
                  color={credential.favorite ? '#D08B16' : AuthColors.secondaryText}
                  fill={credential.favorite ? '#F5C45E' : 'transparent'}
                  size={18}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${credential.title}`}
                onPress={() => confirmDelete(credential)}
                style={styles.smallButton}>
                <Trash2 color={AuthColors.errorText} size={18} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
      <AuthButton
        isLoading={false}
        label="Add credential"
        onPress={() => router.push('/vault-credential')}
      />
      <SignOutButton />
      <Link href="/trusted-devices" asChild>
        <Pressable accessibilityRole="link" style={styles.trustedLink}>
          <Text style={styles.trustedLinkText}>Trusted-device recovery status</Text>
        </Pressable>
      </Link>
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AuthColors.white,
  },
  searchBox: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 12,
    backgroundColor: AuthColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchInput: {
    flex: 1,
    color: AuthColors.navy,
    fontSize: 14,
  },
  list: {
    gap: 9,
  },
  credentialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 13,
    backgroundColor: AuthColors.white,
  },
  credentialBody: {
    flex: 1,
    gap: 4,
    padding: 4,
  },
  credentialTitle: {
    color: AuthColors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryText: {
    color: AuthColors.secondaryText,
    fontSize: 13,
  },
  folder: {
    alignSelf: 'flex-start',
    marginTop: 2,
    color: AuthColors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  smallButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    paddingVertical: 28,
    color: AuthColors.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
  },
  trustedLink: {
    alignItems: 'center',
    paddingVertical: 7,
  },
  trustedLinkText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
