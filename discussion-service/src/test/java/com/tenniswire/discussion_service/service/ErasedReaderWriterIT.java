package com.tenniswire.discussion_service.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.discussion_service.TestcontainersConfiguration;
import com.tenniswire.discussion_service.repository.CommentRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ErasedReaderWriterIT {

    @Autowired
    private ErasedReaderWriter writer;

    @Autowired
    private CommentService comments;

    @Autowired
    private CommentRepository rows;

    private final UUID subjectId = UUID.randomUUID();
    private final UUID alice = UUID.randomUUID();

    @Test
    void theChildsBatchMayComeFirst() {
        var parent = comments.create(alice, "article", subjectId, "his").comment();
        var child = comments.reply(alice, parent.id(), "also his").comment();

        writer.erase(List.of(child.id()));
        writer.erase(List.of(parent.id()));

        assertThat(rows.findById(child.id())).isEmpty();
        assertThat(rows.findById(parent.id())).isEmpty();
    }

    @Test
    void orTheParentsMay() {
        var parent = comments.create(alice, "article", subjectId, "his").comment();
        var child = comments.reply(alice, parent.id(), "also his").comment();

        writer.erase(List.of(parent.id()));
        // the parent is left standing by a child that is still his and still alive
        assertThat(rows.findById(parent.id()).orElseThrow().hasNoAuthor()).isTrue();

        writer.erase(List.of(child.id()));

        assertThat(rows.findById(child.id())).isEmpty();
        assertThat(rows.findById(parent.id())).isEmpty();
    }
}
