plugins {
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency.management)
}

description = "API Gateway for Tennis Wire"

dependencies {
    implementation("org.springframework.cloud:spring-cloud-starter-gateway-server-webflux")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.cloud:spring-cloud-starter-circuitbreaker-reactor-resilience4j")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("io.projectreactor:reactor-test")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation(libs.testcontainers.keycloak)
    testImplementation(libs.wiremock.standalone)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// GatewayKeycloakIT imports the same realm file docker-compose does, so the two
// cannot drift apart.
sourceSets {
    named("test") {
        resources.srcDir(rootProject.file("docker/keycloak/import"))
    }
}

dependencyManagement {
    imports {
        mavenBom(
            libs.spring.cloud.bom
                .get()
                .toString(),
        )
    }
}
