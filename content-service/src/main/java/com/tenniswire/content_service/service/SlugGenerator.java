package com.tenniswire.content_service.service;

import com.tenniswire.content_service.repository.ArticleRepository;
import com.tenniswire.content_service.repository.TagRepository;
import java.text.Normalizer;
import java.util.Map;
import java.util.function.Predicate;
import org.springframework.stereotype.Component;

@Component
public class SlugGenerator {

    private static final Map<Character, String> CYRILLIC_MAP = Map.ofEntries(
            Map.entry('а', "a"),
            Map.entry('б', "b"),
            Map.entry('в', "v"),
            Map.entry('г', "g"),
            Map.entry('д', "d"),
            Map.entry('е', "e"),
            Map.entry('ё', "yo"),
            Map.entry('ж', "zh"),
            Map.entry('з', "z"),
            Map.entry('и', "i"),
            Map.entry('й', "y"),
            Map.entry('к', "k"),
            Map.entry('л', "l"),
            Map.entry('м', "m"),
            Map.entry('н', "n"),
            Map.entry('о', "o"),
            Map.entry('п', "p"),
            Map.entry('р', "r"),
            Map.entry('с', "s"),
            Map.entry('т', "t"),
            Map.entry('у', "u"),
            Map.entry('ф', "f"),
            Map.entry('х', "kh"),
            Map.entry('ц', "ts"),
            Map.entry('ч', "ch"),
            Map.entry('ш', "sh"),
            Map.entry('щ', "shch"),
            Map.entry('ъ', ""),
            Map.entry('ы', "y"),
            Map.entry('ь', ""),
            Map.entry('э', "e"),
            Map.entry('ю', "yu"),
            Map.entry('я', "ya"));

    private final ArticleRepository articleRepository;
    private final TagRepository tagRepository;

    public SlugGenerator(ArticleRepository articleRepository, TagRepository tagRepository) {
        this.articleRepository = articleRepository;
        this.tagRepository = tagRepository;
    }

    public String generateArticleSlug(String title) {
        var base = transliterate(title);
        return ensureUnique(base, articleRepository::existsBySlug);
    }

    public String generateTagSlug(String name) {
        var base = transliterate(name);
        return ensureUnique(base, tagRepository::existsBySlug);
    }

    String transliterate(String input) {
        var sb = new StringBuilder();
        for (char c : input.toLowerCase().toCharArray()) {
            var replacement = CYRILLIC_MAP.get(c);
            if (replacement != null) {
                sb.append(replacement);
            } else {
                sb.append(c);
            }
        }

        // Normalize unicode (accented chars -> base + combining -> strip combining)
        var normalized = Normalizer.normalize(sb.toString(), Normalizer.Form.NFD);
        return normalized
                .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "") // strip accents
                .replaceAll("[^a-z0-9\\s-]", "") // keep only alphanumeric, spaces, hyphens
                .replaceAll("[\\s-]+", "-") // collapse whitespace/hyphens to single hyphen
                .replaceAll("^-|-$", ""); // trim leading/trailing hyphens
    }

    private String ensureUnique(String base, Predicate<String> exists) {
        if (!exists.test(base)) {
            return base;
        }
        for (int i = 2; i < 1000; i++) {
            var candidate = base + "-" + i;
            if (!exists.test(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Cannot generate unique slug for: " + base);
    }
}
