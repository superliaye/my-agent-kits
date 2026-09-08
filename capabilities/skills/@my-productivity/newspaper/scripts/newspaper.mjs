#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MAX_DOCUMENT_BYTES,
  MAX_NODES,
  mergeCanvasPatch,
  validateCanvas as validateCanvasModel,
} from "../runtime/canvas-model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = dirname(HERE);
const RUNTIME_ROOT = join(SKILL_ROOT, "runtime");
const STORAGE_ROOT = join(homedir(), ".newspaper");
const SERVICE_FILE = join(STORAGE_ROOT, "service.json");
const SERVICE_LOCK = join(STORAGE_ROOT, "service.lock");
const STARTUP_FILE = join(STORAGE_ROOT, "service-startup.json");
const IDLE_MS = Number(process.env.NEWSPAPER_IDLE_MS ?? 2000);
const WATCH_MS = 120;
const WRITE_STABLE_MS = 300;

const command = process.argv[2];
const flags = parseFlags(process.argv.slice(3));

if (command === "__serve") {
  try {
    await serve();
  } catch (error) {
    writeJsonAtomic(STARTUP_FILE, { ok: false, error: error.message, failedAt: new Date().toISOString() }, 0o600);
    rmSync(SERVICE_LOCK, { recursive: true, force: true });
    console.error(`newspaper: ${error.message}`);
    process.exitCode = 1;
  }
} else {
  await cli(command);
}

async function cli(action) {
  if (!['start', 'status', 'validate', 'close'].includes(action)) usage();
  mkdirPrivate(STORAGE_ROOT);

  if (action === 'start') {
    const service = await ensureService();
    const repoKey = repoKeyFor(flags.repo ?? process.cwd());
    const runKey = safeRunKey(flags.run) ?? mintedRunKey();
    const runRoot = join(STORAGE_ROOT, repoKey, runKey);
    if (existsSync(runRoot) || findRun(runKey)) fail(`Run already exists: ${runKey}`);
    mkdirPrivate(runRoot);
    const token = randomBytes(24).toString('base64url');
    const canvas = defaultCanvas();
    writeJsonAtomic(join(runRoot, 'canvas.json'), canvas);
    writeJsonAtomic(join(runRoot, 'last-valid.json'), canvas);
    writeJsonAtomic(join(runRoot, 'validation.json'), validResult(canvas.revision));
    writeJsonAtomic(join(runRoot, 'change.json'), {
      previousRevision: null, currentRevision: canvas.revision, changedIds: [],
    });
    writeJsonAtomic(join(runRoot, 'run.json'), {
      version: 1, runKey, repoKey, token, port: service.port, servicePid: service.pid, createdAt: new Date().toISOString(),
    }, 0o600);
    const url = runUrl(service.port, runKey, token);
    console.log(`Canvas: ${join(runRoot, 'canvas.json')}`);
    console.log(`URL: ${url}`);
    return;
  }

  const found = findRun(flags.run, flags.repo);
  if (!found) fail(flags.run ? `Run not found: ${flags.run}` : 'No run found; pass --run <run-key>');
  const { root: runRoot, meta } = found;

  if (action === 'status') {
    const service = await readHealthyService();
    const validation = readJsonSafe(join(runRoot, 'validation.json'));
    const canvas = readJsonSafe(join(runRoot, 'last-valid.json'));
    console.log(`Run: ${meta.runKey}`);
    console.log(`Canvas: ${join(runRoot, 'canvas.json')}`);
    console.log(`Revision: ${canvas?.revision ?? 'unknown'}`);
    console.log(`Validation: ${validation?.valid === false ? validation.message : 'valid'}`);
    console.log(`Service: ${service ? 'healthy' : 'unavailable'}`);
    console.log(`URL: ${runUrl(service?.port ?? meta.port, meta.runKey, meta.token)}`);
    return;
  }

  if (action === 'validate') {
    const source = readCanvasSource(join(runRoot, 'canvas.json'));
    const accepted = readJsonSafe(join(runRoot, 'last-valid.json'));
    const result = validateSource(source, runRoot, accepted?.revision, { requireCurrentRevision: true });
    writeJsonAtomic(join(runRoot, 'validation.json'), result.ok
      ? validResult(accepted?.revision ?? source.value.revision)
      : invalidResult(result.error, accepted?.revision));
    if (!result.ok) fail(`${result.error.code}: ${result.error.message}`);
    console.log(`Valid: ${join(runRoot, 'canvas.json')} (revision ${source.value.revision})`);
    return;
  }

  const service = await readHealthyService();
  if (service) {
    const response = await fetch(`http://127.0.0.1:${service.port}/api/runs/${encodeURIComponent(meta.runKey)}`, {
      method: 'DELETE', headers: { 'X-Newspaper-Token': meta.token },
    }).catch(() => null);
    if (response?.ok) {
      console.log(`Closed: ${meta.runKey}`);
      return;
    }
  }
  rmSync(runRoot, { recursive: true, force: true });
  console.log(`Closed: ${meta.runKey}`);
}

