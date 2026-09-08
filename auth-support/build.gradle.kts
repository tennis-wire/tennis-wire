import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
    `java-library`
    alias(libs.plugins.spring.dependency.management)
}

description = "Shared JWT → authorities mapping for every resource server (auth.md §7)"

// A library, not an application: no Boot plugin, no bootJar. The BOM is still
// imported so that Spring Security here is the same version the services get
// from their own Boot plugin, and so that the version-less Lombok lines the
// root build adds to every module resolve.
dependencyManagement {
    imports {
        mavenBom(SpringBootPlugin.BOM_COORDINATES)
    }
}

dependencies {
    // api, not implementation: consumers configure JwtAuthenticationConverter
    // themselves and need its type on their compile classpath.
    api("org.springframework.security:spring-security-oauth2-resource-server")
    // jose is optional for resource-server; Jwt itself lives here.
    api("org.springframework.security:spring-security-oauth2-jose")

    testImplementation("org.junit.jupiter:junit-jupiter")
    testImplementation("org.assertj:assertj-core")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
