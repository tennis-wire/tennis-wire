package com.tenniswire.content_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.tenniswire.content_service.entity.Tag;
import com.tenniswire.content_service.entity.TagType;
import com.tenniswire.content_service.repository.TagRepository;
import java.util.List;
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
class EditorialArticleIT {

    private static final String ARTICLES = "/api/editorial/articles";
    private static final String PUBLIC = "/api/public/articles/";

    private final Person author = new Person(UUID.randomUUID(), "anna", false);
    private final Person other = new Person(UUID.randomUUID(), "oleg", false);
    private final Person chief = new Person(UUID.randomUUID(), "chief", true);

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
    void aDraftExistsForItsOwnerOnly() throws Exception {
        var id = read(create(author, "Private draft"), "$.id");

        open(author, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"));
        open(other, id).andExpect(status().isNotFound());
        open(chief, id).andExpect(status().isNotFound());

        mvc.perform(get(ARTICLES).with(author.token())).andExpect(jsonPath("$.content[*].id", hasItem(id)));
        mvc.perform(get(ARTICLES).with(chief.token())).andExpect(jsonPath("$.content[*].id", not(hasItem(id))));
    }

    @Test
    void aSaveMadeFromAnOutdatedCopyIsRefused() throws Exception {
        var draft = create(author, "First");
        var id = read(draft, "$.id");
        var opened = read(draft, "$.version");

        save(author, id, opened, "news", "Second").andExpect(status().isOk());
        save(author, id, opened, "news", "Third")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("STALE_VERSION"));
    }

