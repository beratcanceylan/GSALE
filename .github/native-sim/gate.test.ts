import { afterAll, describe, expect, test } from 'bun:test';
import net from 'node:net';

type GateRequest = { headers: Record<string, string | undefined>; url?: string; method?: string };
type Gate = {
  requireToken: (token: string) => void;
  server: { address: () => { port: number } | string | null; close: (callback: () => void) => void };
  tokenMatches: (candidate: unknown) => boolean;
  cookieToken: (request: GateRequest) => string | null;
  bearerToken: (request: GateRequest) => string | null;
  localPath: (request: GateRequest) => string | null;
  isAgentRoute: (path: string) => boolean;
  authorize: (request: GateRequest, path: string | null) => string | null;
  copyHeaders: (headers: Record<string, string | undefined>) => Record<string, string>;
  responseHeaders: (headers: Record<string, string | undefined>) => Record<string, string>;
  forwardedHeaders: (request: GateRequest) => Record<string, string>;
  headerLines: (headers: Record<string, string | string[]>) => string;
};

type BunServer = { port: number; stop: () => void };
const runtime = globalThis as unknown as {
  Bun: { serve: (options: { port: number; fetch: (request: Request) => Response }) => BunServer };
};

const upstream = runtime.Bun.serve({
  port: 0,
  fetch: (request) => new Response(new URL(request.url).pathname, {
    status: 200,
    headers: { location: '/inside', 'x-upstream': 'yes' },
  }),
});
const agent = runtime.Bun.serve({
  port: 0,
  fetch: (request) => new Response(`agent:${new URL(request.url).pathname}`),
});

const oldEnv = {
  token: process.env.NATIVE_SIM_GATE_TOKEN,
  port: process.env.NATIVE_SIM_GATE_PORT,
  target: process.env.NATIVE_SIM_TARGET_PORT,
  agent: process.env.NATIVE_SIM_AGENT_PORT,
};
process.env.NATIVE_SIM_GATE_TOKEN = 'test-secret';
process.env.NATIVE_SIM_GATE_PORT = '0';
process.env.NATIVE_SIM_TARGET_PORT = String(upstream.port);
process.env.NATIVE_SIM_AGENT_PORT = String(agent.port);

const gate = await import('./gate.mjs') as Gate;
const address = gate.server.address();
if (!address || typeof address === 'string') throw new Error('gate did not bind a port');
const base = `http://127.0.0.1:${address.port}`;
let agentStopped = false;

function rawRequest(request: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(address.port, '127.0.0.1');
    let response = '';
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('connect', () => socket.write(request));
    socket.on('data', (chunk: Buffer) => {
      response += chunk.toString();
      socket.end();
    });
    socket.on('error', reject);
    socket.on('close', () => resolve(response));
  });
}

