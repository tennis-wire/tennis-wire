plugins {
    java
    id("org.springframework.boot") version "4.0.2" apply false
    id("io.spring.dependency-management") version "1.1.7" apply false
    id("com.github.spotbugs") version "6.4.8" apply false
    pmd
}

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
    }

    // SpotBugs settings
    configure<com.github.spotbugs.snom.SpotBugsExtension> {
        ignoreFailures = false
        showStackTraces = true
        showProgress = true
        excludeFilter = rootProject.file("spotbugs-excludes.xml")
    }

    // pmd settings
    pmd {
        isConsoleOutput = true
        ruleSetFiles = files(rootProject.file("pmd.xml"))
        ruleSets = listOf() // Отключаем встроенные, используем только наш файл
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
