import { useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Booster3D, type DeviceTilt } from '@/components/pack';
import { APP_NAME } from '@/constants/app';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { packPalettes } from '@/theme/packs';

import type { PackSummary } from './types';

/** Share of the pack width each carousel step takes: neighbors peek from the sides. */
const STEP_RATIO = 0.9;

type PackCarouselProps = {
  packs: readonly PackSummary[];
  season: number;
  packWidth: number;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  /** Tapping the centered pack. */
  onOpen: (pack: PackSummary) => void;
  tilt: DeviceTilt;
};

/** Horizontal snapping shelf of 3D boosters; the centered one floats and follows the gyroscope. */
export function PackCarousel({ packs, season, packWidth, activeIndex, onActiveChange, onOpen, tilt }: PackCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const step = packWidth * STEP_RATIO;
  const scrollX = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  const changeActive = (index: number) => {
    haptics.tap();
    onActiveChange(index);
  };

  useAnimatedReaction(
    () => Math.max(0, Math.min(packs.length - 1, Math.round(scrollX.get() / step))),
    (index, previous) => {
      if (previous !== null && index !== previous) scheduleOnRN(changeActive, index);
    },
  );

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingHorizontal: (screenWidth - step) / 2 }}
    >
      {packs.map((pack, index) => (
        <CarouselItem
          key={pack.id}
          index={index}
          step={step}
          scrollX={scrollX}
          active={index === activeIndex}
          onPress={() => {
            if (index === activeIndex) onOpen(pack);
            else scrollRef.current?.scrollTo({ x: index * step, animated: true });
          }}
        >
          <PackItem pack={pack} season={season} width={packWidth} tilt={tilt} active={index === activeIndex} />
        </CarouselItem>
      ))}
    </Animated.ScrollView>
  );
}

type CarouselItemProps = {
  index: number;
  step: number;
  scrollX: SharedValue<number>;
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

function CarouselItem({ index, step, scrollX, active, onPress, children }: CarouselItemProps) {
  const style = useAnimatedStyle(() => {
    const position = scrollX.get() / step - index;
    return {
      opacity: interpolate(Math.abs(position), [0, 1], [1, 0.7], 'clamp'),
      zIndex: Math.round(10 - Math.abs(position) * 5),
      transform: [
        { perspective: 900 },
        { translateY: interpolate(Math.abs(position), [0, 1], [0, 18], 'clamp') },
        { rotateY: `${interpolate(position, [-1, 0, 1], [18, 0, -18], 'clamp')}deg` },
        { scale: interpolate(Math.abs(position), [0, 1], [1, 0.8], 'clamp') },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: step }, styles.item, style]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

type PackItemProps = { pack: PackSummary; season: number; width: number; tilt: DeviceTilt; active: boolean };

function PackItem({ pack, season, width, tilt, active }: PackItemProps) {
  const { t } = useTranslation();
  const name = t(`packs.names.${pack.theme}`);
  return (
    <View style={styles.packBox}>
      <Booster3D
        width={width}
        palette={packPalettes[pack.theme]}
        wordmark={APP_NAME}
        seasonLabel={t('packs.seasonLabel', { season })}
        title={name}
        accessibilityLabel={t('packs.packA11y', { name, season })}
        tiltX={tilt.x}
        tiltY={tilt.y}
        float={active}
        entrance={active}
        lockedLabel={pack.unlocked ? null : t('packs.lockedLevel', { level: pack.unlockLevel ?? 0 })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', justifyContent: 'center' },
  packBox: { alignItems: 'center' },
});
