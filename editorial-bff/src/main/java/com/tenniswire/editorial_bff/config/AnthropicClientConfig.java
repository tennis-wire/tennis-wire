package com.tenniswire.editorial_bff.config;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AnthropicClientConfig {

    /**
     * Creates a singleton AnthropicClient.
     *
     * <p>API key is resolved automatically from the {@code ANTHROPIC_API_KEY}
     * environment variable. The SDK recommends creating only one client instance
     * per application (connection pool and thread pools are shared).
     */
    @Bean
    public AnthropicClient anthropicClient() {
        return AnthropicOkHttpClient.fromEnv();
    }
}
