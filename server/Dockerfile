# Key-holding model API proxy. Build from the repository root:
#   docker build -f server/Dockerfile -t math-gpt-proxy .
#   docker run -p 8788:8788 -e UPSTREAM_URL=https://... -e UPSTREAM_API_KEY=sk-... -e APP_TOKENS=... math-gpt-proxy
FROM node:22-alpine
WORKDIR /app
COPY server/proxy.mjs ./
ENV NODE_ENV=production PORT=8788
EXPOSE 8788
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "proxy.mjs"]
