package com.tenniswire.editorial_bff.config;

import com.deepl.api.DeepLClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DeepLClientConfig {

    /**
     * Creates a singleton DeepLClient.
     *
     * <p>API key is resolved from the {@code DEEPL_AUTH_KEY} environment variable
     * via the {@code deepl.auth-key} property. If not set, the client is created
     * with an empty key and will fail at request time (not at startup),
     * allowing tests to load the application context.
     */
    @Bean
    @ConditionalOnExpression("'${deepl.auth-key:}' != ''")
    public DeepLClient deepLClient(@Value("${deepl.auth-key:}") String authKey) {
        return new DeepLClient(authKey);
    }
}
