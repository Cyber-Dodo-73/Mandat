package com.mandat.api.pack;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PackStateRepository extends JpaRepository<PackState, UUID> {

    /** Row lock that serializes every booster opening of a player (and its idempotency check). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select state from PackState state where state.userId = :userId")
    Optional<PackState> lockByUserId(@Param("userId") UUID userId);
}
