import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeOutUp, ZoomIn } from 'react-native-reanimated';

import { Body, Icon, Title } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { rarityStyles } from '@/theme/rarity';
import { radius, spacing } from '@/theme';

const VISIBLE_MS = 2800;
const EPIC = rarityStyles.epic.color;

/** "Ta première Épique !": big violet banner over the reveal, gone on its own. */
export function EpicBanner({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(t('ftue.epic.title'));
    const timer = setTimeout(onDone, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [onDone, t]);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.springify().damping(10)}
        exiting={reduceMotion ? undefined : FadeOutUp}
        style={[styles.banner, { backgroundColor: EPIC, shadowColor: EPIC }]}
      >
        <Icon name="sparkles" size={30} color="#FFFFFF" />
        <View style={styles.text}>
          <Title color="#FFFFFF">{t('ftue.epic.title')}</Title>
          <Body color="#FFFFFF">{t('ftue.epic.body')}</Body>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: spacing.xxl * 2, left: spacing.md, right: spacing.md, alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius,
    borderBottomWidth: 6,
    borderBottomColor: 'rgba(0,0,0,0.28)',
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  text: { flexShrink: 1, gap: 2 },
});
