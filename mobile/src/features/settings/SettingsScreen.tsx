import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import {
  Button3D,
  Caption,
  Card,
  Icon,
  PressableScale,
  SectionHeader,
  SegmentedControl,
  SettingRow,
  ScreenContainer,
  Toggle,
  type IconName,
  type SegmentOption,
} from '@/components/ui';
import { openLegalPage, type LegalPage } from '@/features/legal/links';
import { NotificationPreferences } from '@/features/push/NotificationPreferences';
import { SUPPORTED_LANGUAGES, useLanguage, useTranslation, type Language } from '@/i18n';
import { spacing } from '@/theme';

import { AccountSection } from './AccountSection';
import { BlockedPlayersSection } from './BlockedPlayersSection';
import { useSettingsStore, type ThemePreference } from './store';
import { usePerfOverlay } from '@/features/dev/PerfOverlay';

const THEMES: readonly ThemePreference[] = ['system', 'dark', 'light'];

const LEGAL_ROWS: readonly { page: LegalPage; icon: IconName }[] = [
  { page: 'support', icon: 'help-buoy-outline' },
  { page: 'privacy', icon: 'shield-checkmark-outline' },
  { page: 'terms', icon: 'document-text-outline' },
  { page: 'notice', icon: 'information-circle-outline' },
];

export function SettingsScreen() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const language = useLanguage();
  const systemReduceMotion = useReducedMotion();
  const version = Constants.expoConfig?.version ?? '';

  const languageOptions: SegmentOption<Language>[] = SUPPORTED_LANGUAGES.map((language) => ({
    value: language,
    label: t(`settings.language.${language}`),
  }));
  const themeOptions: SegmentOption<ThemePreference>[] = THEMES.map((theme) => ({
    value: theme,
    label: t(`settings.theme.${theme}`),
  }));

  const followsSystemMotion = settings.reduceMotion === null;

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <ScreenHeader title={t('settings.title')} />

      <View style={styles.section}>
        <SectionHeader title={t('settings.sections.general')} />
        <Card>
          <SettingRow icon="language-outline" label={t('settings.language.label')} />
          <SegmentedControl
            accessibilityLabel={t('settings.language.label')}
            options={languageOptions}
            value={settings.language}
            onChange={settings.setLanguage}
          />
          <SettingRow icon="contrast-outline" label={t('settings.theme.label')} />
          <SegmentedControl
            accessibilityLabel={t('settings.theme.label')}
            options={themeOptions}
            value={settings.theme}
            onChange={settings.setTheme}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.sections.feedback')} />
        <Card>
          <SettingRow
            icon="volume-high-outline"
            label={t('settings.sound')}
            control={
              <Toggle
                accessibilityLabel={t('settings.sound')}
                value={settings.soundEnabled}
                onValueChange={settings.setSoundEnabled}
              />
            }
          />
          <SettingRow
            icon="phone-portrait-outline"
            label={t('settings.haptics')}
            control={
              <Toggle
                accessibilityLabel={t('settings.haptics')}
                value={settings.hapticsEnabled}
                onValueChange={settings.setHapticsEnabled}
              />
            }
          />
          <SettingRow
            icon="notifications-outline"
            label={t('settings.notifications.label')}
            hint={t('settings.notifications.hint')}
            control={
              <Toggle
                accessibilityLabel={t('settings.notifications.label')}
                value={settings.notificationsEnabled}
                onValueChange={settings.setNotificationsEnabled}
              />
            }
          />
          {settings.notificationsEnabled ? <NotificationPreferences /> : null}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('settings.sections.accessibility')} />
        <Card>
          <SettingRow
            icon="pause-circle-outline"
            label={t('settings.reduceMotion.label')}
            hint={followsSystemMotion ? t('settings.reduceMotion.hintSystem') : undefined}
            control={
              <Toggle
                accessibilityLabel={t('settings.reduceMotion.label')}
                value={settings.reduceMotion ?? systemReduceMotion}
                onValueChange={settings.setReduceMotion}
              />
            }
          />
          {followsSystemMotion ? null : (
            <Button3D
              label={t('settings.reduceMotion.followSystem')}
              variant="ghost"
              size="sm"
              onPress={() => settings.setReduceMotion(null)}
            />
          )}
        </Card>
      </View>

      <AccountSection />

      <BlockedPlayersSection />

      <View style={styles.section}>
        <SectionHeader title={t('settings.sections.about')} />
        <Card>
          {LEGAL_ROWS.map(({ page, icon }) => (
            <PressableScale
              key={page}
              accessibilityRole="link"
              accessibilityHint={t('legal.openHint')}
              onPress={() => openLegalPage(page, language)}
            >
              <SettingRow icon={icon} label={t(`legal.${page}`)} control={<Icon name="open-outline" tone="textMuted" />} />
            </PressableScale>
          ))}
          <PressableScale
            accessibilityRole="button"
            accessibilityHint={t('credits.openHint')}
            onPress={() => router.push('/credits')}
          >
            <SettingRow
              icon="camera-outline"
              label={t('credits.title')}
              hint={t('credits.settingsHint')}
              control={<Icon name="chevron-forward" tone="textMuted" />}
            />
          </PressableScale>
        </Card>
        {__DEV__ ? <PerfOverlayToggle /> : null}
        {__DEV__ ? (
          <Button3D
            label={t('dev.cards.open')}
            variant="secondary"
            size="sm"
            icon="albums-outline"
            onPress={() => router.push('/dev/cards')}
          />
        ) : null}
        <Caption align="center">{t('settings.version', { version })}</Caption>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});

/** Dev builds only: JS/UI frame-rate meter, to report lag with numbers. */
function PerfOverlayToggle() {
  const { t } = useTranslation();
  const enabled = usePerfOverlay((state) => state.enabled);
  const setEnabled = usePerfOverlay((state) => state.setEnabled);
  return (
    <SettingRow
      icon="speedometer-outline"
      label={t('dev.perfOverlay')}
      control={<Toggle accessibilityLabel={t('dev.perfOverlay')} value={enabled} onValueChange={setEnabled} />}
    />
  );
}

