package com.mandat.api.user;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Server-side nickname filter (FR + EN, extremist references, slurs, staff impersonation).
 * Reused by every place a nickname can be set (registration, social sign-up, profile edits).
 */
@Component
public class NicknamePolicy {

    public static final String FORMAT_REGEX = "^[\\p{L}\\p{N}_.\\-]{3,20}$";
    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 20;

    static final String WORD_LIST = "moderation/banned-nicknames.txt";

    private static final Pattern FORMAT = Pattern.compile(FORMAT_REGEX);
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern SEPARATORS = Pattern.compile("[\\s_.\\-/]+");
    private static final Pattern REPEATED = Pattern.compile("(\\p{L})\\1+");
    private static final Pattern NON_LETTERS = Pattern.compile("[^\\p{L}]+");
    private static final Map<Character, Character> LEET = Map.ofEntries(
            Map.entry('0', 'o'), Map.entry('1', 'i'), Map.entry('3', 'e'), Map.entry('4', 'a'),
            Map.entry('5', 's'), Map.entry('6', 'g'), Map.entry('7', 't'), Map.entry('8', 'b'),
            Map.entry('9', 'g'), Map.entry('@', 'a'), Map.entry('$', 's'), Map.entry('!', 'i'),
            Map.entry('|', 'i'), Map.entry('€', 'e'), Map.entry('£', 'l'), Map.entry('+', 't'));

    private final Set<String> substrings = new HashSet<>();
    private final Set<String> exact = new HashSet<>();
    private final Set<String> codes = new HashSet<>();

    public NicknamePolicy() {
        load(new ClassPathResource(WORD_LIST));
    }

    /** True when the nickname has a valid format and no banned content. */
    public boolean isAllowed(String nickname) {
        if (nickname == null || !FORMAT.matcher(nickname).matches()) {
            return false;
        }
        String raw = SEPARATORS.matcher(nickname.toLowerCase(Locale.ROOT)).replaceAll("");
        if (codes.stream().anyMatch(raw::contains)) {
            return false;
        }
        String skeleton = skeleton(nickname);
        if (exact.contains(skeleton)) {
            return false;
        }
        return substrings.stream().noneMatch(skeleton::contains);
    }

    /** @throws ApiException {@link ErrorCode#NICKNAME_FORBIDDEN} when the nickname is refused */
    public void requireAllowed(String nickname) {
        if (!isAllowed(nickname)) {
            throw new ApiException(ErrorCode.NICKNAME_FORBIDDEN, "This nickname is not allowed");
        }
    }

    /** Lowercase, accent-free, leetspeak-decoded letters with repeated letters collapsed. */
    static String skeleton(String value) {
        String folded = DIACRITICS.matcher(Normalizer.normalize(value, Normalizer.Form.NFD)).replaceAll("");
        StringBuilder decoded = new StringBuilder(folded.length());
        for (char c : folded.toLowerCase(Locale.ROOT).toCharArray()) {
            decoded.append(LEET.getOrDefault(c, c));
        }
        String letters = NON_LETTERS.matcher(decoded).replaceAll("");
        return REPEATED.matcher(letters).replaceAll("$1");
    }

    private void load(ClassPathResource resource) {
        try (InputStream in = resource.getInputStream()) {
            List<String> lines = new String(in.readAllBytes(), StandardCharsets.UTF_8).lines().toList();
            Set<String> target = null;
            for (String line : lines) {
                String entry = line.strip();
                if (entry.isEmpty() || entry.startsWith("#")) {
                    continue;
                }
                switch (entry) {
                    case "[substring]" -> target = substrings;
                    case "[exact]" -> target = exact;
                    case "[codes]" -> target = codes;
                    default -> {
                        if (target == null) {
                            throw new IllegalStateException("Entry outside a section in " + WORD_LIST + ": " + entry);
                        }
                        target.add(target == codes
                                ? SEPARATORS.matcher(entry.toLowerCase(Locale.ROOT)).replaceAll("")
                                : skeleton(entry));
                    }
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + WORD_LIST, e);
        }
    }
}
