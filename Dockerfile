# tap-studio-renderer: headless renderer for TAP video plans.
#   docker build -t tap-studio-renderer .
#   docker run --rm -p 8080:8080 -e API_TOKEN=change-me tap-studio-renderer                 # HTTP server
#   docker run --rm -v "$PWD:/work" tap-studio-renderer render --plan /work/plan.json --out /work/out.mp4
FROM node:22-bookworm-slim

# Chrome Headless Shell libraries (https://www.remotion.dev/docs/docker) + ffmpeg for loudness normalisation
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg ca-certificates tini \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
      libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# the browser Remotion renders with
RUN npx remotion browser ensure

# source, fonts and assets (everything is in the repo: no host paths, no downloads at render time)
COPY . .
RUN npm run build \
 && printf '#!/bin/sh\nexec node /app/bin/render.mjs "$@"\n' > /usr/local/bin/render && chmod +x /usr/local/bin/render

ENV NODE_ENV=production PORT=8080 JOBS_DIR=/tmp/jobs TAP_PREBUILT=1
EXPOSE 8080
ENTRYPOINT ["tini", "--"]
CMD ["node", "server/server.mjs"]
