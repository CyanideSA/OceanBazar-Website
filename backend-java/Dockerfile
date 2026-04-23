# Build (Render runs `docker build` from the directory containing this file)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline -DskipTests || true
COPY src ./src
RUN mvn -B -DskipTests clean package \
    && mv target/*.jar /app/application.jar

# Run — Render injects PORT; Spring must listen on it (no separate "start command" in the UI)
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /app/application.jar app.jar
# Shell form so $PORT is expanded at container start
CMD java -jar app.jar --server.port=$PORT
