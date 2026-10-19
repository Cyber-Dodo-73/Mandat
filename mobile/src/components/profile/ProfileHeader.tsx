import { StyleSheet, View } from 'react-native';

import { PressableScale, Text, Title } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import { CosmeticEmblem } from './CosmeticEmblem';
import { ProfileBanner } from './ProfileBanner';
import { TitleStamp } from './TitleStamp';

const AVATAR = 84;
const RING = 4;

type ProfileHeaderProps = {
  width: number;
  nickname: string;
  friendCode: string;
  avatarId: string;
  bannerId: string;
  titleId?: string | null;
  /** Label shown before the friend code ("Code ami"). */
  codeLabel: string;
  onPressAvatar?: () => void;
  onPressBanner?: () => void;
  onPressTitle?: () => void;
  accessibilityHintAvatar?: string;
  accessibilityHintBanner?: string;
};

/**
 * Banner with the avatar seal overlapping its lower edge, then the nickname, the title stamp and
 * the friend code printed like a document number. Shared by my profile, other players' profiles
 * and the shareable image.
 */
export function ProfileHeader(props: ProfileHeaderProps) {
  const { colors } = useTheme();
  const { width, nickname, friendCode, avatarId, bannerId, titleId, codeLabel } = props;
  const formattedCode = friendCode.length === 8 ? `${friendCode.slice(0, 4)} ${friendCode.slice(4)}` : friendCode;

  return (
    <View style={styles.root}>
      <PressableScale
        disabled={!props.onPressBanner}
        onPress={props.onPressBanner}
        accessibilityRole={props.onPressBanner ? 'button' : undefined}
        accessibilityHint={props.accessibilityHintBanner}
      >
        <ProfileBanner id={bannerId} width={width} />
      </PressableScale>

      <View style={styles.identity}>
        <PressableScale
          disabled={!props.onPressAvatar}
          onPress={props.onPressAvatar}
          accessibilityRole={props.onPressAvatar ? 'button' : undefined}
          accessibilityHint={props.accessibilityHintAvatar}
          style={[styles.avatar, { backgroundColor: colors.background, borderColor: colors.brand }]}
        >
          <CosmeticEmblem kind="avatar" id={avatarId} size={AVATAR} />
        </PressableScale>

        <View style={styles.names}>
          <Title numberOfLines={1} adjustsFontSizeToFit>
            {nickname}
          </Title>
          <PressableScale disabled={!props.onPressTitle} onPress={props.onPressTitle}>
            <TitleStamp titleId={titleId} />
          </PressableScale>
        </View>
      </View>

      <View style={[styles.code, { backgroundColor: colors.surfaceRaised, borderBottomColor: colors.neutralButtonEdge }]}>
        <Text variant="caption" tone="muted">
          {codeLabel}
        </Text>
        <Text variant="label" style={styles.codeValue} selectable>
          {formattedCode}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  // The avatar overlaps the banner by a third; the name sits on the line below the banner.
  identity: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: -(AVATAR + RING * 2) / 3, paddingHorizontal: spacing.md },
  avatar: { borderRadius: AVATAR, borderWidth: RING, overflow: 'hidden' },
  names: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.xs },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius,
    borderBottomWidth: 3,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    marginHorizontal: spacing.md,
  },
  codeValue: { letterSpacing: 2, fontVariant: ['tabular-nums'] },
});
