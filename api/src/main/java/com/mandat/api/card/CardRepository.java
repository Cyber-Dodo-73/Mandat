package com.mandat.api.card;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CardRepository extends JpaRepository<Card, String> {

    List<Card> findBySeasonOrderByNumber(int season);

    List<Card> findBySeasonAndActiveTrue(int season);
}
