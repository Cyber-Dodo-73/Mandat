package com.mandat.api.pack.draw;

import com.mandat.api.card.CardFinish;
import java.util.List;

/** Result of drawing one booster, slot order preserved (slot 5 last). */
public record PackDraw(List<DrawnCard> cards, PityCounters pityAfter) {

    public record DrawnCard(DrawCard card, CardFinish finish) {}
}
