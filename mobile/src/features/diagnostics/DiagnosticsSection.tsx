import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button3D, Caption, Card, Icon, PressableScale, SectionHeader, SettingRow, Sheet, Text } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { clearCrashJournal, formatCrashEntry, readCrashJournal, type CrashEntry } from '@/lib/crashJournal';
import { haptics } from '@/lib/haptics';
import { fontFamilies, radius, spacing, useTheme } from '@/theme';

/** Settings entry showing the on-device crash journal, to copy and send when something went wrong. */
export function DiagnosticsSection() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<CrashEntry[]>(() => readCrashJournal());
  const [open, setOpen] = useState(false);
  const latest = entries[0];

  const copy = async () => {
    await Clipboard.setStringAsync(entries.map(formatCrashEntry).join('\n\n----\n\n'));
    haptics.missionComplete();
  };
  const clear = () => {
    clearCrashJournal();
    setEntries([]);
    setOpen(false);
  };

  return (
    <View style={styles.section}>
      <SectionHeader title={t('settings.diagnostics.title')} />
      <Card>
        <PressableScale accessibilityRole="button" onPress={() => setOpen(true)}>
          <SettingRow
            icon="pulse-outline"
            label={t('settings.diagnostics.journal')}
            hint={
              latest
                ? t('settings.diagnostics.lastIncident', { date: new Date(latest.at).toLocaleString() })
                : t('settings.diagnostics.none')
            }
            control={<Icon name="chevron-forward" tone="textMuted" />}
          />
        </PressableScale>
      </Card>
      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('settings.diagnostics.journal')}
        scroll={false}
        footer={
          entries.length > 0 ? (
            <View style={styles.actions}>
              <Button3D label={t('settings.diagnostics.copy')} icon="copy-outline" fullWidth onPress={() => void copy()} />
              <Button3D label={t('settings.diagnostics.clear')} variant="ghost" size="sm" onPress={clear} />
            </View>
          ) : undefined
        }
      >
        {entries.length === 0 ? (
          <Caption>{t('settings.diagnostics.none')}</Caption>
        ) : (
          <ScrollView style={styles.log} contentContainerStyle={styles.logContent}>
            <Caption>{t('settings.diagnostics.hint')}</Caption>
            {entries.map((entry) => (
              <Report key={entry.at} entry={entry} />
            ))}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

function Report({ entry }: { entry: CrashEntry }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.report, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="caption" style={[styles.mono, { color: colors.text }]} selectable>
        {formatCrashEntry(entry)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  actions: { gap: spacing.xs },
  log: { maxHeight: 420 },
  logContent: { gap: spacing.sm, paddingBottom: spacing.md },
  report: { borderWidth: 1, borderRadius: radius, padding: spacing.sm },
  mono: { fontFamily: fontFamilies.bodyRegular, fontSize: 11, lineHeight: 15 },
});
