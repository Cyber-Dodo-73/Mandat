import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CosmeticEmblem } from '@/components/profile/CosmeticEmblem';
import { ProfileBanner } from '@/components/profile/ProfileBanner';
import { Caption, Icon, PressableScale, Sheet, Text } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import { useTitleLabel } from './titles';

export type PickerKind = 'avatar' | 'banner' | 'title';

type CosmeticPickerSheetProps = {
  kind: PickerKind | null;
  options: readonly string[];
  selected: string | null | undefined;
  onSelect: (id: string | null) => void;
  onClose: () => void;
};

/** Pick an unlocked avatar, banner or title. New ones come from levels, achievements and the season pass. */
export function CosmeticPickerSheet({ kind, options, selected, onSelect, onClose }: CosmeticPickerSheetProps) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const title = kind ? t(`profile.picker.${kind}` as 'profile.picker.avatar') : '';

  return (
    <Sheet visible={kind !== null} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={styles.content}>
        {kind === 'avatar' ? (
          <View style={styles.grid}>
            {options.map((id) => (
              <Choice key={id} selected={id === selected} onPress={() => onSelect(id)} label={t('profile.picker.avatarOption')}>
                <CosmeticEmblem kind="avatar" id={id} size={72} />
              </Choice>
            ))}
          </View>
        ) : null}
        {kind === 'banner' ? <BannerChoices options={options} selected={selected} onSelect={onSelect} /> : null}
        {kind === 'title' ? (
          <View style={styles.list}>
            <TitleRow id={null} selected={!selected} onPress={() => onSelect(null)} />
            {options.map((id) => (
              <TitleRow key={id} id={id} selected={id === selected} onPress={() => onSelect(id)} />
            ))}
          </View>
        ) : null}
        <Caption>{t('profile.picker.unlockMore')}</Caption>
      </ScrollView>
    </Sheet>
  );
}

function BannerChoices({ options, selected, onSelect }: Pick<CosmeticPickerSheetProps, 'options' | 'selected' | 'onSelect'>) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const bannerWidth = width - spacing.lg * 2 - spacing.xs * 2;
  return (
    <View style={styles.list}>
      {options.map((id) => (
        <Choice key={id} selected={id === selected} onPress={() => onSelect(id)} label={t('profile.picker.bannerOption')}>
          <ProfileBanner id={id} width={bannerWidth} />
        </Choice>
      ))}
    </View>
  );
}

function TitleRow({ id, selected, onPress }: { id: string | null; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const label = useTitleLabel(id) ?? t('profile.picker.noTitle');
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.row, { backgroundColor: colors.surfaceRaised, borderColor: selected ? colors.accent : 'transparent' }]}
    >
      <Icon name={id ? 'ribbon' : 'remove-circle-outline'} size={20} tone={selected ? 'accent' : 'textMuted'} />
      <Text variant="bodyStrong" style={styles.flex}>
        {label}
      </Text>
      {selected ? <Icon name="checkmark-circle" size={22} tone="accent" /> : null}
    </PressableScale>
  );
}

function Choice({
  selected,
  onPress,
  label,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, { borderColor: selected ? colors.accent : 'transparent' }]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
  choice: { borderWidth: 2, borderRadius: radius, padding: spacing.xxs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  flex: { flex: 1 },
});
