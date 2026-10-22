plugins {
    java
    id("org.springframework.boot") version "4.1.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "com.mandat"
version = "0.1.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    // Transactional emails (password reset). Inactive until MANDAT_SMTP_HOST is set.
    implementation("org.springframework.boot:spring-boot-starter-mail")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.1")
    implementation("com.bucket4j:bucket4j_jdk17-core:8.21.0")
    implementation("com.github.ben-manes.caffeine:caffeine")
    // Error reporting (Sentry). Inactive until SENTRY_DSN is set; ERROR logs and unhandled
    // exceptions then become events, with the request route attached.
    implementation("io.sentry:sentry-spring-boot-4-starter:8.61.1")
    implementation("io.sentry:sentry-logback:8.61.1")
    // Argon2 password hashing (Spring Security's Argon2PasswordEncoder relies on Bouncy Castle).
    implementation("org.bouncycastle:bcprov-jdk18on:1.86")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
    testImplementation("org.springframework.boot:spring-boot-testcontainers")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile> {
    options.compilerArgs.addAll(listOf("-parameters", "-Xlint:all", "-Werror"))
}

tasks.withType<Test> {
    useJUnitPlatform()
    // Mockito's inline agent and Testcontainers' JNA need these on recent JDKs.
    jvmArgs("-XX:+EnableDynamicAgentLoading", "--enable-native-access=ALL-UNNAMED", "-Xshare:off")
}

// Writes the OpenAPI spec consumed by the mobile client generator.
tasks.register<Test>("exportOpenApi") {
    description = "Exports the OpenAPI spec to api/openapi.json"
    group = "documentation"
    testClassesDirs = sourceSets.test.get().output.classesDirs
    classpath = sourceSets.test.get().runtimeClasspath
    useJUnitPlatform { includeTags("openapi") }
    systemProperty("openapi.output", layout.projectDirectory.file("openapi.json").asFile.absolutePath)
    outputs.upToDateWhen { false }
}

tasks.named<Test>("test") {
    useJUnitPlatform { excludeTags("openapi") }
}

// Only the executable boot jar is needed.
tasks.named<Jar>("jar") {
    enabled = false
}
