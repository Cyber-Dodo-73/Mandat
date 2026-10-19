import { useMemo, useState } from 'react';
import { Linking, SectionList, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Body, Caption, PressableScale, ScreenContainer, Text, TextField } from '@/components/ui';
import { useLanguage, useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import { creditRows, matchesCredit, type CreditRow } from './credits';

/** Lists the author, license and source of every portrait shown on the cards. */
export function PhotoCreditsScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => creditRows(language), [language]);

  const sections = useMemo(() => {
    const visible = rows.filter((row) => matchesCredit(row, query));
    return [
      { key: 'attribution', title: t('credits.sections.attribution'), data: visible.filter((row) => !row.publicDomain) },
      { key: 'publicDomain', title: t('credits.sections.publicDomain'), data: visible.filter((row) => row.publicDomain) },
    ].filter((section) => section.data.length > 0);
  }, [rows, query, t]);

  return (
    <ScreenContainer edges={['top', 'bottom']} scroll={false}>
      <ScreenHeader title={t('credits.title')} />
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.cardId}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Body tone="muted">{t('credits.intro', { count: rows.length })}</Body>
            <TextField
              label={t('credits.searchLabel')}
              placeholder={t('credits.searchPlaceholder')}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text variant="label" tone="muted" style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => <CreditItem row={item} />}
        ListEmptyComponent={<Caption align="center">{t('credits.empty')}</Caption>}
      />
    </ScreenContainer>
  );
}

function CreditItem({ row }: { row: CreditRow }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const author = row.artist ?? t('credits.unknownAuthor');
  return (
    <View style={[styles.item, { borderBottomColor: colors.border }]}>
      <Text variant="bodyStrong">{row.displayName}</Text>
      <Caption numberOfLines={3}>{author}</Caption>
      <View style={styles.links}>
        {row.license ? (
          <Link url={row.licenseUrl} label={row.license} hint={t('credits.openLicense')} />
        ) : null}
        <Link url={row.sourcePage} label={t('credits.source')} hint={t('credits.openSource')} />
      </View>
    </View>
  );
}

function Link({ url, label, hint }: { url: string | null; label: string; hint: string }) {
  const { colors } = useTheme();
  if (!url) {
    return <Caption>{label}</Caption>;
  }
  return (
    <PressableScale accessibilityRole="link" accessibilityHint={hint} hitSlop={8} onPress={() => void Linking.openURL(url)}>
      <Caption color={colors.accent} style={styles.underline}>
        {label}
      </Caption>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl },
  intro: { gap: spacing.md, paddingBottom: spacing.md },
  sectionTitle: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  item: { gap: 2, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  links: { flexDirection: 'row', gap: spacing.md, paddingTop: 2 },
  underline: { textDecorationLine: 'underline' },
});
