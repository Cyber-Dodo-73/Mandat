package com.mandat.api.user;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class NicknamePolicyTest {

    private final NicknamePolicy policy = new NicknamePolicy();

    @ParameterizedTest
    @ValueSource(strings = {
        "Mandela_Fan", "Cléopâtre", "unique_player", "therapist", "Aryan", "Jihad", "Peacock", "SakuraTokyo",
        "Diplomate-42", "Bolívar.1819", "Toussaint"
    })
    void allowsOrdinaryNicknames(String nickname) {
        assertThat(policy.isAllowed(nickname)).as(nickname).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "Hitler", "H1tl3r", "hiiiitler", "x_Nazi_x", "N4Z1", "SiegHeil", "Führer", "kkk", "Player1488",
        "hh88", "WhitePower", "Connard", "S4l0p3", "fuckyou", "Admin", "Mandat", "pd", "Daesh_Army"
    })
    void refusesBannedNicknames(String nickname) {
        assertThat(policy.isAllowed(nickname)).as(nickname).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"ab", "averyveryverylongnickname", "has space", "emoji😀", "<script>"})
    void refusesInvalidFormats(String nickname) {
        assertThat(policy.isAllowed(nickname)).as(nickname).isFalse();
    }

    @org.junit.jupiter.api.Test
    void skeletonFoldsAccentsLeetAndRepeats() {
        assertThat(NicknamePolicy.skeleton("Ñ4ZZ-1")).isEqualTo("nazi");
    }
}
