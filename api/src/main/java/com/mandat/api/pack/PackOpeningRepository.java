package com.mandat.api.pack;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PackOpeningRepository extends JpaRepository<PackOpening, UUID> {

    Optional<PackOpening> findByUserIdAndIdempotencyKey(UUID userId, String idempotencyKey);
}
