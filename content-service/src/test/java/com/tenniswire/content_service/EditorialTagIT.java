package com.tenniswire.content_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.content_service.entity.Tag;
import com.tenniswire.content_service.entity.TagType;
import com.tenniswire.content_service.repository.TagRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class EditorialTagIT {

    private static final String TAGS = "/api/editorial/tags";

    private final Person author = new Person(UUID.randomUUID(), false);
    private final Person chief = new Person(UUID.randomUUID(), true);

    @Autowired
    private TagRepository tags;

    @Autowired
    private JsonMapper jsonMapper;

    private MockMvc mvc;
    private Tag tag;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(springSecurity())
                .build();
        var fresh = new Tag();
        fresh.name("tag-" + UUID.randomUUID());
        fresh.slug("tag-" + UUID.randomUUID());
        fresh.type(TagType.TOPIC);
        tag = tags.saveAndFlush(fresh);
    }

    @Test
    void anAuthorCreatesATag() throws Exception {
        var name = "tag-" + UUID.randomUUID();
        mvc.perform(post(TAGS)
                        .with(author.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(jsonMapper.writeValueAsString(Map.of("name", name, "type", "topic"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value(name));
    }

    @Test
    void anAuthorNeitherRenamesNorDisablesATag() throws Exception {
        update(author, Map.of("name", "tag-" + UUID.randomUUID())).andExpect(status().isForbidden());
        update(author, Map.of("isActive", false)).andExpect(status().isForbidden());
        update(author, Map.of("description", "changed")).andExpect(status().isForbidden());

        var kept = tags.findById(tag.id()).orElseThrow();
        assertThat(kept.name()).isEqualTo(tag.name());
        assertThat(kept.isActive()).isTrue();
        assertThat(kept.description()).isNull();
    }

    @Test
    void anAuthorDoesNotDeleteATag() throws Exception {
        remove(author).andExpect(status().isForbidden());

        assertThat(tags.existsById(tag.id())).isTrue();
    }

    @Test
    void aChiefEditorRenamesAndDisablesATag() throws Exception {
        var name = "tag-" + UUID.randomUUID();
        update(chief, Map.of("name", name, "isActive", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(name))
                .andExpect(jsonPath("$.isActive").value(false));
    }

    @Test
    void aChiefEditorDeletesATag() throws Exception {
        remove(chief).andExpect(status().isNoContent());

        assertThat(tags.existsById(tag.id())).isFalse();
    }

    private ResultActions update(Person who, Map<String, ?> request) throws Exception {
        return mvc.perform(patch(TAGS + "/" + tag.id())
                .with(who.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    private ResultActions remove(Person who) throws Exception {
        return mvc.perform(delete(TAGS + "/" + tag.id()).with(who.token()));
    }

    private record Person(UUID id, boolean chiefEditor) {

        RequestPostProcessor token() {
            var roles = chiefEditor
                    ? new GrantedAuthority[] {
                        new SimpleGrantedAuthority("ROLE_author"), new SimpleGrantedAuthority("ROLE_chief-editor")
                    }
                    : new GrantedAuthority[] {new SimpleGrantedAuthority("ROLE_author")};
            return jwt().jwt(token -> token.subject(id.toString())).authorities(roles);
        }
    }
}
