package com.tenniswire.discussion_service.config;

import com.tenniswire.discussion_service.security.RemoteUserIdResolver;
import com.tenniswire.discussion_service.security.UserIdResolver;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(UserServiceProperties.class)
public class UserServiceClientConfig {

    @Bean
    UserIdResolver userIdResolver(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            UserServiceProperties properties) {
        return new RemoteUserIdResolver(restClient(builder, requestFactories, properties));
    }

    public static RestClient restClient(
            RestClient.Builder builder,
            ClientHttpRequestFactoryBuilder<?> requestFactories,
            UserServiceProperties properties) {
        var settings =
                HttpClientSettings.defaults().withTimeouts(properties.connectTimeout(), properties.readTimeout());
        return builder.baseUrl(properties.baseUrl())
                .requestFactory(requestFactories.build(settings))
                .build();
    }
}
