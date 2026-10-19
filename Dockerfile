FROM eclipse-temurin:21-jre AS java
FROM node:22-bookworm-slim
COPY --from=java /opt/java/openjdk /opt/java/openjdk
RUN ln -s /opt/java/openjdk/bin/java /usr/local/bin/java
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
ENV CI=1
ENV EXPO_NO_TELEMETRY=1
WORKDIR /workspace
CMD ["npm", "test", "--", "--runInBand"]
