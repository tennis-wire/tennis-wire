package com.tenniswire.content_service.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI openApi() {
        return new OpenAPI()
            .info(new Info()
                .title("Tennis Wire — Content Service API")
                .description("Articles, tags, and publishing for Tennis Wire")
                .version("1.0.0"));
    }

    @Bean
    public GroupedOpenApi editorialApi() {
        return GroupedOpenApi.builder()
            .group("editorial")
            .displayName("Editorial API")
            .pathsToMatch("/api/editorial/**")
            .build();
    }

    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
            .group("public")
            .displayName("Public API")
            .pathsToMatch("/api/public/**")
            .build();
    }
}
