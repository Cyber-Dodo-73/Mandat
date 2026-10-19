package com.mandat.api.pack.draw;

import com.mandat.api.card.Continent;
import com.mandat.api.card.Era;
import com.mandat.api.card.Rarity;

/** What the draw engine needs to know about a catalog card. */
public record DrawCard(String id, Rarity rarity, Continent continent, Era era, boolean sensitive) {}
