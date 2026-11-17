import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { VaultScreen } from '@/components/vault/vault-screen';
import { VaultTextField } from '@/components/vault/vault-text-field';
import { useVault } from '@/contexts/vault-context';
import {
  clearVaultCredential,
  createVaultCredential,
  listVaultCredentials,
  updateVaultCredential,
} from '@/services/vault-credential-service';
import { assertVaultSessionActive } from '@/services/vault-session';
import type { NewVaultCredential, VaultCredential } from '@/services/vault-types';
import { AuthColors } from '@/theme/auth-colors';

const EMPTY_FIELDS: NewVaultCredential = {
  title: '',
  username: '',
  password: '',
  websiteUrl: '',
  notes: '',
  folderName: '',
  favorite: false,
  customFields: [],
};

export default function VaultCredentialScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { registerSensitiveCacheCleaner, session, touch } = useVault();
  const [fields, setFields] = useState<NewVaultCredential>(EMPTY_FIELDS);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearForm = useCallback(() => {
    setFields({ ...EMPTY_FIELDS, customFields: [] });
  }, []);

  useEffect(
    () => registerSensitiveCacheCleaner(clearForm),
    [clearForm, registerSensitiveCacheCleaner],
  );

  useEffect(() => {
    if (!id || !session) {
      return;
    }
    let active = true;
    void listVaultCredentials(session)
      .then((credentials) => {
        const selected = credentials.find((credential) => credential.id === id);
        credentials.filter((credential) => credential !== selected).forEach(clearVaultCredential);
        if (!active) {
          if (selected) {
            clearVaultCredential(selected);
          }
          return;
        }
        if (selected) {
          try {
            assertVaultSessionActive(session);
            const editable: NewVaultCredential = {
              title: selected.title,
              username: selected.username,
              password: selected.password,
              websiteUrl: selected.websiteUrl,
              notes: selected.notes,
              folderName: selected.folderName,
              favorite: selected.favorite,
              customFields: selected.customFields.map((field) => ({ ...field })),
            };
            setFields(editable);
          } finally {
            clearVaultCredential(selected);
          }
        } else {
          setError('This credential is not available in the local vault.');
        }
      })
      .catch(() => {
        if (active) {
          setError('The encrypted credential could not be opened.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, session]);

  function updateField<K extends keyof NewVaultCredential>(
    key: K,
    value: NewVaultCredential[K],
  ) {
    touch();
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!session || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (id) {
        await updateVaultCredential(session, id, fields);
      } else {
        const created: VaultCredential = await createVaultCredential(session, fields);
        clearVaultCredential(created);
      }
      clearForm();
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The credential could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  function addCustomField() {
    updateField('customFields', [...fields.customFields, { name: '', value: '' }]);
  }

  function updateCustomField(index: number, key: 'name' | 'value', value: string) {
    updateField(
      'customFields',
      fields.customFields.map((field, currentIndex) =>
        currentIndex === index ? { ...field, [key]: value } : field,
      ),
    );
  }

  return (
    <VaultScreen
      title={id ? 'Edit credential' : 'Add credential'}
      subtitle="Fields are encrypted before being written to this device.">
      {isLoading ? (
        <Text style={styles.info}>Opening encrypted credential…</Text>
      ) : (
        <>
          <VaultTextField
            label="Title"
            value={fields.title}
            onChangeText={(value) => updateField('title', value)}
            placeholder="e.g. Email account"
            autoCapitalize="sentences"
          />
          <VaultTextField
            label="Username or email"
            value={fields.username}
            onChangeText={(value) => updateField('username', value)}
            autoCapitalize="none"
            textContentType="username"
            placeholder="Username"
          />
          <VaultTextField
            label="Password"
            value={fields.password}
            onChangeText={(value) => updateField('password', value)}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            placeholder="Password"
          />
          <VaultTextField
            label="Website URL"
            value={fields.websiteUrl}
            onChangeText={(value) => updateField('websiteUrl', value)}
            keyboardType="url"
            autoCapitalize="none"
            placeholder="https://example.com"
          />
          <VaultTextField
            label="Folder"
            value={fields.folderName}
            onChangeText={(value) => updateField('folderName', value)}
            placeholder="Optional folder name"
          />
          <VaultTextField
            label="Notes"
            value={fields.notes}
            onChangeText={(value) => updateField('notes', value)}
            multiline
            placeholder="Private notes"
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: fields.favorite }}
            onPress={() => updateField('favorite', !fields.favorite)}
            style={styles.favoriteRow}>
            <Text style={styles.favoriteText}>{fields.favorite ? '★ Favorite' : '☆ Mark favorite'}</Text>
          </Pressable>
          <View style={styles.customHeading}>
            <Text style={styles.sectionTitle}>Custom fields</Text>
            <Pressable accessibilityRole="button" onPress={addCustomField} style={styles.addField}>
              <Plus color={AuthColors.accent} size={16} />
              <Text style={styles.addFieldText}>Add field</Text>
            </Pressable>
          </View>
          {fields.customFields.map((field, index) => (
            <View key={index} style={styles.customField}>
              <VaultTextField
                label="Field name"
                value={field.name}
                onChangeText={(value) => updateCustomField(index, 'name', value)}
                placeholder="e.g. Account number"
              />
              <VaultTextField
                label="Field value"
                value={field.value}
                onChangeText={(value) => updateCustomField(index, 'value', value)}
                placeholder="Private value"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove custom field"
                onPress={() => updateField(
                  'customFields',
                  fields.customFields.filter((_item, currentIndex) => currentIndex !== index),
                )}
                style={styles.removeField}>
                <X color={AuthColors.errorText} size={18} />
              </Pressable>
            </View>
          ))}
          {error && <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <AuthButton
            isLoading={isSaving}
            isDisabled={!fields.title.trim()}
            label={id ? 'Save changes' : 'Save encrypted credential'}
            onPress={() => void handleSave()}
          />
        </>
      )}
    </VaultScreen>
  );
}

const styles = StyleSheet.create({
  info: {
    color: AuthColors.secondaryText,
    fontSize: 14,
  },
  favoriteRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  favoriteText: {
    color: AuthColors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  customHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: AuthColors.navy,
    fontSize: 15,
    fontWeight: '700',
  },
  addField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  addFieldText: {
    color: AuthColors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  customField: {
    gap: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: AuthColors.border,
    borderRadius: 12,
    backgroundColor: AuthColors.white,
  },
  removeField: {
    alignSelf: 'flex-end',
    padding: 6,
  },
  error: {
    color: AuthColors.errorText,
    fontSize: 13,
    lineHeight: 19,
  },
});
