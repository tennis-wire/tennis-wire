plugins {
    java
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
    alias(libs.plugins.spotbugs) apply false
    alias(libs.plugins.spotless) apply false
}

val spotbugsAnnotations = libs.spotbugs.annotations
val findsecbugs = libs.findsecbugs
val spotbugsToolVersion = libs.versions.spotbugs.asProvider()

allprojects {
    group = "com.tenniswire"
    version = "0.0.1-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

subprojects {
    // Spring Boot 4.1.1 manages Tomcat 11.0.24, which carries CVE-2026-65905 and the advisories
    // published with it. The dependency-management plugin reads this in place of the BOM's value.
    // Remove once Spring Boot itself manages 11.0.25 or later.
    extra["tomcat.version"] = "11.0.26"
    // Spring Boot 4.1.1 manages Jackson 3.1.5 and 2.21.5, which carry the jackson-core and
    // jackson-databind advisories of late September 2026 (CVE-2026-89407 among them). Same
    // mechanism as Tomcat above. Remove once Spring Boot manages 3.1.7 and 2.21.7 or later.
    extra["jackson-bom.version"] = "3.1.7"
    extra["jackson-2-bom.version"] = "2.21.7"

    apply(plugin = "java")
    apply(plugin = "com.github.spotbugs")
    apply(plugin = "pmd")
    apply(plugin = "com.diffplug.spotless")

    java {
        toolchain {
            languageVersion = JavaLanguageVersion.of(25)
        }
    }

    // Lombok for all modules
    dependencies {
        "compileOnly"("org.projectlombok:lombok")
        "annotationProcessor"("org.projectlombok:lombok")
        "testCompileOnly"("org.projectlombok:lombok")
        "testAnnotationProcessor"("org.projectlombok:lombok")
        "compileOnly"(spotbugsAnnotations)
        "spotbugsPlugins"(findsecbugs)
    }

    // SpotBugs settings
    configure<com.github.spotbugs.snom.SpotBugsExtension> {
        toolVersion = spotbugsToolVersion
        ignoreFailures = false
        showStackTraces = true
        showProgress = true
        excludeFilter = rootProject.file("spotbugs-excludes.xml")
    }

    // pmd settings
    configure<PmdExtension> {
        isConsoleOutput = true
        ruleSetFiles = files(rootProject.file("pmd.xml"))
        ruleSets = listOf()
    }

    // spotless settings
    configure<com.diffplug.gradle.spotless.SpotlessExtension> {
        java {
            palantirJavaFormat()
            formatAnnotations()
            removeUnusedImports()
        }
        kotlinGradle {
            ktlint()
        }
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
