package com.mandat.api.card;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/** Catalog card. Read-only for JPA: rows are written by {@link CardCatalogSeeder} only. */
@Entity
@Immutable
@Table(name = "cards")
public class Card {

    @Id
    private String id;

    private int season;
    private int number;

    @Column(name = "wikidata_id")
    private String wikidataId;

    @Column(name = "name_fr")
    private String nameFr;

    @Column(name = "name_en")
    private String nameEn;

    @Column(name = "role_fr")
    private String roleFr;

    @Column(name = "role_en")
    private String roleEn;

    private String country;
    private Continent continent;
    private Era era;

    @Column(name = "birth_year")
    private Integer birthYear;

    @Column(name = "death_year")
    private Integer deathYear;

    @Column(name = "is_living")
    private boolean living;

    @Column(name = "fame_score")
    private double fameScore;

    private Rarity rarity;

    @Column(name = "bio_fr")
    private String bioFr;

    @Column(name = "bio_en")
    private String bioEn;

    @Column(name = "stat_influence")
    private int statInfluence;

    @Column(name = "stat_diplomacy")
    private int statDiplomacy;

    @Column(name = "stat_charisma")
    private int statCharisma;

    @Column(name = "stat_strategy")
    private int statStrategy;

    @Column(name = "ability_name_fr")
    private String abilityNameFr;

    @Column(name = "ability_name_en")
    private String abilityNameEn;

    @Column(name = "ability_desc_fr")
    private String abilityDescFr;

    @Column(name = "ability_desc_en")
    private String abilityDescEn;

    private boolean sensitive;
    private String artwork;
    private boolean active;

    protected Card() {}

    public String getId() {
        return id;
    }

    public int getSeason() {
        return season;
    }

    public int getNumber() {
        return number;
    }

    public String getWikidataId() {
        return wikidataId;
    }

    public String getNameFr() {
        return nameFr;
    }

    public String getNameEn() {
        return nameEn;
    }

    public String getRoleFr() {
        return roleFr;
    }

    public String getRoleEn() {
        return roleEn;
    }

    public String getCountry() {
        return country;
    }

    public Continent getContinent() {
        return continent;
    }

    public Era getEra() {
        return era;
    }

    public Integer getBirthYear() {
        return birthYear;
    }

    public Integer getDeathYear() {
        return deathYear;
    }

    public boolean isLiving() {
        return living;
    }

    public double getFameScore() {
        return fameScore;
    }

    public Rarity getRarity() {
        return rarity;
    }

    public String getBioFr() {
        return bioFr;
    }

    public String getBioEn() {
        return bioEn;
    }

    public int getStatInfluence() {
        return statInfluence;
    }

    public int getStatDiplomacy() {
        return statDiplomacy;
    }

    public int getStatCharisma() {
        return statCharisma;
    }

    public int getStatStrategy() {
        return statStrategy;
    }

    public String getAbilityNameFr() {
        return abilityNameFr;
    }

    public String getAbilityNameEn() {
        return abilityNameEn;
    }

    public String getAbilityDescFr() {
        return abilityDescFr;
    }

    public String getAbilityDescEn() {
        return abilityDescEn;
    }

    public boolean isSensitive() {
        return sensitive;
    }

    public String getArtwork() {
        return artwork;
    }

    public boolean isActive() {
        return active;
    }
}
