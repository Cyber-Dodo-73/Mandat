import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Heading, Icon, PressableScale, Text } from '@/components/ui';
import { formatDate, useLanguage, useTranslation } from '@/i18n';
import { fontFamilies, useTheme } from '@/theme';

import type { StreakDayStatus } from './api';
import { addDays, isoWeekday, keptCount, monthGrid, monthStart, type CalendarDay } from './calendar';
import { dayTone } from './palette';

/** Months reachable with the 60-day history: this one and the previous one. */
const MAX_OFFSET = 1;

/** Month calendar of kept (flame), frozen (ice) and missed days. */
export function StreakCalendar({ today, statuses }: { today: string; statuses: ReadonlyMap<string, StreakDayStatus> }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [offset, setOffset] = useState(0);
  const month = monthStart(today, offset);
  const weeks = useMemo(() => monthGrid(month, today, statuses), [month, statuses, today]);
  const kept = keptCount(weeks.flat());
  const monday = addDays(today, -isoWeekday(today));
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    formatDate(new Date(`${addDays(monday, index)}T12:00:00Z`), language, { weekday: 'narrow', timeZone: 'UTC' }),
  );

  return (
    <Card>
      <View style={styles.header}>
        <MonthArrow icon="chevron-back" label={t('streak.calendar.previous')} disabled={offset >= MAX_OFFSET} onPress={() => setOffset(offset + 1)} />
        <View style={styles.title}>
          <Heading style={styles.capitalize}>
            {formatDate(new Date(`${month}T12:00:00Z`), language, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </Heading>
          <Text variant="caption" tone="muted">
            {t('streak.calendar.kept', { count: kept })}
          </Text>
        </View>
        <MonthArrow icon="chevron-forward" label={t('streak.calendar.next')} disabled={offset === 0} onPress={() => setOffset(offset - 1)} />
      </View>

      <View style={styles.row}>
        {weekdays.map((label, index) => (
          <Text key={index} variant="caption" tone="muted" align="center" style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, index) => (
        <View key={index} style={styles.row}>
          {week.map((day, column) => (
            <DayCell key={day?.date ?? `pad-${column}`} day={day} />
          ))}
        </View>
      ))}
    </Card>
  );
}

function MonthArrow({ icon, label, disabled, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} hitSlop={10} disabled={disabled} onPress={onPress}>
      <Icon name={icon} size={24} tone={disabled ? 'border' : 'text'} />
    </PressableScale>
  );
}

function DayCell({ day }: { day: CalendarDay | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!day) return <View style={styles.cell} />;
  const tone = dayTone(day.status, colors);
  const filled = day.status === 'active' || day.status === 'frozen';
  return (
    <View style={styles.cell} accessible accessibilityLabel={`${day.day} · ${t(`streak.status.${day.status}`)}`}>
      <View
        style={[
          styles.dot,
          filled ? { backgroundColor: tone.fill } : null,
          day.status === 'today' ? { borderWidth: 2, borderColor: tone.border } : null,
          day.status === 'missed' ? { backgroundColor: colors.surfaceRaised } : null,
        ]}
      >
        {day.status === 'frozen' ? (
          <Icon name="snow" size={16} color={tone.label} />
        ) : (
          <Text
            variant="caption"
            allowFontScaling={false}
            color={filled ? tone.label : day.status === 'future' ? colors.border : tone.label}
            style={filled || day.status === 'today' ? styles.strong : undefined}
          >
            {day.day}
          </Text>
        )}
      </View>
    </View>
  );
}

const DOT = 34;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { alignItems: 'center' },
  capitalize: { textTransform: 'capitalize' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, fontFamily: fontFamilies.bodyBold },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, alignItems: 'center', justifyContent: 'center' },
  strong: { fontFamily: fontFamilies.bodyBold },
});
