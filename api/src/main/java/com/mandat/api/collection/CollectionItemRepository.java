package com.mandat.api.collection;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CollectionItemRepository extends JpaRepository<CollectionItem, CollectionItem.Key> {

    @Query("select item from CollectionItem item where item.key.userId = :userId order by item.key.cardId")
    List<CollectionItem> findAllOwnedBy(@Param("userId") UUID userId);
}
