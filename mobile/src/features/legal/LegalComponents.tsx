import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useLanguage, useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { api, unwrap } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

import { DEFAULT_MINIMUM_AGE, openLegalPage, type LegalPage } from './links';

/** Current terms version and minimum age (public endpoint, cached for the session). */
export function useMinimumAge(): number {
  const info = useQuery({
    queryKey: ['legal'],
    queryFn: () => unwrap(api.GET('/api/v1/legal')),
    staleTime: Infinity,
  });
  return info.data?.minimumAge ?? DEFAULT_MINIMUM_AGE;
}

/** Inline links to the terms and the privacy policy (opened in the in-app browser). */
export function LegalLinks({ pages = ['terms', 'privacy'] }: { pages?: readonly LegalPage[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <View style={styles.links}>
      {pages.map((page) => (
        <PressableScale
          key={page}
          accessibilityRole="link"
          accessibilityHint={t('legal.openHint')}
          hitSlop={8}
          onPress={() => openLegalPage(page, language)}
        >
          <Text variant="caption" tone="accent">
            {t(`legal.${page}`)}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

type ConsentCheckboxProps = { checked: boolean; onChange: (checked: boolean) => void; error?: string | null };

/** "I accept the terms and I am old enough": required to create an account. */
export function ConsentCheckbox({ checked, onChange, error }: ConsentCheckboxProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const age = useMinimumAge();
  const label = t('auth.consent.label', { age });
  return (
    <View style={styles.consent}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        hitSlop={6}
        onPress={() => {
          haptics.toggle();
          onChange(!checked);
        }}
        style={styles.row}
      >
        <View
          style={[
            styles.box,
            { borderColor: error ? colors.danger : colors.border, backgroundColor: checked ? colors.accent : colors.surface },
          ]}
        >
          {checked ? <Icon name="checkmark" size={16} color={colors.onAccent} /> : null}
        </View>
        <Text variant="caption" style={styles.flex}>
          {label}
        </Text>
      </PressableScale>
      <LegalLinks />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xxs },
  consent: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: { width: 24, height: 24, borderRadius: radius, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