function usage() {
  console.error('Usage: newspaper.mjs <start|status|validate|close> [--run <key>] [--repo <path>]');
  process.exit(2);
}

function parseFlags(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--run' || arg === '--repo') {
      const value = args[index + 1];
      if (!value) fail(`${arg} requires a value`);
      parsed[arg.slice(2)] = value;
      index += 1;
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }
  return parsed;
}

function safeRunKey(value) {
  if (value === undefined) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value)) fail('Run key must be filesystem-safe');
  return value;
}

function mintedRunKey() {
  return `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${randomBytes(4).toString('hex')}`;
}

function repoKeyFor(input) {
  let root = resolve(input);
  try {
    const result = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result) root = result.trim();
  } catch {}
  const slug = basename(root).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
  return `${slug}-${createHash('sha256').update(root).digest('hex').slice(0, 8)}`;
}

async function ensureService() {
  const waitStartedAt = Date.now();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const existing = await readHealthyService();
    if (existing) return existing;
    const startup = readJsonSafe(STARTUP_FILE);
    let startupMtime = 0;
    try { startupMtime = statSync(STARTUP_FILE).mtimeMs; } catch {}
    if (startup?.ok === false && startupMtime >= waitStartedAt - 100) fail(startup.error);
    try {
      mkdirSync(SERVICE_LOCK, { mode: 0o700 });
      rmSync(SERVICE_FILE, { force: true });
      rmSync(STARTUP_FILE, { force: true });
      writeJsonAtomic(join(SERVICE_LOCK, 'owner.json'), { pid: process.pid, acquiredAt: new Date().toISOString() }, 0o600);
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '__serve'], {
        detached: true, stdio: 'ignore', env: process.env,
      });
      child.unref();
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(SERVICE_LOCK).mtimeMs > 15000) rmSync(SERVICE_LOCK, { recursive: true, force: true });
      } catch {}
    }
    await delay(50);
  }
  fail('Newspaper service did not become healthy');
}

async function readHealthyService() {
  const meta = readJsonSafe(SERVICE_FILE);
  if (!meta?.port || !meta?.pid) return null;
  try {
    const response = await fetch(`http://127.0.0.1:${meta.port}/health`, { signal: AbortSignal.timeout(300) });
    const health = response.ok ? await response.json() : null;
    return health?.ok === true && health.pid === meta.pid ? meta : null;
  } catch {
    return null;
  }
}

