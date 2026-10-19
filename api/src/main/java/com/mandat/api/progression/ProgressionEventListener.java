package com.mandat.api.progression;

import com.mandat.api.common.events.CardCraftedEvent;
import com.mandat.api.common.events.CardsRecycledEvent;
import com.mandat.api.common.events.DuelFinishedEvent;
import com.mandat.api.common.events.PackOpenedEvent;
import com.mandat.api.common.events.QuizCompletedEvent;
import com.mandat.api.common.progression.CardInfo;
import com.mandat.api.common.progression.CardInfoProvider;
import com.mandat.api.progression.ProgressionProperties.XpGains;
import com.mandat.api.progression.achievement.AchievementService;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.mission.MissionService;
import com.mandat.api.progression.mission.MissionType;
import com.mandat.api.progression.streak.StreakService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns game events into counters, streak, XP, mission progress and achievements. Listeners are
 * synchronous: they run inside the publisher's transaction, so a failed pack opening rolls back
 * its progression too.
 */
@Component
public class ProgressionEventListener {

    private final ProgressRepository progress;
    private final XpService xp;
    private final StreakService streak;
    private final MissionService missions;
    private final AchievementService achievements;
    private final ObjectProvider<CardInfoProvider> cardInfo;
    private final XpGains gains;

    public ProgressionEventListener(
            ProgressRepository progress,
            XpService xp,
            StreakService streak,
            MissionService missions,
            AchievementService achievements,
            ObjectProvider<CardInfoProvider> cardInfo,
            ProgressionProperties properties) {
        this.progress = progress;
        this.xp = xp;
        this.streak = streak;
        this.missions = missions;
        this.achievements = achievements;
        this.cardInfo = cardInfo;
        this.gains = properties.xp();
    }

    @EventListener
    @Transactional
    public void onPackOpened(PackOpenedEvent event) {
        UUID userId = event.userId();
        Instant at = event.openedAt();
        CardInfoProvider cards = cardInfo.getIfAvailable(() -> CardInfoProvider.NONE);
        int rarePlus = (int) event.cardIds().stream()
                .map(cards::find)
                .flatMap(Optional::stream)
                .filter(CardInfo::isRareOrBetter)
                .count();
        List<String> newCards = event.newCardIds();
        Map<String, Integer> newByContinent = new TreeMap<>();
        newCards.stream()
                .map(cards::find)
                .flatMap(Optional::stream)
                .forEach(card -> newByContinent.merge(card.continent(), 1, Integer::sum));

        xp.ensure(userId);
        progress.incrementStats(userId, new PlayerStats(1, newCards.size(), rarePlus, 0, 0, 0, 0, 0, 0));
        streak.recordActivity(userId, at);
        xp.grant(userId, gains.packOpened() + gains.newCard() * newCards.size(), at);
        missions.addProgress(userId, MissionType.OPEN_PACKS, null, 1, at);
        missions.addProgress(userId, MissionType.PULL_RARE_OR_BETTER, null, rarePlus, at);
        missions.addProgress(userId, MissionType.NEW_CARDS, null, newCards.size(), at);
        newByContinent.forEach((continent, count) ->
                missions.addProgress(userId, MissionType.NEW_CARDS_FROM_CONTINENT, continent, count, at));
        achievements.evaluate(userId, at);
    }

    @EventListener
    @Transactional
    public void onQuizCompleted(QuizCompletedEvent event) {
        UUID userId = event.userId();
        Instant at = event.completedAt();
        boolean perfect = event.perfect();
        xp.ensure(userId);
        progress.incrementStats(userId, new PlayerStats(0, 0, 0, 1, perfect ? 1 : 0, 0, 0, 0, 0));
        streak.recordActivity(userId, at);
        xp.grant(userId, gains.quizCompleted() + (perfect ? gains.perfectQuizBonus() : 0), at);
        missions.addProgress(userId, MissionType.COMPLETE_QUIZ, null, 1, at);
        if (perfect) {
            missions.addProgress(userId, MissionType.PERFECT_QUIZ, null, 1, at);
        }
        achievements.evaluate(userId, at);
    }

    @EventListener
    @Transactional
    public void onDuelFinished(DuelFinishedEvent event) {
        UUID userId = event.userId();
        Instant at = event.finishedAt();
        xp.ensure(userId);
        progress.incrementStats(userId, new PlayerStats(0, 0, 0, 0, 0, 1, event.won() ? 1 : 0, 0, 0));
        xp.grant(userId, gains.duelPlayed() + (event.won() ? gains.duelWonBonus() : 0), at);
        missions.addProgress(userId, MissionType.PLAY_DUEL, null, 1, at);
        if (event.won()) {
            missions.addProgress(userId, MissionType.WIN_DUEL, null, 1, at);
        }
        achievements.evaluate(userId, at);
    }

    @EventListener
    @Transactional
    public void onCardsRecycled(CardsRecycledEvent event) {
        UUID userId = event.userId();
        Instant at = event.recycledAt();
        xp.ensure(userId);
        progress.incrementStats(userId, new PlayerStats(0, 0, 0, 0, 0, 0, 0, event.quantity(), 0));
        xp.grant(userId, gains.cardsRecycled(), at);
        missions.addProgress(userId, MissionType.RECYCLE_CARDS, null, event.quantity(), at);
        achievements.evaluate(userId, at);
    }

    @EventListener
    @Transactional
    public void onCardCrafted(CardCraftedEvent event) {
        UUID userId = event.userId();
        Instant at = event.craftedAt();
        xp.ensure(userId);
        progress.incrementStats(userId, new PlayerStats(0, 0, 0, 0, 0, 0, 0, 0, 1));
        xp.grant(userId, gains.cardCrafted(), at);
        missions.addProgress(userId, MissionType.CRAFT_CARD, null, 1, at);
        achievements.evaluate(userId, at);
    }
}