afterAll(async () => {
  await new Promise<void>((resolve) => { gate.server.close(resolve); });
  upstream.stop();
  if (!agentStopped) agent.stop();
  for (const [key, value] of Object.entries({
    NATIVE_SIM_GATE_TOKEN: oldEnv.token,
    NATIVE_SIM_GATE_PORT: oldEnv.port,
    NATIVE_SIM_TARGET_PORT: oldEnv.target,
    NATIVE_SIM_AGENT_PORT: oldEnv.agent,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('native simulator gate', () => {
  test('authenticates exact tokens in cookies, bearer headers and query strings', () => {
    expect(() => gate.requireToken('')).toThrow('NATIVE_SIM_GATE_TOKEN is required');
    gate.requireToken('test-secret');
    expect(gate.tokenMatches('test-secret')).toBeTrue();
    expect(gate.tokenMatches('test-secrex')).toBeFalse();
    expect(gate.tokenMatches('short')).toBeFalse();
    expect(gate.tokenMatches(null)).toBeFalse();
    expect(gate.cookieToken({ headers: { cookie: 'a=1; native_sim_k=test-secret; b=2' } })).toBe('test-secret');
    expect(gate.cookieToken({ headers: {} })).toBeNull();
    expect(gate.bearerToken({ headers: { authorization: 'Bearer test-secret' } })).toBe('test-secret');
    expect(gate.bearerToken({ headers: { authorization: 'Bearer ' } })).toBeNull();
    expect(gate.bearerToken({ headers: { authorization: 'Basic test-secret' } })).toBeNull();
    expect(gate.authorize({ headers: { cookie: 'native_sim_k=test-secret' } }, '/')).toBe('cookie');
    expect(gate.authorize({ headers: { authorization: 'Bearer test-secret' } }, '/')).toBe('bearer');
    expect(gate.authorize({ headers: {} }, '/?k=test-secret')).toBe('query');
    expect(gate.authorize({ headers: {} }, null)).toBeNull();
  });

  test('accepts local paths and strips unsafe forwarded response headers', () => {
    expect(gate.localPath({ headers: {}, url: '/agent-device/health' })).toBe('/agent-device/health');
    expect(gate.localPath({ headers: {}, url: '//evil.example/path' })).toBeNull();
    expect(gate.localPath({ headers: {}, url: 'https://evil.example/' })).toBeNull();
    expect(gate.isAgentRoute('/agent-device/health')).toBeTrue();
    expect(gate.isAgentRoute('/agent-device?x=1')).toBeTrue();
    expect(gate.isAgentRoute('/agent-device-other')).toBeFalse();
    const headers = gate.copyHeaders({ host: 'example.com', 'x-safe': 'yes', 'bad name': 'no', missing: undefined });
    expect(headers).toEqual({ host: 'example.com', 'x-safe': 'yes' });
    expect(gate.responseHeaders({ location: 'https://evil.example/', 'x-upstream': 'yes' })).toEqual({ 'x-upstream': 'yes' });
    expect(gate.responseHeaders({ location: '/inside' }).location).toBe('/inside');
    expect(gate.forwardedHeaders({ headers: { host: 'public.example', 'x-custom': 'yes' } })).toMatchObject({
      'x-forwarded-proto': 'https', 'x-forwarded-host': 'public.example', 'x-custom': 'yes',
    });
    expect(gate.headerLines({ host: 'example.com', cookie: ['a=1', 'b=2'] })).toContain('cookie: a=1\r\ncookie: b=2');
  });

  test('guards the HTTP proxy and routes authenticated traffic to each upstream', async () => {
    const health = await fetch(`${base}/__native-sim/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, target: upstream.port, agent: agent.port });

    const denied = await fetch(`${base}/private`);
    expect(denied.status).toBe(403);
    expect(await denied.text()).toContain('access key');

    const login = await fetch(`${base}/?k=test-secret`, { redirect: 'manual' });
    expect(login.status).toBe(302);
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');

    const forwarded = await fetch(`${base}/inside`, { headers: { Cookie: 'native_sim_k=test-secret' }, redirect: 'manual' });
    expect(forwarded.status).toBe(200);
    expect(await forwarded.text()).toBe('/inside');
    expect(forwarded.headers.get('location')).toBe('/inside');

    const agentResponse = await fetch(`${base}/agent-device/health`, { headers: { Authorization: 'Bearer test-secret' } });
    expect(await agentResponse.text()).toBe('agent:/agent-device/health');
  });

  test('rejects absolute request targets and unauthenticated upgrades', async () => {
    const badTarget = await rawRequest('GET http://evil.example/ HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
    expect(badTarget).toContain('400 Bad Request');
    const deniedUpgrade = await rawRequest('GET /private HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    expect(deniedUpgrade).toContain('403 Forbidden');
  });

  test('forwards authorized upgrade attempts and reports closed upstream ports', async () => {
    const upgrade = await rawRequest('GET /inside HTTP/1.1\r\nHost: localhost\r\nCookie: native_sim_k=test-secret\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nhead');
    expect(upgrade).toContain('HTTP/1.1');
    agent.stop();
    agentStopped = true;
    const unavailable = await fetch(`${base}/agent-device/health`, {
      headers: { Authorization: 'Bearer test-secret' },
    });
    expect(unavailable.status).toBe(502);
    const closedUpgrade = await rawRequest('GET /agent-device/health HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer test-secret\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    expect(closedUpgrade).toBe('');
  });
});
