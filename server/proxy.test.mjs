// Run with `npm run test:server` (Node's built-in test runner).
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

import { configFromEnv, createProxy } from './proxy.mjs';

const SSE = [
  'data: {"choices":[{"delta":{"reasoning_content":"Think."}}]}',
  'data: {"choices":[{"delta":{"content":"Hello"}}]}',
  'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":30,"total_tokens":40}}',
  'data: [DONE]',
  '',
].join('\n\n');

/** A stand-in for the model API that records what it receives. */
function fakeUpstream() {
  const state = { requests: [], status: 200, reply: SSE, contentType: 'text/event-stream', hang: false, closed: 0 };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    state.requests.push({ headers: req.headers, body: JSON.parse(Buffer.concat(chunks).toString()) });
    res.on('close', () => (state.closed += 1));
    res.writeHead(state.status, { 'Content-Type': state.contentType });
    if (state.hang) return res.write('data: {"choices":[{"delta":{"content":"…"}}]}\n\n');
    res.end(state.reply);
  });
  return { server, state };
}

/** Closes a server without waiting for open (e.g. still-streaming) connections. */
function shut(server) {
  server?.closeAllConnections();
  server?.close();
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

const config = (overrides = {}) => ({
  ...configFromEnv({ UPSTREAM_URL: 'http://upstream.test', UPSTREAM_API_KEY: 'sk-server', APP_TOKENS: 'token-a,token-b' }),
  ...overrides,
});

const request = { model: 'math-model', messages: [{ role: 'user', content: 'Hi' }], stream: true };

describe('proxy', () => {
  const upstream = fakeUpstream();
  let upstreamUrl;
  let proxy;
  let url;
  let clock;
  let logs;

  before(async () => {
    upstreamUrl = await listen(upstream.server);
  });
  after(() => shut(upstream.server));

  /** (Re)starts the proxy with the given overrides. */
  async function start(overrides = {}) {
    shut(proxy);
    clock = Date.UTC(2026, 9, 1, 12);
    logs = [];
    proxy = createProxy(config({ upstreamUrl, ...overrides }), { now: () => clock, log: (line) => logs.push(line) });
    url = await listen(proxy);
  }
  beforeEach(async () => {
    Object.assign(upstream.state, { requests: [], status: 200, reply: SSE, contentType: 'text/event-stream', hang: false, closed: 0 });
    await start();
  });
  after(() => shut(proxy));

  const post = (body = request, token = 'token-a', headers = {}) =>
    fetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  test('streams the completion through with the server key, never the app token', async () => {
    const res = await post();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    assert.equal(await res.text(), SSE);

    const [sent] = upstream.state.requests;
    assert.equal(sent.headers.authorization, 'Bearer sk-server');
    assert.deepEqual(sent.body.messages, request.messages);
    assert.deepEqual(sent.body.stream_options, { include_usage: true });
    assert.ok(logs.some((line) => line.includes('math-model 200 40 tokens')));
    assert.ok(!logs.join('\n').includes('token-a'));
  });

  test('also answers on /v1/chat/completions', async () => {
    const res = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-b' },
      body: JSON.stringify(request),
    });
    assert.equal(res.status, 200);
  });

  test('rejects a missing or wrong app token in the API error format', async () => {
    for (const token of ['', 'nope', 'token-a-but-longer']) {
      const res = await post(request, token);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error.code, 'invalid_token');
      assert.match(body.error.message, /app token/);
    }
    assert.equal(upstream.state.requests.length, 0);
  });

  test('anonymous mode needs no token', async () => {
    await start({ appTokens: [], allowAnonymous: true });
    const res = await post(request, '');
    assert.equal(res.status, 200);
    await res.text();
  });

  test('limits requests per minute per client, with Retry-After', async () => {
    await start({ requestsPerMinute: 2 });
    for (let i = 0; i < 2; i++) assert.equal((await post()).status, 200);
    const limited = await post();
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'rate_limit');
    assert.equal(limited.headers.get('retry-after'), '30');

    clock += 30_000; // half a minute refills one request
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
  });

  test('behind a reverse proxy, counts each X-Forwarded-For client separately', async () => {
    await start({ requestsPerMinute: 1, trustProxy: true });
    const from = (ip) => post(request, 'token-a', { 'X-Forwarded-For': `${ip}, 10.0.0.1` });
    assert.equal((await from('203.0.113.1')).status, 200);
    assert.equal((await from('203.0.113.1')).status, 429);
    assert.equal((await from('203.0.113.2')).status, 200);
  });

  test('limits requests per day per client', async () => {
    await start({ requestsPerMinute: 0, requestsPerDay: 3 });
    for (let i = 0; i < 3; i++) assert.equal((await post()).status, 200);
    const limited = await post();
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'daily_request_limit');
    assert.equal(Number(limited.headers.get('retry-after')), 12 * 3600);

    clock += 12 * 3600_000; // next UTC day
    assert.equal((await post()).status, 200);
  });

  test('stops at the daily token budget, counting streamed and plain JSON usage', async () => {
    await start({ tokensPerDay: 100 });
    await (await post()).text(); // 40
    upstream.state.contentType = 'application/json';
    upstream.state.reply = JSON.stringify({ choices: [], usage: { prompt_tokens: 20, completion_tokens: 40 } });
    await (await post({ ...request, stream: false })).text(); // 100 (no total_tokens: prompt + completion)
    const limited = await post();
    assert.equal(limited.status, 429);
    assert.equal((await limited.json()).error.code, 'daily_budget');
    assert.equal(upstream.state.requests.length, 2);
  });

  test('validates the request', async () => {
    await start({ allowedModels: ['math-model'], maxBodyBytes: 2_000 });
    assert.equal((await post('not json')).status, 400);
    assert.equal((await post({ model: 'math-model', messages: [] })).status, 400);

    const model = await post({ ...request, model: 'expensive-model' });
    assert.equal(model.status, 400);
    assert.equal((await model.json()).error.code, 'model_not_allowed');

    const big = await post({ ...request, messages: [{ role: 'user', content: 'x'.repeat(5_000) }] });
    assert.equal(big.status, 413);
    assert.equal(upstream.state.requests.length, 0);
  });

  test('caps max_tokens when MAX_OUTPUT_TOKENS is set', async () => {
    await start({ maxOutputTokens: 1000 });
    await (await post({ ...request, max_tokens: 5000 })).text();
    await (await post({ ...request, max_tokens: 8 })).text();
    await (await post()).text();
    assert.deepEqual(
      upstream.state.requests.map((r) => r.body.max_tokens),
      [1000, 8, 1000],
    );
  });

  test("hides the upstream rejecting the server's key behind a 502", async () => {
    upstream.state.status = 402;
    upstream.state.contentType = 'application/json';
    upstream.state.reply = JSON.stringify({ error: { message: 'Insufficient Balance' } });
    const res = await post();
    assert.equal(res.status, 502);
    assert.match((await res.json()).error.message, /out of balance/);
    assert.ok(logs.some((line) => line.includes('Insufficient Balance')));
  });

  test('passes other upstream errors through unchanged', async () => {
    upstream.state.status = 400;
    upstream.state.contentType = 'application/json';
    upstream.state.reply = JSON.stringify({ error: { message: 'Bad thinking field' } });
    const res = await post();
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.message, 'Bad thinking field');
  });

  test('reports an unreachable upstream as 502', async () => {
    await start({ upstreamUrl: 'http://127.0.0.1:9' });
    const res = await post();
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error.code, 'upstream_unreachable');
  });

  test('cancels the upstream request when the app disconnects', async () => {
    upstream.state.hang = true;
    const res = await post();
    const reader = res.body.getReader();
    await reader.read();
    await reader.cancel();
    for (let i = 0; i < 50 && upstream.state.closed === 0; i++) await new Promise((r) => setTimeout(r, 20));
    assert.ok(upstream.state.closed > 0);
  });

  test('health check, unknown paths, methods and CORS preflight', async () => {
    assert.deepEqual(await (await fetch(`${url}/health`)).json(), { ok: true });
    assert.equal((await fetch(`${url}/models`)).status, 404);
    assert.equal((await fetch(`${url}/chat/completions`)).status, 405);

    const preflight = await fetch(`${url}/chat/completions`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);

    await start({ allowedOrigins: ['https://app.example'] });
    const allowed = await fetch(`${url}/health`, { headers: { Origin: 'https://app.example' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example');
    const other = await fetch(`${url}/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});

describe('configFromEnv', () => {
  test('needs the upstream URL and key, and app tokens (or anonymous mode)', () => {
    const upstream = { UPSTREAM_URL: 'https://example.com', UPSTREAM_API_KEY: 'sk' };
    assert.throws(() => configFromEnv({}), /UPSTREAM_URL/);
    assert.throws(() => configFromEnv({ UPSTREAM_URL: 'https://example.com' }), /UPSTREAM_API_KEY/);
    assert.throws(() => configFromEnv(upstream), /APP_TOKENS/);
    assert.equal(configFromEnv({ ...upstream, ALLOW_ANONYMOUS: 'true' }).allowAnonymous, true);
  });

  test('parses lists and numbers, with defaults', () => {
    const c = configFromEnv({
      UPSTREAM_API_KEY: ' sk ',
      APP_TOKENS: 'a, b ,,c',
      UPSTREAM_URL: 'https://example.com/v1/',
      TOKENS_PER_DAY: '1000000',
      MAX_BODY_MB: '1',
      ALLOWED_MODELS: 'math-model',
      TRUST_PROXY: '1',
    });
    assert.equal(c.apiKey, 'sk');
    assert.deepEqual(c.appTokens, ['a', 'b', 'c']);
    assert.equal(c.upstreamUrl, 'https://example.com/v1');
    assert.equal(c.tokensPerDay, 1_000_000);
    assert.equal(c.maxBodyBytes, 1024 * 1024);
    assert.deepEqual(c.allowedModels, ['math-model']);
    assert.equal(c.trustProxy, true);
    assert.equal(c.port, 8788);
    assert.equal(c.requestsPerMinute, 20);
    assert.deepEqual(c.allowedOrigins, ['*']);
    assert.throws(() => configFromEnv({ UPSTREAM_URL: 'https://example.com', UPSTREAM_API_KEY: 'sk', APP_TOKENS: 'a', PORT: 'abc' }), /PORT/);
  });
});
