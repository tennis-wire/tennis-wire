plugins {
	id("org.springframework.boot")
	id("io.spring.dependency-management")
}

description = "Backend for Editorial UI: AI chat, translation"

configurations {
	compileOnly {
		extendsFrom(configurations.annotationProcessor.get())
	}
}

dependencies {
    implementation("com.anthropic:anthropic-java:2.11.1")
    implementation("com.deepl.api:deepl-java:1.14.0")

	implementation("org.springframework.boot:spring-boot-starter-validation")
	// implementation("org.springframework.boot:spring-boot-starter-webflux")
	implementation("org.springframework.boot:spring-boot-starter-web")

	developmentOnly("org.springframework.boot:spring-boot-devtools")

	testImplementation("org.springframework.boot:spring-boot-starter-test")
	testImplementation("io.projectreactor:reactor-test")
}
