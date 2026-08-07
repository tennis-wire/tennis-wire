plugins {
    java
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
    alias(libs.plugins.spotbugs) apply false
}

val spotbugsAnnotations = libs.spotbugs.annotations

allprojects {
    group = "com.tenniswire"
    version = "0.0.1-SNAPSHOT"

    repositories {
        mavenCentral()
    }
}

subprojects {
    apply(plugin = "java")
    apply(plugin = "com.github.spotbugs")
    apply(plugin = "pmd")

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
    }

    // SpotBugs settings
    configure<com.github.spotbugs.snom.SpotBugsExtension> {
        ignoreFailures = false
        showStackTraces = true
        showProgress = true
        excludeFilter = rootProject.file("spotbugs-excludes.xml")
    }

    // pmd settings
    configure<PmdExtension> {
        isConsoleOutput = true
        ruleSetFiles = files(rootProject.file("pmd.xml"))
        ruleSets = listOf() // Отключаем встроенные, используем только наш файл
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
