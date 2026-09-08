package com.tenniswire.discussion_service.config;

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
                        .title("Tennis Wire — Discussion Service API")
                        .description("Threaded comments, peer blocks and commenting restrictions")
                        .version("1.0.0"));
    }

    @Bean
    public GroupedOpenApi discussionApi() {
        return GroupedOpenApi.builder()
                .group("discussion")
                .displayName("Discussion API")
                .pathsToMatch("/api/discussion/**")
                .build();
    }
}
