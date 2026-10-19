package com.mandat.api.profile;

import com.mandat.api.card.CardFinish;
import com.mandat.api.card.CatalogProperties;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.progression.PlayerLevelProvider;
import com.mandat.api.profile.ProfileRepository.ActivityCounts;
import com.mandat.api.profile.ProfileRepository.CollectionCounts;
import com.mandat.api.profile.ProfileRepository.OwnedCard;
import com.mandat.api.profile.ProfileRepository.ProfileRow;
import com.mandat.api.profile.dto.ProfileDtos.AchievementsSummary;
import com.mandat.api.profile.dto.ProfileDtos.CardRef;
import com.mandat.api.profile.dto.ProfileDtos.CompareEntry;
import com.mandat.api.profile.dto.ProfileDtos.CompareResponse;
import com.mandat.api.profile.dto.ProfileDtos.MyProfile;
import com.mandat.api.profile.dto.ProfileDtos.ProfileStats;
import com.mandat.api.profile.dto.ProfileDtos.PublicProfile;
import com.mandat.api.profile.dto.ProfileDtos.Unlocks;
import com.mandat.api.profile.dto.ProfileDtos.UpdateProfileRequest;
import com.mandat.api.profile.dto.ProfileDtos.Visibility;
import com.mandat.api.progression.achievement.AchievementCatalog;
import com.mandat.api.progression.achievement.AchievementRepository;
import com.mandat.api.social.FriendshipRepository;
import com.mandat.api.social.PlayerLookup;
import com.mandat.api.user.User;
import com.mandat.api.user.UserService;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    /** Cosmetics everyone owns from sign-up; the rest comes from player_unlocks (progression). */
    public static final List<String> STARTER_AVATARS =
            List.of("avatar.starter_1", "avatar.starter_2", "avatar.starter_3", "avatar.starter_4");
    public static final List<String> STARTER_BANNERS = List.of("banner.default");
    public static final int SHOWCASE_SIZE = 6;
    private static final int RECENT_ACHIEVEMENTS = 6;

    private final ProfileRepository profiles;
    private final UserService users;
    private final PlayerLookup players;
    private final FriendshipRepository friendships;
    private final AchievementCatalog achievementCatalog;
    private final AchievementRepository achievements;
    private final ObjectProvider<PlayerLevelProvider> levelProvider;
    private final CatalogProperties catalog;

    ProfileService(ProfileRepository profiles, UserService users, PlayerLookup players, FriendshipRepository friendships,
            AchievementCatalog achievementCatalog, AchievementRepository achievements,
            ObjectProvider<PlayerLevelProvider> levelProvider, CatalogProperties catalog) {
        this.profiles = profiles;
        this.users = users;
        this.players = players;
        this.friendships = friendships;
        this.achievementCatalog = achievementCatalog;
        this.achievements = achievements;
        this.levelProvider = levelProvider;
        this.catalog = catalog;
    }

    @Transactional
    public MyProfile mine(UUID userId) {
        User user = users.require(userId);
        ProfileRow row = profiles.findOrCreate(userId);
        Instant lastChange = user.getNicknameChangedAt();
        Instant nextChange = lastChange == null ? null : lastChange.plus(UserService.NICKNAME_CHANGE_COOLDOWN);
        return new MyProfile(publicProfile(user, row, false), row.visibility(), unlocks(userId), nextChange);
    }

    @Transactional
    public MyProfile update(UUID userId, UpdateProfileRequest request) {
        profiles.findOrCreate(userId);
        Unlocks unlocks = unlocks(userId);
        requireUnlocked(unlocks.avatars(), request.avatarId(), "avatar");
        requireUnlocked(unlocks.banners(), request.bannerId(), "banner");
        if (request.titleId() != null) {
            requireUnlocked(unlocks.titles(), request.titleId(), "title");
        }
        if (request.favoriteCard() != null) {
            requireOwned(userId, request.favoriteCard());
        }
        List<CardRef> showcase = request.showcase();
        if (showcase.size() > SHOWCASE_SIZE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "At most " + SHOWCASE_SIZE + " showcase cards");
        }
        if (new HashSet<>(showcase).size() != showcase.size()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "The showcase lists the same card twice");
        }
        showcase.forEach(card -> requireOwned(userId, card));
        profiles.update(userId, request.avatarId(), request.bannerId(), request.titleId(), request.favoriteCard(),
                request.visibility());
        profiles.replaceShowcase(userId, showcase);
        return mine(userId);
    }

    @Transactional
    public MyProfile changeNickname(UUID userId, String nickname) {
        users.changeNickname(userId, nickname);
        return mine(userId);
    }

    /** A player's profile as seen by {@code viewerId}: private profiles are visible to friends only. */
    @Transactional
    public PublicProfile view(UUID viewerId, String friendCode) {
        User owner = players.byFriendCode(friendCode);
        ProfileRow row = profiles.findOrCreate(owner.getId());
        boolean self = owner.getId().equals(viewerId);
        boolean friend = !self && friendships.areFriends(viewerId, owner.getId());
        if (row.visibility() == Visibility.PRIVATE && !self && !friend) {
            throw new ApiException(ErrorCode.PROFILE_PRIVATE, "This profile is private");
        }
        return publicProfile(owner, row, friend);
    }

    /** Collection comparison, under the same visibility rule as the profile. */
    @Transactional
    public CompareResponse compare(UUID viewerId, String friendCode) {
        User other = players.byFriendCode(friendCode);
        view(viewerId, friendCode);
        Map<String, List<CardFinish>> mine = byCard(profiles.ownedCards(viewerId));
        Map<String, List<CardFinish>> theirs = byCard(profiles.ownedCards(other.getId()));
        int common = (int) mine.keySet().stream().filter(theirs::containsKey).count();
        return new CompareResponse(other.getFriendCode(), missing(theirs, mine), missing(mine, theirs), common);
    }

    private PublicProfile publicProfile(User user, ProfileRow row, boolean friend) {
        UUID userId = user.getId();
        return new PublicProfile(
                user.getNickname(),
                user.getFriendCode(),
                row.avatarId(),
                row.bannerId(),
                row.titleId(),
                row.favoriteCard() != null && profiles.owns(userId, row.favoriteCard()) ? row.favoriteCard() : null,
                profiles.showcase(userId),
                stats(userId),
                achievementsSummary(userId),
                friend);
    }

    private ProfileStats stats(UUID userId) {
        int season = catalog.season();
        int seasonCards = profiles.seasonCards(season);
        CollectionCounts counts = profiles.collectionCounts(userId, season);
        ActivityCounts activity = profiles.activity(userId);
        double percent = seasonCards == 0 ? 0 : Math.round(1000.0 * counts.distinctCards() / seasonCards) / 10.0;
        PlayerLevelProvider levels = levelProvider.getIfAvailable();
        return new ProfileStats(
                percent,
                counts.distinctCards(),
                seasonCards,
                activity.packsOpened(),
                activity.bestStreak(),
                levels == null ? 1 : levels.levelOf(userId),
                counts.legendaryCards(),
                counts.mythicCards(),
                activity.duelWins());
    }

    private AchievementsSummary achievementsSummary(UUID userId) {
        Map<String, Instant> unlocked = achievements.unlocked(userId);
        List<String> recent = unlocked.entrySet().stream()
                .sorted(Map.Entry.<String, Instant>comparingByValue(Comparator.reverseOrder()).thenComparing(Map.Entry.comparingByKey()))
                .limit(RECENT_ACHIEVEMENTS)
                .map(Map.Entry::getKey)
                .toList();
        return new AchievementsSummary(unlocked.size(), achievementCatalog.all().size(), recent);
    }

    private Unlocks unlocks(UUID userId) {
        return new Unlocks(
                concat(STARTER_AVATARS, profiles.unlocks(userId, "avatar")),
                concat(STARTER_BANNERS, profiles.unlocks(userId, "banner")),
                profiles.unlocks(userId, "title"));
    }

    private void requireOwned(UUID userId, CardRef card) {
        if (!profiles.owns(userId, card)) {
            throw new ApiException(ErrorCode.CARD_NOT_OWNED, "You don't own " + card.cardId() + " (" + card.finish().key() + ")");
        }
    }

    private static void requireUnlocked(List<String> unlocked, String id, String kind) {
        if (!unlocked.contains(id)) {
            throw new ApiException(ErrorCode.COSMETIC_LOCKED, "This " + kind + " is not unlocked: " + id);
        }
    }

    private static List<String> concat(List<String> base, List<String> extra) {
        return Stream.concat(base.stream(), extra.stream()).distinct().toList();
    }

    private static Map<String, List<CardFinish>> byCard(List<OwnedCard> owned) {
        return owned.stream().collect(Collectors.groupingBy(
                OwnedCard::cardId, LinkedHashMap::new, Collectors.mapping(OwnedCard::finish, Collectors.toList())));
    }

    /** Cards in {@code from} missing from {@code other}, with the finishes {@code from} owns. */
    private static List<CompareEntry> missing(Map<String, List<CardFinish>> from, Map<String, List<CardFinish>> other) {
        Set<String> otherIds = other.keySet();
        return from.entrySet().stream()
                .filter(e -> !otherIds.contains(e.getKey()))
                .map(e -> new CompareEntry(e.getKey(), e.getValue()))
                .toList();
    }
}
