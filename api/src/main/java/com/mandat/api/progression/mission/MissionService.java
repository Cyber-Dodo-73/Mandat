package com.mandat.api.progression.mission;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.progression.PlayerCalendar;
import com.mandat.api.progression.RewardGranter;
import com.mandat.api.progression.achievement.AchievementService;
import com.mandat.api.progression.mission.MissionCatalog.Period;
import com.mandat.api.progression.mission.MissionCatalog.Template;
import com.mandat.api.progression.mission.MissionRepository.MissionRow;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Daily and weekly missions: lazy deterministic assignment, progress from game events, claims. */
@Service
public class MissionService {

    private final MissionCatalog catalog;
    private final MissionRepository missions;
    private final PlayerCalendar calendar;
    private final RewardGranter rewards;
    private final AchievementService achievements;

    public MissionService(
            MissionCatalog catalog,
            MissionRepository missions,
            PlayerCalendar calendar,
            RewardGranter rewards,
            AchievementService achievements) {
        this.catalog = catalog;
        this.missions = missions;
        this.calendar = calendar;
        this.rewards = rewards;
        this.achievements = achievements;
    }

    /** Current daily and weekly period keys of the player. */
    public record Periods(String dailyKey, String weeklyKey, Instant dailyResetAt, Instant weeklyResetAt) {

        List<String> keys() {
            return List.of(dailyKey, weeklyKey);
        }
    }

    public record MissionsView(List<MissionRow> daily, List<MissionRow> weekly, Instant dailyResetAt, Instant weeklyResetAt) {}

    public Periods periods(UUID userId, Instant now) {
        ZoneId zone = calendar.zoneOf(userId);
        LocalDate today = PlayerCalendar.localDate(now, zone);
        return new Periods(
                PlayerCalendar.dailyKey(today),
                PlayerCalendar.weeklyKey(today),
                PlayerCalendar.nextDailyReset(now, zone),
                PlayerCalendar.nextWeeklyReset(now, zone));
    }

    @Transactional
    public MissionsView currentMissions(UUID userId, Instant now) {
        Periods periods = ensureAssigned(userId, now);
        List<MissionRow> rows = missions.list(userId, periods.keys());
        return new MissionsView(
                rows.stream().filter(m -> m.period() == Period.daily).toList(),
                rows.stream().filter(m -> m.period() == Period.weekly).toList(),
                periods.dailyResetAt(),
                periods.weeklyResetAt());
    }

    /** Adds progress to the player's current missions of {@code type}. Joins the event's transaction. */
    @Transactional
    public void addProgress(UUID userId, MissionType type, String param, int amount, Instant now) {
        if (amount <= 0) {
            return;
        }
        Periods periods = ensureAssigned(userId, now);
        missions.addProgress(userId, periods.keys(), type, param, amount, now);
    }

    @Transactional
    public RewardGranter.Granted claim(UUID userId, UUID missionId, Instant now) {
        Periods periods = ensureAssigned(userId, now);
        if (!missions.markClaimed(userId, missionId, periods.keys(), now)) {
            MissionRow row = missions.find(userId, missionId)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Mission not found"));
            if (row.claimedAt() != null) {
                throw new ApiException(ErrorCode.REWARD_ALREADY_CLAIMED, "Mission reward already claimed");
            }
            if (!periods.keys().contains(row.periodKey())) {
                throw new ApiException(ErrorCode.MISSION_EXPIRED, "Mission period is over");
            }
            throw new ApiException(ErrorCode.REWARD_NOT_CLAIMABLE, "Mission not completed yet");
        }
        MissionRow row = missions.find(userId, missionId).orElseThrow();
        Template template = catalog.find(row.templateId())
                .orElseThrow(() -> new IllegalStateException("Unknown mission template " + row.templateId()));
        RewardGranter.Granted granted = rewards.grant(userId, template.reward(), "mission:" + template.id(), now);
        achievements.evaluate(userId, now);
        return granted;
    }

    private Periods ensureAssigned(UUID userId, Instant now) {
        Periods periods = periods(userId, now);
        assignIfMissing(userId, Period.daily, periods.dailyKey());
        assignIfMissing(userId, Period.weekly, periods.weeklyKey());
        return periods;
    }

    private void assignIfMissing(UUID userId, Period period, String periodKey) {
        if (missions.hasMissions(userId, periodKey)) {
            return;
        }
        for (Template template : MissionAssigner.assign(catalog.pool(period), userId, periodKey)) {
            missions.insert(userId, periodKey, template);
        }
    }
}
