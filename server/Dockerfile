# Key-holding DeepSeek proxy. Build from the repository root:
#   docker build -f server/Dockerfile -t deepseek-proxy .
#   docker run -p 8788:8788 -e DEEPSEEK_API_KEY=sk-... -e APP_TOKENS=... deepseek-proxy
FROM node:22-alpine
WORKDIR /app
COPY server/proxy.mjs ./
ENV NODE_ENV=production PORT=8788
EXPOSE 8788
USER node
HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "proxy.mjs"]
