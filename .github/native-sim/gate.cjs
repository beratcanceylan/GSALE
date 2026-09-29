// native-sim-template-version: 18 (hardened for this repository)
/**
 * native-sim auth gate.
 *
 * serve-sim ships no authentication, so exposing port 3200 through a public
 * tunnel would hand simulator control to anyone who guessed the URL. This is a
 * dependency-free reverse proxy that requires `?k=<token>` once, trades it for
 * an HttpOnly cookie, and forwards everything (including the MJPEG stream and
 * the control WebSocket) to serve-sim on localhost.
 *
 * It also multiplexes a second upstream onto the same tunnel: when
 * NATIVE_SIM_AGENT_PORT is set, `/agent-device/*` is routed to the local
 * `agent-device proxy` instead of serve-sim, so one URL carries both the
 * human-facing stream and the agent-facing control API.
 */
const { Buffer } = require('node:buffer');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');

const TOKEN = process.env.NATIVE_SIM_GATE_TOKEN || '';
const TARGET_PORT = Number(process.env.NATIVE_SIM_TARGET_PORT || 3200);
// 0 disables the agent-device route entirely, so a session started without
// --agent exposes no extra surface at all.
const AGENT_PORT = Number(process.env.NATIVE_SIM_AGENT_PORT || 0);
const AGENT_PREFIX = '/agent-device';
const TARGET_HOST = '127.0.0.1';
const PORT = Number(process.env.NATIVE_SIM_GATE_PORT || 3199);
const COOKIE = 'native_sim_k';
const BEARER = 'bearer';
/** RFC 9110 token characters: header names never carry "__proto__"-style keys. */
const HEADER_NAME = /^[!#$%&'*+.^`|~0-9a-z-]+$/i;
/** Origin-relative request targets only: no scheme, no authority, no whitespace. */
const LOCAL_PATH = /^\/(?!\/)[\w\-.~!$&'()*+,;=:@%/?]*$/;

if (!TOKEN) {
  console.error('NATIVE_SIM_GATE_TOKEN is required — refusing to proxy an unauthenticated simulator');
  process.exit(1);
}

function tokenMatches(candidate) {
  if (typeof candidate !== 'string') return false;
  const given = Buffer.from(candidate);
  const expected = Buffer.from(TOKEN);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function cookieToken(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

/** agent-device authenticates with a bearer header; it never sends cookies. */
function bearerToken(req) {
  const header = (req.headers.authorization || '').trim();
  const separator = header.charAt(BEARER.length);
  if (header.slice(0, BEARER.length).toLowerCase() !== BEARER || separator.trim() !== '') return null;
  const token = header.slice(BEARER.length).trim();
  return token || null;
}

/** The request target when it is an origin-relative path, otherwise null. */
function localPath(req) {
  return typeof req.url === 'string' && LOCAL_PATH.test(req.url) ? req.url : null;
}

/** True when this request belongs to the agent-device proxy, not serve-sim. */
function isAgentRoute(path) {
  if (!AGENT_PORT) return false;
  const pathname = new URL(path, 'http://localhost').pathname;
  return pathname === AGENT_PREFIX || pathname.startsWith(`${AGENT_PREFIX}/`);
}

/** Returns 'cookie' | 'bearer' | 'query' when authorised, or null. */
function authorize(req, path) {
  if (tokenMatches(cookieToken(req))) return 'cookie';
  if (tokenMatches(bearerToken(req))) return 'bearer';
  if (path && tokenMatches(new URL(path, 'http://localhost').searchParams.get('k'))) return 'query';
  return null;
}

/** Copies headers with valid names into a prototype-less object. */
function copyHeaders(source) {
  const headers = Object.create(null);
  for (const [name, value] of Object.entries(source)) {
    if (HEADER_NAME.test(name) && value !== undefined) headers[name] = value;
  }
  return headers;
}

/** Upstream response headers; a redirect may only point back into this origin. */
function responseHeaders(upstreamHeaders) {
  const headers = copyHeaders(upstreamHeaders);
  const location = headers.location;
  if (location !== undefined && !(typeof location === 'string' && LOCAL_PATH.test(location))) {
    delete headers.location;
  }
  return headers;
}

function forwardedHeaders(req) {
  const headers = copyHeaders(req.headers);
  headers['x-forwarded-proto'] = 'https';
  if (req.headers.host) headers['x-forwarded-host'] = req.headers.host;
  return headers;
}

const DENIED = `<!doctype html><meta charset=utf-8><title>native-sim</title>
<style>body{font:14px/1.6 -apple-system,system-ui,sans-serif;margin:15vh auto;max-width:34rem;padding:0 1.5rem;color:#111}
@media(prefers-color-scheme:dark){body{background:#111;color:#eee}}code{background:#8882;padding:.15em .4em;border-radius:4px}</style>
<h1>🔒 native-sim</h1>
<p>This simulator stream needs the access key from the link the CLI printed.</p>
<p>Ask whoever started the session for the full URL — the one ending in <code>?k=…</code>.</p>`;

function deny(res) {
  res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' });
  res.end(DENIED);
}

const server = http.createServer((req, res) => {
  const path = localPath(req);
  if (!path) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('bad request target');
    return;
  }

  if (path.startsWith('/__native-sim/healthz')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, target: TARGET_PORT, agent: AGENT_PORT || null }));
    return;
  }

  const auth = authorize(req, path);
  if (!auth) {
    // agent-device leaves /health unauthenticated for reachability probes; the
    // gate deliberately does not, so an unauthenticated request can never reach
    // either upstream. `connect proxy` carries --daemon-auth-token on every
    // request, including that probe, so it authenticates normally.
    deny(res);
    return;
  }

  const agent = isAgentRoute(path);

  // Trade the query token for a cookie so the key stops travelling in URLs
  // (and so the preview's own fetches and WebSocket upgrades carry it). The CLI
  // prints the root URL, so the redirect always lands on "/". Never on the agent
  // route: a 302 mid-RPC would break the client, which has no cookie jar.
  if (auth === 'query' && !agent) {
    res.writeHead(302, {
      'set-cookie': `${COOKIE}=${TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`,
      location: '/',
    });
    res.end();
    return;
  }

  const upstream = http.request(
    {
      host: TARGET_HOST,
      port: agent ? AGENT_PORT : TARGET_PORT,
      method: req.method,
      // The agent-device proxy serves these routes under /agent-device/* itself,
      // so the path is forwarded verbatim rather than stripped.
      path,
      // Do NOT rewrite Host. serve-sim derives the URLs it advertises to the
      // browser from these headers; pointing them at 127.0.0.1:3200 makes the
      // page open its control WebSocket against the *viewer's* loopback, which
      // fails as "control socket connect timeout". Forward the public origin so
      // the helper and WebSocket URLs stay same-origin and route back through
      // this gate.
      headers: forwardedHeaders(req),
    },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, responseHeaders(upRes.headers));
      upRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`upstream error: ${err.message}`);
  });

  req.pipe(upstream);
});

function headerLines(headers) {
  return Object.entries(headers)
    .flatMap(([name, value]) => (Array.isArray(value) ? value : [value]).map((item) => `${name}: ${item}`))
    .join('\r\n');
}

// WebSockets carry simulator input, so the upgrade path has to be proxied too.
server.on('upgrade', (req, socket, head) => {
  const path = localPath(req);
  if (!path || !authorize(req, path)) {
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }

  const upstream = net.connect(isAgentRoute(path) ? AGENT_PORT : TARGET_PORT, TARGET_HOST, () => {
    upstream.write(`${req.method} ${path} HTTP/1.1\r\n${headerLines(forwardedHeaders(req))}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  const drop = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on('error', drop);
  socket.on('error', drop);
});

server.listen(PORT, '127.0.0.1', () => {
  const agentNote = AGENT_PORT ? ` (agent-device -> :${AGENT_PORT})` : '';
  console.log(`native-sim gate on :${PORT} -> :${TARGET_PORT}${agentNote}`);
});