async function serve() {
  mkdirPrivate(STORAGE_ROOT);
  const runs = new Map();
  const sockets = new Map();
  let lastActiveAt = Date.now();

  const server = createServer(async (request, response) => {
    try {
      if (!allowedHost(request.headers.host)) return json(response, 403, { error: 'non-loopback host rejected' });
      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') {
        return json(response, 200, { ok: true, pid: process.pid });
      }
      if (request.method === 'GET' && url.pathname === '/') return redirect(response, '/index.html');
      if (request.method === 'GET' && ['/index.html', '/app.js', '/app.css', '/react-flow.css'].includes(url.pathname)) {
        return asset(response, url.pathname.slice(1));
      }
      const pageMatch = url.pathname.match(/^\/r\/([^/]+)$/);
      if (request.method === 'GET' && pageMatch) return asset(response, 'index.html');
      const apiMatch = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(state|poll|mutate|media))?$/);
      if (!apiMatch) return json(response, 404, { error: 'not found' });
      const runKey = decodeURIComponent(apiMatch[1]);
      const run = loadRun(runKey, runs);
      if (!run) return json(response, 404, { error: 'run not found' });
      if (request.headers['x-newspaper-token'] !== run.meta.token) return json(response, 401, { error: 'unauthorized' });
      lastActiveAt = Date.now();
      const operation = apiMatch[2];

      if (request.method === 'GET' && operation === 'state') {
        const canvas = readJsonSafe(join(run.root, 'last-valid.json'));
        exposeValidationHeaders(response, run.root);
        const nodeId = url.searchParams.get('node');
        if (nodeId) return json(response, 200, { revision: canvas.revision, node: canvas.nodes[nodeId] ?? null });
        return json(response, 200, canvas);
      }
      if (request.method === 'GET' && operation === 'poll') {
        const canvas = readJsonSafe(join(run.root, 'last-valid.json'));
        exposeValidationHeaders(response, run.root);
        const since = Number(url.searchParams.get('since'));
        const changed = !Number.isInteger(since) || since !== canvas.revision;
        return json(response, 200, changed ? { revision: canvas.revision, changed, canvas } : { revision: canvas.revision, changed });
      }
      if (request.method === 'GET' && operation === 'media') return media(response, run, url.searchParams.get('path'));
      if (request.method === 'POST' && operation === 'mutate') {
        const body = await readBody(request);
        if (!body.ok) return json(response, body.status, { error: body.error });
        const filesystemState = await settleFilesystemEdit(run, runs, sockets);
        const current = readJsonSafe(join(run.root, 'last-valid.json'));
        if (filesystemState === 'invalid' || body.value.baseRevision !== current.revision) {
          return json(response, 409, {
            error: filesystemState === 'invalid' ? 'filesystem_conflict' : 'conflict',
            currentRevision: current.revision,
            canvas: current,
          });
        }
        let candidate;
        try {
          candidate = body.value.canvas
            ? structuredClone(body.value.canvas)
            : mergeCanvasPatch(structuredClone(current), body.value.patch ?? {});
        } catch (error) {
          if (error.code !== 'unsafe_patch') throw error;
          return json(response, 422, invalidResult({
            code: error.code,
            field: error.field,
            message: error.message,
          }, current.revision));
        }
        candidate.revision = current.revision + 1;
        const checked = validateCanvas(candidate, run.root);
        if (!checked.ok) return json(response, 422, invalidResult(checked.error, current.revision));
        acceptCanvas(run, current, candidate, runs, sockets);
        return json(response, 200, candidate);
      }
      if (request.method === 'DELETE' && !operation) {
        closeRun(run, runs, sockets);
        lastActiveAt = Date.now();
        return json(response, 200, { closed: runKey });
      }
      return json(response, 405, { error: 'method not allowed' });
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  });

  server.on('upgrade', (request, socket) => {
    try {
      if (!allowedHost(request.headers.host)) return socket.destroy();
      const url = new URL(request.url, 'http://127.0.0.1');
      const match = url.pathname.match(/^\/ws\/([^/]+)$/);
      if (!match) return socket.destroy();
      const run = loadRun(decodeURIComponent(match[1]), runs);
      const protocols = String(request.headers['sec-websocket-protocol'] ?? '').split(',').map((item) => item.trim());
      if (!run || !protocols.includes(run.meta.token)) return socket.destroy();
      const key = request.headers['sec-websocket-key'];
      if (!key) return socket.destroy();
      const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
      socket.write([
        'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`, `Sec-WebSocket-Protocol: ${run.meta.token}`, '', '',
      ].join('\r\n'));
      const group = sockets.get(run.meta.runKey) ?? new Set();
      group.add(socket);
      sockets.set(run.meta.runKey, group);
      socket.on('close', () => group.delete(socket));
      socket.on('error', () => group.delete(socket));
      socket.on('data', (buffer) => {
        if ((buffer[0] & 0x0f) === 0x8) socket.end();
      });
      const canvas = readJsonSafe(join(run.root, 'last-valid.json'));
      socket.write(webSocketFrame(JSON.stringify({ type: 'revision', revision: canvas.revision })));
      lastActiveAt = Date.now();
    } catch {
      socket.destroy();
    }
  });

  const port = await listenInRange(server);
  writeJsonAtomic(SERVICE_FILE, { version: 1, pid: process.pid, port, startedAt: new Date().toISOString() }, 0o600);
  rmSync(STARTUP_FILE, { force: true });
  rmSync(SERVICE_LOCK, { recursive: true, force: true });
  scanRuns(runs);
  const watcher = setInterval(() => {
    scanRuns(runs);
    for (const run of runs.values()) void inspectFilesystemEdit(run, runs, sockets);
  }, WATCH_MS);
  const idle = setInterval(() => {
    if (runs.size === 0 && Date.now() - lastActiveAt >= IDLE_MS) server.close();
  }, Math.min(500, IDLE_MS));
  server.on('close', () => {
    clearInterval(watcher);
    clearInterval(idle);
    rmSync(SERVICE_FILE, { force: true });
    process.exit(0);
  });
}

