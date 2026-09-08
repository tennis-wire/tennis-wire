package com.tenniswire.discussion_service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;

/**
 * Same guard as in content-service: over a real port, so the container's error dispatch to /error
 * actually happens and a 404 on a permitted path stays a 404 rather than turning into a 401.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class ErrorDispatchTest {

    @Autowired
    private Environment environment;

    @Test
    void unknownPublicPathIs404NotAnAuthError() throws Exception {
        var port = environment.getRequiredProperty("local.server.port", Integer.class);
        var url = "http://localhost:" + port + "/api/discussion/comments/" + UUID.randomUUID() + "/nope";
        var request = HttpRequest.newBuilder(URI.create(url)).GET().build();

        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding());

        assertThat(response.statusCode()).isEqualTo(404);
    }
}
