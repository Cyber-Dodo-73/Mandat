package com.mandat.api.progression.mission;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.progression.mission.MissionCatalog.Period;
import com.mandat.api.progression.mission.MissionCatalog.Template;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MissionAssignerTest {

    private final MissionCatalog catalog = new MissionCatalog();

    @Test
    void assignmentIsDeterministicPerUserAndPeriod() {
        UUID user = UUID.fromString("7d0f4a8e-0000-4000-8000-000000000001");
        List<Template> first = MissionAssigner.assign(catalog.pool(Period.daily), user, "D:2026-10-19");
        List<Template> second = MissionAssigner.assign(catalog.pool(Period.daily), user, "D:2026-10-19");
        assertThat(first).hasSize(3).isEqualTo(second);
    }

    @Test
    void missionsOfOnePeriodHaveDistinctTypes() {
        for (int i = 0; i < 200; i++) {
            UUID user = UUID.nameUUIDFromBytes(("user-" + i).getBytes());
            for (Period period : Period.values()) {
                List<Template> picked = MissionAssigner.assign(catalog.pool(period), user, "K:" + i);
                assertThat(picked).hasSize(3);
                assertThat(picked.stream().map(Template::type).distinct()).hasSize(3);
                assertThat(picked).allMatch(t -> t.period() == period);
            }
        }
    }

    @Test
    void assignmentsVaryAcrossDaysAndUsers() {
        UUID user = UUID.nameUUIDFromBytes("someone".getBytes());
        Set<List<String>> seen = new HashSet<>();
        for (int day = 1; day <= 20; day++) {
            seen.add(ids(MissionAssigner.assign(catalog.pool(Period.daily), user, "D:2026-10-" + day)));
        }
        assertThat(seen.size()).isGreaterThan(10);
    }

    private static List<String> ids(List<Template> templates) {
        return templates.stream().map(Template::id).toList();
    }
}
