import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, PressableScale, Title } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';

type ScreenHeaderProps = {
  title: string;
  /** "back" for pushed screens, "close" for modals. */
  dismiss?: 'back' | 'close';
};

export function ScreenHeader({ title, dismiss = 'back' }: ScreenHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t(dismiss === 'back' ? 'common.back' : 'common.close')}
        hitSlop={12}
        onPress={() => router.back()}
      >
        <Icon name={dismiss === 'back' ? 'arrow-back' : 'close'} size={28} />
      </PressableScale>
      <Title numberOfLines={1} style={styles.title}>
        {title}
      </Title>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
});