    @Test
    void publishingMakesTheSlugFromTheTitle() throws Exception {
        var marker = UUID.randomUUID();
        var article = published(author, "Sinner wins " + marker);

        assertThat(read(article, "$.slug")).isEqualTo("sinner-wins-" + marker);
        mvc.perform(get(PUBLIC + read(article, "$.slug")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorId").doesNotExist());
    }

    @Test
    void anEditOfAPublishedArticleStaysOffTheSiteUntilApplied() throws Exception {
        var title = "Live " + UUID.randomUUID();
        var article = published(author, title);
        var id = read(article, "$.id");
        var site = PUBLIC + read(article, "$.slug");

        var first = body(save(author, id, read(article, "$.version"), "news", "Edited once")
                .andExpect(status().isOk()));
        assertThat(read(first, "$.version")).startsWith("e:");
        mvc.perform(get(ARTICLES + "/edits").with(author.token())).andExpect(jsonPath("$.content[*].id", hasItem(id)));

        var second = body(save(author, id, read(first, "$.version"), "news", "Edited twice")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.working.title").value("Edited twice"))
                .andExpect(jsonPath("$.live.title").value(title)));
        mvc.perform(get(site)).andExpect(jsonPath("$.title").value(title));

        publish(author, id, read(second, "$.version"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.working.title").value("Edited twice"))
                .andExpect(jsonPath("$.live").doesNotExist());
        mvc.perform(get(site)).andExpect(jsonPath("$.title").value("Edited twice"));
    }

    @Test
    void whileOneHoldsAnEditTheArticleIsLockedForOthers() throws Exception {
        var article = published(author, "Locked " + UUID.randomUUID());
        var id = read(article, "$.id");
        save(author, id, read(article, "$.version"), "news", "Mine").andExpect(status().isOk());

        var seen = body(open(chief, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lockedBy").value("anna")));
        save(chief, id, read(seen, "$.version"), "news", "His")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("LOCKED"));

        mvc.perform(delete(ARTICLES + "/" + id + "/edit").with(chief.token())).andExpect(status().isNoContent());
        open(chief, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lockedBy").doesNotExist());
    }

    @Test
    void onlyItsAuthorOrAChiefEditorTouchesAPublishedArticle() throws Exception {
        var article = published(author, "Not yours " + UUID.randomUUID());
        var id = read(article, "$.id");

        open(other, id).andExpect(status().isForbidden());
        save(other, id, read(article, "$.version"), "news", "Mine now").andExpect(status().isForbidden());
        mvc.perform(get(ARTICLES + "/by-slug/" + read(article, "$.slug")).with(chief.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void unpublishingIsForAChiefEditorAndHandsTheDraftBackToItsOwner() throws Exception {
        var article = published(author, "Pulled " + UUID.randomUUID());
        var id = read(article, "$.id");
        var slug = read(article, "$.slug");

        unpublish(author, id).andExpect(status().isForbidden());

        save(author, id, read(article, "$.version"), "news", "Pending").andExpect(status().isOk());
        unpublish(chief, id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("HAS_PENDING_EDIT"));

        mvc.perform(delete(ARTICLES + "/" + id + "/edit").with(author.token())).andExpect(status().isNoContent());
        unpublish(chief, id).andExpect(status().isNoContent());

        mvc.perform(get(PUBLIC + slug)).andExpect(status().isNotFound());
        open(chief, id).andExpect(status().isNotFound());
        open(author, id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.slug").value(slug));

        // comments may hang on it
        mvc.perform(delete(ARTICLES + "/" + id).with(author.token()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("WAS_PUBLISHED"));
    }

    @Test
    void typeAndSlugAreFrozenOnceOnTheSite() throws Exception {
        var article = published(author, "Frozen " + UUID.randomUUID());

        save(author, read(article, "$.id"), read(article, "$.version"), "article", "Now an article")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("FROZEN"));
    }

    @Test
    void aTagThatDoesNotExistIsReported() throws Exception {
        var request = Map.of("type", "news", "title", "Tagged", "tagIds", List.of(UUID.randomUUID()));

        submit(author, request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("UNKNOWN_TAG"));
    }

    @Test
    void aSlugSetByHandBelongsToOneArticle() throws Exception {
        var request = Map.of("type", "news", "title", "By hand", "slug", "by-hand-" + UUID.randomUUID());

        submit(author, request).andExpect(status().isCreated());
        submit(other, request)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("SLUG_TAKEN"));
    }

    // -- Requests --

    // Not named post: a method of that name here would hide the static import
    private ResultActions submit(Person who, Map<String, ?> request) throws Exception {
        return mvc.perform(post(ARTICLES)
                .with(who.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    private String create(Person who, String title) throws Exception {
        var request = Map.of("type", "news", "title", title, "content", "<p>Body</p>", "tagIds", List.of(tag.id()));
        return body(submit(who, request).andExpect(status().isCreated()));
    }

    private String published(Person who, String title) throws Exception {
        var draft = create(who, title);
        return body(publish(who, read(draft, "$.id"), read(draft, "$.version")).andExpect(status().isOk()));
    }

    private ResultActions open(Person who, String id) throws Exception {
        return mvc.perform(get(ARTICLES + "/" + id).with(who.token()));
    }

    private ResultActions save(Person who, String id, String version, String type, String title) throws Exception {
        var request = Map.of(
                "version", version,
                "type", type,
                "title", title,
                "content", "<p>" + title + "</p>",
                "tagIds", List.of(tag.id()));
        return mvc.perform(put(ARTICLES + "/" + id)
                .with(who.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(request)));
    }

    private ResultActions publish(Person who, String id, String version) throws Exception {
        return mvc.perform(post(ARTICLES + "/" + id + "/publish")
                .with(who.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonMapper.writeValueAsString(Map.of("version", version))));
    }

    private ResultActions unpublish(Person who, String id) throws Exception {
        return mvc.perform(post(ARTICLES + "/" + id + "/unpublish").with(who.token()));
    }

    private static String body(ResultActions actions) throws Exception {
        return actions.andReturn().getResponse().getContentAsString();
    }

    private static String read(String json, String path) {
        return JsonPath.read(json, path);
    }

    // Staff are told apart by the subject; the name is what a locked article shows to others
    private record Person(UUID id, String name, boolean chiefEditor) {

        RequestPostProcessor token() {
            var roles = chiefEditor
                    ? new GrantedAuthority[] {
                        new SimpleGrantedAuthority("ROLE_author"), new SimpleGrantedAuthority("ROLE_chief-editor")
                    }
                    : new GrantedAuthority[] {new SimpleGrantedAuthority("ROLE_author")};
            return jwt().jwt(token -> token.subject(id.toString()).claim("preferred_username", name))
                    .authorities(roles);
        }
    }
}
