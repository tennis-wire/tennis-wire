plugins {
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency.management)
}

description = "User Service: reader profiles and the platform user_id behind identity provider subjects"

configurations {
    compileOnly {
        extendsFrom(configurations.annotationProcessor.get())
    }
}

dependencies {
    implementation(project(":auth-support"))

    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-restclient")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-client")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-liquibase")
    implementation(libs.springdoc.openapi.webmvc.ui)
    // WebP is not in the JDK; the JPEG reader also takes CMYK and embedded ICC profiles
    implementation(libs.twelvemonkeys.imageio.jpeg)
    implementation(libs.twelvemonkeys.imageio.webp)
    implementation(libs.aws.s3) {
        // Blocking calls over the JDK's own HTTP client: neither Apache nor Netty is needed
        exclude(group = "software.amazon.awssdk", module = "apache-client")
        exclude(group = "software.amazon.awssdk", module = "netty-nio-client")
    }
    implementation(libs.aws.url.connection.client)

    runtimeOnly("org.postgresql:postgresql")

    developmentOnly("org.springframework.boot:spring-boot-devtools")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation(libs.testcontainers.keycloak)
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

sourceSets {
    named("test") {
        resources.srcDir(rootProject.file("docker/keycloak/import"))
    }
}

// The test profile applies to every test in this module, so application-test.yaml is the one place
// test-only settings live and no test class has to remember to ask for it.
tasks.test {
    systemProperty("spring.profiles.active", "test")
}

dependencyManagement {
    imports {
        mavenBom(
            libs.aws.sdk.bom
                .get()
                .toString(),
        )
    }
}
