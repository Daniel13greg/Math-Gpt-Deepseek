# Key-holding proxy

A DeepSeek key inside an app can be pulled out by anyone who installs it. For a public release, run
`proxy.mjs` on a server: it holds the key, and the app sends its requests there instead.

- **App tokens.** The app authenticates with a token you choose (put it in the app's **API key** field, or
  bake it in with `EXPO_PUBLIC_DEEPSEEK_API_KEY`). Tokens can be extracted from the app too, but unlike the
  DeepSeek key they only reach this proxy, inside its limits, and you can rotate them by changing
  `APP_TOKENS`.
- **Limits.** Requests per minute and per day for each client IP, an optional daily token budget for the
  whole server, an optional cap on output tokens, and an optional list of allowed models.
- **Streaming.** `/chat/completions` (also `/v1/chat/completions`) streams through untouched, and is
  cancelled upstream when the app disconnects (the Stop button). DeepSeek rejecting the server's own key or
  running out of balance comes back as a 502, so the app doesn't blame the user's token.
- **No dependencies**, Node 20+. Logs one line per request (token fingerprint, model, status, tokens,
  duration), never the token, the key or the messages.

## Run it

```bash
DEEPSEEK_API_KEY=sk-... APP_TOKENS=$(openssl rand -hex 24) npm run proxy
# or
docker build -f server/Dockerfile -t deepseek-proxy .
docker run -p 8788:8788 -e DEEPSEEK_API_KEY=sk-... -e APP_TOKENS=... deepseek-proxy
```

Serve it over HTTPS (any host with Node or Docker: Fly.io, Render, Railway, a VPS behind Caddy or nginx),
then in the app set **API base URL** to `https://your-proxy.example.com` and **API key** to an app token.
To ship a build that uses the proxy out of the box:

```bash
EXPO_PUBLIC_DEEPSEEK_BASE_URL=https://your-proxy.example.com \
EXPO_PUBLIC_DEEPSEEK_API_KEY=<an app token> \
npx eas-cli@latest build -p android --profile production
```

(On EAS, set these as environment variables of the build profile instead of on the command line.)

## Settings

| Variable | Default | |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | (required) | Your DeepSeek API key. |
| `APP_TOKENS` | (required) | Comma-separated tokens the app may use. |
| `ALLOW_ANONYMOUS` | `false` | `true` to accept requests without a token (limits still apply). |
| `PORT` / `HOST` | `8788` / `0.0.0.0` | Where to listen. |
| `UPSTREAM_URL` | `https://api.deepseek.com` | Where to forward requests. |
| `REQUESTS_PER_MINUTE` | `20` | Per client IP. `0` = no limit. |
| `REQUESTS_PER_DAY` | `500` | Per client IP, per UTC day. `0` = no limit. |
| `TOKENS_PER_DAY` | `0` | Total tokens (input + output) for the whole server per UTC day. `0` = no limit. |
| `MAX_OUTPUT_TOKENS` | `0` | Caps `max_tokens` on every request. `0` = leave as sent. |
| `MAX_BODY_MB` | `12` | Largest request accepted (photos are sent inline). |
| `ALLOWED_MODELS` | (any) | Comma-separated model IDs the app may use. |
| `ALLOWED_ORIGINS` | `*` | Origins allowed to call from a browser (the web build). |
| `TRUST_PROXY` | `false` | `true` behind a reverse proxy, to rate-limit by `X-Forwarded-For`. |

Limits and the budget are kept in memory: run a single instance, and they reset when it restarts. A
client behind a shared IP (school Wi-Fi, mobile carrier NAT) shares that IP's limits, so set the
per-IP limits with that in mind.

## Test

```bash
npm run test:server
```
