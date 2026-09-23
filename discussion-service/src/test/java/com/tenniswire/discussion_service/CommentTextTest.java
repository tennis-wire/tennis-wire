package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.dto.reader.CommentText;
import com.tenniswire.discussion_service.dto.reader.EditCommentRequest;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class CommentTextTest {

    @Test
    void takesOutWhatDrawsNothing() {
        assertThat(CommentText.clean("photo\u202Egpj.exe")).isEqualTo("photogpj.exe");
        assertThat(CommentText.clean("a\u200Bb\u2066c\u2069d\uFEFF")).isEqualTo("abcd");
    }

    @Test
    void keepsTheJoinersEmojiAreMadeOf() {
        var family = "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67";

        assertThat(CommentText.clean(family)).isEqualTo(family);
        assertThat(CommentText.clean("a\u200Cb")).isEqualTo("a\u200Cb");
    }

    @Test
    void aBodyOfNothingElseIsBlank() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            assertThat(factory.getValidator().validate(new EditCommentRequest("\u202E\u200B")))
                    .isNotEmpty();
        }
    }
}
