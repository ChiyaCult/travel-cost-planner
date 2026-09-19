FROM denoland/deno:2.5.0
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-jpn \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY deno.json ./
COPY src ./src
COPY docker-entrypoint.sh /usr/local/bin/
RUN deno cache src/main.ts && chown -R deno:deno /deno-dir
ENV DB_PATH=/data/app.sqlite PORT=8000
VOLUME /data
EXPOSE 8000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["deno", "run", "--allow-net", "--allow-read=/data", "--allow-write=/data", "--allow-env", "--allow-run=tesseract", "src/main.ts"]