function loadRun(runKey, runs) {
  if (runs.has(runKey)) return runs.get(runKey);
  const found = findRun(runKey);
  if (!found) return null;
  const run = makeRun(found.root, found.meta);
  runs.set(runKey, run);
  return run;
}

function scanRuns(runs) {
  for (const found of allRuns()) {
    if (!runs.has(found.meta.runKey)) runs.set(found.meta.runKey, makeRun(found.root, found.meta));
  }
  for (const [key, run] of runs) {
    if (!existsSync(join(run.root, 'run.json'))) runs.delete(key);
  }
}

function makeRun(root, meta) {
  const canvasPath = join(root, 'canvas.json');
  return {
    root,
    meta,
    canvasPath,
    observedSource: readCanvasSource(join(root, 'last-valid.json')).raw,
    rejectedSource: null,
    pendingSource: null,
    inspecting: false,
  };
}

async function inspectFilesystemEdit(run, runs, sockets) {
  if (run.inspecting) return 'pending';
  run.inspecting = true;
  try {
    const source = readCanvasSource(run.canvasPath);
    if (source.raw === run.observedSource) {
      run.pendingSource = null;
      if (run.rejectedSource !== null) {
        run.rejectedSource = null;
        const current = readJsonSafe(join(run.root, 'last-valid.json'));
        writeJsonAtomic(join(run.root, 'validation.json'), validResult(current.revision));
        notify(run, sockets, { type: 'validation', revision: current.revision, error: null });
      }
      return 'unchanged';
    }
    if (source.raw === run.rejectedSource) {
      run.pendingSource = null;
      return 'invalid';
    }
    if (!run.pendingSource || run.pendingSource.raw !== source.raw) {
      run.pendingSource = { raw: source.raw, stableSince: Date.now() };
      return 'pending';
    }
    if (Date.now() - run.pendingSource.stableSince < WRITE_STABLE_MS) return 'pending';
    const confirmed = readCanvasSource(run.canvasPath);
    if (confirmed.raw !== source.raw) {
      run.pendingSource = { raw: confirmed.raw, stableSince: Date.now() };
      return 'pending';
    }
    run.pendingSource = null;
    const current = readJsonSafe(join(run.root, 'last-valid.json'));
    const result = validateSource(confirmed, run.root, current?.revision, { requireCurrentRevision: true });
    if (!result.ok) {
      run.rejectedSource = confirmed.raw;
      writeJsonAtomic(join(run.root, 'validation.json'), invalidResult(result.error, current?.revision));
      notify(run, sockets, { type: 'validation', revision: current?.revision, error: result.error });
      return 'invalid';
    }
    const candidate = result.value;
    candidate.revision = current.revision + 1;
    acceptCanvas(run, current, candidate, runs, sockets);
    return 'accepted';
  } finally {
    run.inspecting = false;
  }
}

async function settleFilesystemEdit(run, runs, sockets) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await inspectFilesystemEdit(run, runs, sockets);
    if (result !== 'pending') return result;
    await delay(50);
  }
  return 'invalid';
}

function acceptCanvas(run, previous, candidate, runs, sockets) {
  writeJsonAtomic(run.canvasPath, candidate);
  writeJsonAtomic(join(run.root, 'last-valid.json'), candidate);
  writeJsonAtomic(join(run.root, 'validation.json'), validResult(candidate.revision));
  writeJsonAtomic(join(run.root, 'change.json'), {
    previousRevision: previous.revision,
    currentRevision: candidate.revision,
    changedIds: changedIds(previous, candidate),
  });
  run.observedSource = readCanvasSource(run.canvasPath).raw;
  run.rejectedSource = null;
  run.pendingSource = null;
  runs.set(run.meta.runKey, run);
  notify(run, sockets, { type: 'revision', revision: candidate.revision });
}

function closeRun(run, runs, sockets) {
  for (const socket of sockets.get(run.meta.runKey) ?? []) {
    try { socket.end(webSocketFrame(JSON.stringify({ type: 'closed' }))); } catch {}
  }
  sockets.delete(run.meta.runKey);
  runs.delete(run.meta.runKey);
  rmSync(run.root, { recursive: true, force: true });
}

