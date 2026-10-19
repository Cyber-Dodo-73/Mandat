import { StyleSheet, View } from 'react-native';

import { Caption, Text } from '@/components/ui';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown, useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import type { FreePackState } from './types';

const PIP = 12;

/** Free pack stock as pips, plus the countdown to the next one (server time). */
export function FreePackTimer({ state }: { state: FreePackState }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const secondsLeft = useCountdown(state.nextFreePackAt);

  return (
    <View style={styles.row}>
      <View
        accessible
        accessibilityLabel={t('packs.freePacks.stockA11y', { stock: state.stock, max: state.maxStock })}
        style={styles.pips}
      >
        {Array.from({ length: state.maxStock }, (_, index) => (
          <View
            key={index}
            style={[
              styles.pip,
              index < state.stock
                ? { backgroundColor: colors.accent, borderColor: colors.accentEdge }
                : { backgroundColor: 'transparent', borderColor: colors.border },
            ]}
          />
        ))}
      </View>
      <Text variant="label">
        {state.stock > 0 ? t('packs.freePacks.ready', { count: state.stock }) : t('packs.freePacks.empty')}
      </Text>
      <Caption>
        {state.nextFreePackAt
          ? t('packs.freePacks.next', { time: formatCountdown(secondsLeft) })
          : t('packs.freePacks.full')}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  pips: { flexDirection: 'row', gap: spacing.xxs },
  pip: { width: PIP, height: PIP, borderRadius: PIP / 2, borderWidth: 2 },
});
