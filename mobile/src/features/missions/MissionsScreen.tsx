import { useState } from 'react';

import { ScreenContainer, SegmentedControl, Title } from '@/components/ui';
import { useTranslation } from '@/i18n';

import { AchievementsPanel } from './AchievementsPanel';
import { MissionsPanel } from './MissionsPanel';
import { SeasonPassPanel } from './SeasonPassPanel';

type Section = 'missions' | 'achievements' | 'pass';

/** Missions tab: daily and weekly missions, achievements and the free season pass. */
export function MissionsScreen() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('missions');
  return (
    <ScreenContainer>
      <Title>{t('missions.title')}</Title>
      <SegmentedControl<Section>
        accessibilityLabel={t('missions.sectionsA11y')}
        value={section}
        onChange={setSection}
        options={[
          { value: 'missions', label: t('missions.tab') },
          { value: 'achievements', label: t('achievements.title') },
          { value: 'pass', label: t('seasonPass.tab') },
        ]}
      />
      {section === 'missions' ? <MissionsPanel /> : null}
      {section === 'achievements' ? <AchievementsPanel /> : null}
      {section === 'pass' ? <SeasonPassPanel /> : null}
    </ScreenContainer>
  );
}