function notify(run, sockets, message) {
  const frame = webSocketFrame(JSON.stringify(message));
  for (const socket of sockets.get(run.meta.runKey) ?? []) {
    if (!socket.destroyed) socket.write(frame);
  }
}

function webSocketFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function validateSource(source, runRoot, currentRevision, options) {
  if (source.tooLarge) return bad('document_too_large', `canvas.json exceeds ${MAX_DOCUMENT_BYTES} bytes`, 'canvas');
  if (source.parseError) return bad('invalid_json', source.parseError, 'canvas');
  if (options.requireCurrentRevision && source.value?.revision !== currentRevision) {
    return bad('stale_revision', `Expected source revision ${currentRevision}, received ${source.value?.revision}`, 'revision');
  }
  return validateCanvas(source.value, runRoot);
}

function validateCanvas(canvas, runRoot) {
  return validateCanvasModel(canvas, {
    maxDocumentBytes: MAX_DOCUMENT_BYTES,
    maxNodes: MAX_NODES,
    validateMedia: (source, id) => {
      const resolved = safeRunPath(runRoot, source);
      if (!resolved) return { code: 'path_traversal', message: `Media ${id} escapes the run root`, field: `nodes.${id}.src`, id };
      if (!existsSync(resolved) || !statSync(resolved).isFile()) return { code: 'missing_media', message: `Media file not found: ${source}`, field: `nodes.${id}.src`, id };
      return null;
    },
  });
}

function bad(code, message, field, id) {
  return { ok: false, error: { code, message, field, ...(id ? { id } : {}) } };
}

function invalidResult(error, revision) {
  return { valid: false, revision, ...error, checkedAt: new Date().toISOString() };
}

function validResult(revision) {
  return { valid: true, revision, checkedAt: new Date().toISOString() };
}

function defaultCanvas() {
  return {
    version: 1,
    revision: 0,
    title: 'The Working Edition',
    focus: ['main'],
    regions: { main: { layout: 'newspaper', origin: [0, 0], width: 1200, columns: 4 } },
    nodes: {
      lead: {
        type: 'story', region: 'main', order: 10, span: 2, status: 'active',
        title: 'The live brief is ready',
        body: 'Use this lead position for the most important current outcome.\n\n- Patch meaningful checkpoints\n- Keep stable node IDs\n- Leave `revision` unchanged',
      },
      checkpoint: {
        type: 'callout', region: 'main', order: 20, span: 1, status: 'info',
        title: 'Current checkpoint', body: 'Replace this card when the work moves forward.',
      },
      progress: {
        type: 'metric', region: 'main', order: 30, span: 1,
        label: 'Accepted revision', value: '0', trend: 'Live',
      },
    },
    edges: {},
  };
}

function changedIds(previous, current) {
  const changed = [];
  for (const group of ['regions', 'nodes', 'edges']) {
    const ids = new Set([...Object.keys(previous[group] ?? {}), ...Object.keys(current[group] ?? {})]);
    for (const id of ids) {
      if (JSON.stringify(previous[group]?.[id]) !== JSON.stringify(current[group]?.[id])) changed.push(`${group}.${id}`);
    }
  }
  if (JSON.stringify(previous.focus) !== JSON.stringify(current.focus)) changed.push('focus');
  if (previous.title !== current.title) changed.push('title');
  return changed;
}

