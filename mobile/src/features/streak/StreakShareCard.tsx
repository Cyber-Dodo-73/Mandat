import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ComponentRef } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { Button3D, Text } from '@/components/ui';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { StreakFlame } from '@/features/progression/StreakFlame';
import { fontFamilies, radius, spacing } from '@/theme';

import type { StreakView } from './api';
import { streakPalette } from './palette';

/** A bright card with the streak, rendered to an image for the share sheet. */
export function StreakShareCard({ streak }: { streak: StreakView }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (!card.current) return;
    setSharing(true);
    haptics.tap();
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('streak.share.dialog'), UTI: 'public.png' });
      } else {
        await Share.share({ url: uri, message: t('streak.share.message', { count: streak.current }) });
      }
    } catch {
      haptics.error();
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View ref={card} collapsable={false}>
        <LinearGradient colors={[streakPalette.flameHot, streakPalette.flame, streakPalette.flameEdge]} style={styles.card}>
          <StreakFlame streak={streak.current} activeToday base={64} />
          <View style={styles.text}>
            <Text allowFontScaling={false} color={streakPalette.onFlame} style={styles.number}>
              {formatNumber(streak.current, language)}
            </Text>
            <Text variant="label" color={streakPalette.onFlame}>
              {t('streak.share.caption', { count: streak.current })}
            </Text>
            <Text variant="caption" color={streakPalette.onFlame}>
              {t('streak.hero.best', { count: streak.best })}
            </Text>
          </View>
          <Text allowFontScaling={false} color={streakPalette.onFlame} style={styles.brand}>
            MANDAT
          </Text>
        </LinearGradient>
      </View>
      <Button3D
        label={t('streak.share.button')}
        icon="share-social"
        variant="secondary"
        fullWidth
        loading={sharing}
        disabled={streak.current === 0}
        onPress={() => void share()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius },
  text: { flex: 1 },
  number: { fontFamily: fontFamilies.displayHeavy, fontSize: 44, lineHeight: 48 },
  brand: { position: 'absolute', right: spacing.md, top: spacing.sm, fontFamily: fontFamilies.displayHeavy, fontSize: 12, letterSpacing: 2 },
});
