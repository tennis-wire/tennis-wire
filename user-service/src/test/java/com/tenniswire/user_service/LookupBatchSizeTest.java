package com.tenniswire.user_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.tenniswire.user_service.service.ProfileService;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.env.Environment;

// Over a real port, because the limit belongs to Tomcat: it counts the request line against the
// header buffer, and MockMvc parses neither. InternalUserControllerTest shows the cap is accepted
// in memory; this shows a full batch also gets through the connector.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class LookupBatchSizeTest {

    // Stands in for the caller's bearer token, which is about this big for a Keycloak service
    // account. Not sent as Authorization: the resource server would then try to validate it.
    private static final String TOKEN_SIZED_VALUE = "x".repeat(2048);

    @Autowired
    private Environment environment;

    @Test
    void aFullBatchWithATokenSizedHeaderReachesTheApplication() throws Exception {
        var port = environment.getRequiredProperty("local.server.port", Integer.class);
        var ids = IntStream.range(0, ProfileService.MAX_LOOKUP_IDS)
                .mapToObj(i -> UUID.randomUUID().toString())
                .collect(Collectors.joining(","));
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/internal/users?ids=" + ids))
                .header("X-Token-Sized-Padding", TOKEN_SIZED_VALUE)
                .GET()
                .build();

        var response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding());

        // 401 rather than 400: Tomcat let the request through and the security chain turned it away
        // for carrying no token. Too big for the buffer, Tomcat itself would have answered 400.
        assertThat(response.statusCode()).isEqualTo(401);
    }
}
