# syntax=docker/dockerfile:1
# Build context: the repository root (the image embeds the season catalog from data/).

FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace
COPY api/gradlew api/settings.gradle.kts api/build.gradle.kts ./
COPY api/gradle gradle
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon dependencies -q > /dev/null
COPY api/src src
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar -q \
    && java -Djarmode=tools -jar build/libs/api-*.jar extract --layers --launcher --destination /workspace/extracted

FROM eclipse-temurin:25-jre AS runtime
RUN groupadd --system mandat && useradd --system --gid mandat --no-create-home mandat
WORKDIR /app
COPY --from=build /workspace/extracted/dependencies/ ./
COPY --from=build /workspace/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/extracted/application/ ./
COPY data/cards.season1.json data/firstPackRules.json ./data/
ENV MANDAT_CATALOG_LOCATION=file:/app/data/cards.season1.json \
    MANDAT_CATALOG_FIRSTPACKRULESLOCATION=file:/app/data/firstPackRules.json
USER mandat
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "org.springframework.boot.loader.launch.JarLauncher"]
