package com.tenniswire.content_service;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.tenniswire.content_service.entity.Article;
import com.tenniswire.content_service.entity.ArticleStatus;
import com.tenniswire.content_service.entity.ArticleType;
import com.tenniswire.content_service.repository.ArticleRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class PublicArticleRefIT {

    private static final String BY_IDS = "/api/public/articles/by-ids";

    @Autowired
    private ArticleRepository articles;

    private MockMvc mvc;

    @BeforeEach
    void bind(@Autowired WebApplicationContext context) {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private Article saved(ArticleStatus status) {
        var article = new Article();
        article.type(ArticleType.NEWS);
        article.status(status);
        article.authorId(UUID.randomUUID());
        article.title("title-" + UUID.randomUUID());
        article.slug("slug-" + UUID.randomUUID());
        if (status == ArticleStatus.PUBLISHED) {
            article.publishedAt(Instant.now());
        }
        return articles.saveAndFlush(article);
    }

    @Test
    void publishedArticlesComeBackWithEnoughToLinkThem() throws Exception {
        var published = saved(ArticleStatus.PUBLISHED);

        mvc.perform(get(BY_IDS).param("ids", published.id().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(published.id().toString()))
                .andExpect(jsonPath("$[0].type").value("news"))
                .andExpect(jsonPath("$[0].slug").value(published.slug()))
                .andExpect(jsonPath("$[0].title").value(published.title()))
                // the caller names the article, it does not render it
                .andExpect(jsonPath("$[0].tags").doesNotExist())
                .andExpect(jsonPath("$[0].content").doesNotExist());
    }

    @Test
    void whatIsNotPublishedAndWhatIsNotThereAreSimplyAbsent() throws Exception {
        var draft = saved(ArticleStatus.DRAFT);
        var published = saved(ArticleStatus.PUBLISHED);
        var gone = UUID.randomUUID();

        // no 404: a comment under a withdrawn article is still the reader's comment
        mvc.perform(get(BY_IDS).param("ids", draft.id() + "," + published.id() + "," + gone))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(published.id().toString()));
    }

    // 400 and not the 404 of a missing slug: the literal path wins over /{slug}
    @Test
    void theIdsAreRequired() throws Exception {
        mvc.perform(get(BY_IDS)).andExpect(status().isBadRequest());
    }
}
