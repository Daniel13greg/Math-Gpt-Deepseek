#!/usr/bin/env node
/**
 * Key-holding proxy for the model API, so a public build of the app never ships the API key.
 *
 * The app talks to this server exactly as it talks to the model API: set **Server** in Settings to the proxy
 * and put an app token in the **API key** field (or bake both in with EXPO_PUBLIC_API_BASE_URL /
 * EXPO_PUBLIC_API_KEY). The proxy checks the token, rate-limits each client, enforces an optional
 * daily token budget, and streams `/chat/completions` to UPSTREAM_URL with the real key.
 *
 *   UPSTREAM_URL=https://... UPSTREAM_API_KEY=sk-... APP_TOKENS=some-long-random-string node server/proxy.mjs
 *
 * No dependencies; Node 20 or newer. State (rate limits, budget) is in memory, so run one instance.
 * See server/README.md for every setting.
 */
import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const MINUTE = 60_000;

/** Reads the proxy's settings from environment variables. Throws if something required is missing. */
export function configFromEnv(env = process.env) {
  const list = (value) =>
    (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const number = (name, fallback) => {
    const raw = env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number (got "${raw}").`);
    return n;
  };
  const flag = (name) => /^(1|true|yes)$/i.test(env[name]?.trim() ?? '');

  const upstreamUrl = env.UPSTREAM_URL?.trim().replace(/\/+$/, '');
  if (!upstreamUrl) throw new Error('Set UPSTREAM_URL to the base URL of the model API.');
  const apiKey = env.UPSTREAM_API_KEY?.trim();
  if (!apiKey) throw new Error('Set UPSTREAM_API_KEY to the model API key.');
  const appTokens = list(env.APP_TOKENS);
  const allowAnonymous = flag('ALLOW_ANONYMOUS');
  if (appTokens.length === 0 && !allowAnonymous) {
    throw new Error('Set APP_TOKENS (comma-separated tokens the app may use), or ALLOW_ANONYMOUS=true to skip them.');
  }
  return {
    apiKey,
    appTokens,
    allowAnonymous,
    host: env.HOST?.trim() || '0.0.0.0',
    port: number('PORT', 8788),
    upstreamUrl,
    requestsPerMinute: number('REQUESTS_PER_MINUTE', 20),
    requestsPerDay: number('REQUESTS_PER_DAY', 500),
    tokensPerDay: number('TOKENS_PER_DAY', 0),
    maxOutputTokens: number('MAX_OUTPUT_TOKENS', 0),
    maxBodyBytes: number('MAX_BODY_MB', 12) * 1024 * 1024,
    allowedModels: list(env.ALLOWED_MODELS),
    allowedOrigins: list(env.ALLOWED_ORIGINS ?? '*'),
    trustProxy: flag('TRUST_PROXY'),
  };
}

const sha256 = (value) => createHash('sha256').update(value).digest();

class HttpError extends Error {
  constructor(status, message, code, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

/** Requests per client: a token bucket for the per-minute limit and a counter per UTC day. 0 = no limit. */
class RateLimiter {
  constructor(perMinute, perDay, now) {
    this.perMinute = perMinute;
    this.perDay = perDay;
    this.now = now;
    this.clients = new Map();
  }

  take(client) {
    const now = this.now();
    const day = utcDay(now);
    const entry = this.clients.get(client) ?? { tokens: this.perMinute, at: now, day, count: 0 };
    entry.tokens = Math.min(this.perMinute, entry.tokens + ((now - entry.at) * this.perMinute) / MINUTE);
    entry.at = now;
    if (entry.day !== day) Object.assign(entry, { day, count: 0 });
    this.clients.set(client, entry);

    if (this.perDay && entry.count >= this.perDay) {
      throw new HttpError(429, 'Daily request limit reached. Try again tomorrow.', 'daily_request_limit', {
        'Retry-After': String(Math.ceil((nextUtcDay(now) - now) / 1000)),
      });
    }
    if (this.perMinute && entry.tokens < 1) {
      const wait = ((1 - entry.tokens) * MINUTE) / this.perMinute;
      throw new HttpError(429, 'Too many requests. Wait a moment and try again.', 'rate_limit', {
        'Retry-After': String(Math.max(1, Math.ceil(wait / 1000))),
      });
    }
    if (this.perMinute) entry.tokens -= 1;
    entry.count += 1;
  }

  /** Forgets clients whose bucket has refilled and whose day is over. */
  prune() {
    const now = this.now();
    const day = utcDay(now);
    for (const [client, entry] of this.clients) {
      const refilled = !this.perMinute || entry.tokens + ((now - entry.at) * this.perMinute) / MINUTE >= this.perMinute;
      if (refilled && (entry.day !== day || entry.count === 0)) this.clients.delete(client);
    }
  }
}

/** Tokens used today across every client, against TOKENS_PER_DAY. */
class DailyBudget {
  constructor(limit, now) {
    this.limit = limit;
    this.now = now;
    this.day = utcDay(now());
    this.used = 0;
  }

  roll() {
    const day = utcDay(this.now());
    if (day !== this.day) Object.assign(this, { day, used: 0 });
  }

  check() {
    this.roll();
    if (this.limit && this.used >= this.limit) {
      const now = this.now();
      throw new HttpError(429, "Today's usage limit for this server has been reached. Try again tomorrow.", 'daily_budget', {
        'Retry-After': String(Math.ceil((nextUtcDay(now) - now) / 1000)),
      });
    }
  }

  add(tokens) {
    this.roll();
    this.used += tokens;
  }
}

const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const nextUtcDay = (ms) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};

/** Picks the token count out of a streamed (SSE) or plain JSON completion's `usage` as it passes through. */
class UsageMeter {
  /** `sse`: the body is a stream of `data:` lines; otherwise it is one JSON document. */
  constructor(sse) {
    this.sse = sse;
    this.decoder = new TextDecoder();
    this.buffer = '';
    this.whole = '';
    this.tokens = 0;
  }

  feed(chunk) {
    const text = this.decoder.decode(chunk, { stream: true });
    if (!this.sse) {
      if (this.whole.length < 4 * 1024 * 1024) this.whole += text;
      return;
    }
    this.buffer += text;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) this.line(line);
  }

  line(line) {
    if (!line.startsWith('data:')) return;
    this.read(line.slice(5).trim());
  }

  read(json) {
    try {
      const usage = JSON.parse(json)?.usage;
      if (!usage) return;
      const total = usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0);
      if (typeof total === 'number' && total > 0) this.tokens = total;
    } catch {
      // Not JSON ([DONE], keep-alives, partial data).
    }
  }

  end() {
    const rest = this.decoder.decode();
    if (this.sse) this.line(this.buffer + rest);
    else this.read(this.whole + rest);
    return this.tokens;
  }
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > maxBytes) return reject(new HttpError(413, 'Request is too large.', 'too_large'));
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'Request is too large.', 'too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendError(res, status, message, code, headers = {}) {
  if (res.headersSent) return res.end();
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify({ error: { message, type: status >= 500 ? 'server_error' : 'invalid_request_error', code } }));
}

/**
 * Creates (but does not start) the proxy server.
 * `fetch`, `now` and `log` can be swapped in tests.
 */
export function createProxy(config, { fetch: fetchImpl = fetch, now = Date.now, log = console.log } = {}) {
  const tokenDigests = config.appTokens.map(sha256);
  const limiter = new RateLimiter(config.requestsPerMinute, config.requestsPerDay, now);
  const budget = new DailyBudget(config.tokensPerDay, now);
  const anyOrigin = config.allowedOrigins.includes('*');

  /** A short, non-reversible label for the token in logs (the token itself is never logged). */
  const authorize = (req) => {
    const header = req.headers.authorization ?? '';
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (tokenDigests.length === 0) return 'anonymous';
    const digest = sha256(token);
    if (token && tokenDigests.some((d) => timingSafeEqual(d, digest))) return digest.toString('hex').slice(0, 8);
    throw new HttpError(401, 'Invalid app token. Check the API key in Settings.', 'invalid_token');
  };

  const clientAddress = (req) => {
    const forwarded = config.trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
    return forwarded || req.socket.remoteAddress || 'unknown';
  };

  const cors = (req, res) => {
    const origin = req.headers.origin;
    if (!origin) return;
    if (anyOrigin) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else return;
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  };

  async function completions(req, res) {
    const who = authorize(req);
    budget.check();
    limiter.take(clientAddress(req));

    let body;
    try {
      body = JSON.parse(await readBody(req, config.maxBodyBytes));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, 'Request body must be JSON.', 'invalid_json');
    }
    if (!body || typeof body.model !== 'string' || !Array.isArray(body.messages) || body.messages.length === 0) {
      throw new HttpError(400, 'Expected a chat completion request with a model and messages.', 'invalid_request');
    }
    if (config.allowedModels.length && !config.allowedModels.includes(body.model)) {
      throw new HttpError(400, `Model ${body.model} isn't available on this server.`, 'model_not_allowed');
    }
    if (config.maxOutputTokens) {
      body.max_tokens = Math.min(Number(body.max_tokens) || config.maxOutputTokens, config.maxOutputTokens);
    }
    // Needed to count tokens against the daily budget.
    if (body.stream) body.stream_options = { ...body.stream_options, include_usage: true };

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    let upstream;
    try {
      upstream = await fetchImpl(`${config.upstreamUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: body.stream ? 'text/event-stream' : 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) return { who, model: body.model, status: 499, tokens: 0 };
      log(`upstream unreachable: ${error?.message ?? error}`);
      throw new HttpError(502, 'Could not reach the model server. Try again shortly.', 'upstream_unreachable');
    }

    // The server's own key or balance is the problem: not something the app user can fix.
    if ([401, 402, 403].includes(upstream.status)) {
      const detail = (await upstream.text().catch(() => '')).slice(0, 300);
      log(`upstream rejected the server's key (${upstream.status}): ${detail}`);
      const message =
        upstream.status === 402
          ? "The server's model account is out of balance."
          : "The model server rejected the server's API key.";
      throw new HttpError(502, message, 'upstream_auth');
    }

    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    });
    const meter = new UsageMeter(/event-stream/.test(upstream.headers.get('content-type') ?? ''));
    try {
      if (upstream.body) {
        for await (const chunk of upstream.body) {
          meter.feed(chunk);
          if (controller.signal.aborted) break;
          if (!res.write(chunk)) {
            await new Promise((resolve) => {
              res.once('drain', resolve);
              res.once('close', resolve);
            });
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) log(`stream interrupted: ${error?.message ?? error}`);
    } finally {
      res.end();
    }
    const tokens = meter.end();
    budget.add(tokens);
    return { who, model: body.model, status: controller.signal.aborted ? 499 : upstream.status, tokens };
  }

  const server = createServer(async (req, res) => {
    const started = now();
    cors(req, res);
    const path = new URL(req.url ?? '/', 'http://proxy').pathname.replace(/\/+$/, '') || '/';
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      if (path === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: true }));
      }
      if (path !== '/chat/completions' && path !== '/v1/chat/completions') {
        throw new HttpError(404, 'Not found.', 'not_found');
      }
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.', 'method_not_allowed', { Allow: 'POST' });
      const result = await completions(req, res);
      log(`${result.who} ${result.model} ${result.status} ${result.tokens} tokens ${now() - started}ms`);
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status >= 500) log(`${req.method} ${path} ${error.status} ${error.code}`);
        return sendError(res, error.status, error.message, error.code, error.headers);
      }
      log(`unexpected error: ${error?.stack ?? error}`);
      sendError(res, 500, 'Something went wrong on the server.', 'internal_error');
    }
  });

  const pruner = setInterval(() => limiter.prune(), 10 * MINUTE);
  pruner.unref();
  server.on('close', () => clearInterval(pruner));
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let config;
  try {
    config = configFromEnv();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const server = createProxy(config);
  server.listen(config.port, config.host, () => {
    const auth = config.appTokens.length ? `${config.appTokens.length} app token(s)` : 'no app token (anonymous)';
    console.log(`Model proxy on http://${config.host}:${config.port} → ${config.upstreamUrl}, ${auth}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