function safeRunPath(runRoot, requested) {
  if (!requested || requested.includes('\0')) return null;
  const candidate = resolve(runRoot, requested);
  const rel = relative(runRoot, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`) || resolve(candidate) === resolve(runRoot)) return null;
  let ancestor = candidate;
  while (!existsSync(ancestor) && ancestor !== runRoot) ancestor = dirname(ancestor);
  try {
    const canonicalRoot = realpathSync(runRoot);
    const canonicalAncestor = realpathSync(ancestor);
    const canonicalRel = relative(canonicalRoot, canonicalAncestor);
    if (canonicalRel === '..' || canonicalRel.startsWith(`..${sep}`)) return null;
  } catch {
    return null;
  }
  return candidate;
}

function media(response, run, requested) {
  const referenced = Object.values(readJsonSafe(join(run.root, 'last-valid.json'))?.nodes ?? {})
    .some((node) => node.type === 'media' && node.src === requested);
  const file = safeRunPath(run.root, requested);
  if (!referenced || !file || !existsSync(file)) return json(response, 404, { error: 'media not found' });
  const ext = file.split('.').pop()?.toLowerCase();
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext] ?? 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
  response.end(readFileSync(file));
}

function asset(response, name) {
  const types = { 'index.html': 'text/html; charset=utf-8', 'app.js': 'text/javascript; charset=utf-8', 'app.css': 'text/css; charset=utf-8', 'react-flow.css': 'text/css; charset=utf-8' };
  const file = join(RUNTIME_ROOT, name);
  if (!types[name] || !existsSync(file)) return json(response, 404, { error: 'asset not found' });
  response.writeHead(200, { 'Content-Type': types[name], 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' ws:; object-src 'none'; base-uri 'none'" });
  response.end(readFileSync(file));
}

function allowedHost(host) {
  if (!host) return false;
  const normalized = host.toLowerCase().replace(/^\[/, '').replace(/\](?=:|$)/, '');
  const hostname = normalized.startsWith('::1') ? '::1' : normalized.split(':')[0];
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_DOCUMENT_BYTES) return { ok: false, status: 413, error: 'request too large' };
    chunks.push(chunk);
  }
  try { return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; }
  catch { return { ok: false, status: 400, error: 'invalid JSON' }; }
}

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

function exposeValidationHeaders(response, runRoot) {
  const validation = readJsonSafe(join(runRoot, 'validation.json'));
  if (validation?.valid === false) {
    response.setHeader('X-Newspaper-Validation', validation.code ?? 'invalid');
    response.setHeader('X-Newspaper-Validation-Message', String(validation.message ?? 'Canvas is invalid').slice(0, 500));
    response.setHeader('Access-Control-Expose-Headers', 'X-Newspaper-Validation, X-Newspaper-Validation-Message');
  }
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function listenInRange(server) {
  return new Promise((resolvePromise, reject) => {
    let port = 6971;
    const attempt = () => {
      const onError = (error) => {
        server.off('listening', onListening);
        if (error.code === 'EADDRINUSE' && port < 6999) { port += 1; attempt(); }
        else reject(new Error(port >= 6999 ? 'No available loopback port from 6971 through 6999' : error.message));
      };
      const onListening = () => { server.off('error', onError); resolvePromise(port); };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, '127.0.0.1');
    };
    attempt();
  });
}

function allRuns() {
  const found = [];
  if (!existsSync(STORAGE_ROOT)) return found;
  for (const repo of safeDirectories(STORAGE_ROOT)) {
    for (const run of safeDirectories(join(STORAGE_ROOT, repo))) {
      const root = join(STORAGE_ROOT, repo, run);
      const meta = readJsonSafe(join(root, 'run.json'));
      if (meta?.runKey && meta?.token) found.push({ root, meta });
    }
  }
  return found;
}

function findRun(runKey, repoPath) {
  const matches = allRuns().filter((entry) => (!runKey || entry.meta.runKey === runKey) && (!repoPath || entry.meta.repoKey === repoKeyFor(repoPath)));
  return matches.length === 1 ? matches[0] : null;
}

function safeDirectories(root) {
  try { return readdirSync(root).filter((name) => { try { return statSync(join(root, name)).isDirectory(); } catch { return false; } }); }
  catch { return []; }
}

function readCanvasSource(path) {
  try {
    const stat = statSync(path);
    if (stat.size > MAX_DOCUMENT_BYTES) return { raw: `oversized:${stat.size}:${stat.mtimeMs}`, tooLarge: true };
    const raw = readFileSync(path, 'utf8');
    try { return { raw, value: JSON.parse(raw) }; }
    catch (error) { return { raw, parseError: error.message }; }
  } catch (error) {
    return { raw: `missing:${error.code}`, parseError: `Cannot read canvas.json: ${error.message}` };
  }
}

function readJsonSafe(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function writeJsonAtomic(path, value, mode) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: mode ?? 0o644 });
  renameSync(temporary, path);
  if (mode) chmodSync(path, mode);
}

function mkdirPrivate(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function runUrl(port, runKey, token) {
  return `http://127.0.0.1:${port}/r/${encodeURIComponent(runKey)}#${token}`;
}

function delay(ms) { return new Promise((resolvePromise) => setTimeout(resolvePromise, ms)); }

function fail(message) {
  console.error(`newspaper: ${message}`);
  process.exit(1);
}
