FROM denoland/deno:2.5.0
WORKDIR /app
COPY deno.json ./
COPY src ./src
RUN deno cache src/main.ts
ENV DB_PATH=/data/app.sqlite PORT=8000
VOLUME /data
EXPOSE 8000
USER deno
CMD ["deno", "run", "--allow-net", "--allow-read=/data", "--allow-write=/data", "--allow-env", "src/main.ts"]
