import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { request as httpRequest } from 'node:http';
import { dirname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const skill = process.env.NEWSPAPER_SKILL;
if (!skill) throw new Error('NEWSPAPER_SKILL is required');
const script = join(skill, 'scripts', 'newspaper.mjs');
const { mergeCanvasPatch } = await import(pathToFileURL(join(skill, 'runtime', 'canvas-model.mjs')));

const [first, second] = await Promise.all([
  cliAsync('start', '--run', 'first-run'),
  cliAsync('start', '--run', 'second-run'),
]);
const one = parseStart(first);
const two = parseStart(second);
assert(one.canvas !== two.canvas, 'concurrent runs share a document');
assert(one.url !== two.url, 'concurrent runs share a URL');
const firstMeta = JSON.parse(readFileSync(join(dirname(one.canvas), 'run.json'), 'utf8'));
const secondMeta = JSON.parse(readFileSync(join(dirname(two.canvas), 'run.json'), 'utf8'));
assert(firstMeta.port === secondMeta.port, 'concurrent runs did not reuse one service');

const health = await fetch(`http://127.0.0.1:${firstMeta.port}/health`);
assert(health.ok, 'health endpoint unavailable');
const healthState = await health.json();
assert(healthState.pid === firstMeta.servicePid && healthState.pid === secondMeta.servicePid, 'simultaneous starts elected more than one writer service');
assert(await statusWithHost(firstMeta.port, 'example.com') === 403, 'service accepted a non-loopback Host header');
let stylesheet = '';
for (const asset of ['index.html', 'app.js', 'app.css']) {
  const response = await fetch(`http://127.0.0.1:${firstMeta.port}/${asset}`);
  const body = await response.text();
  assert(response.ok && body.length > 100, `${asset} unavailable`);
  if (asset === 'app.css') stylesheet = body;
}
assertCardOverflowContract(stylesheet);
assertTypographyContract(stylesheet);

let canvas = await state(firstMeta);
assert(canvas.revision === 0 && canvas.nodes.lead, 'default canvas is not useful');
const unauthenticated = await fetch(api(firstMeta, 'state'));
assert(unauthenticated.status === 401, 'canvas state was served without its run token');
assertSafeMergeContract();
const runRoot = dirname(one.canvas);
writeFileSync(join(runRoot, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
canvas.nodes.code = { type: 'code', region: 'main', order: 40, span: 2, title: 'Patch', language: 'diff', code: '+ accepted' };
canvas.nodes.table = { type: 'table', region: 'main', order: 50, span: 2, title: 'Checks', headers: ['Check', 'State'], rows: [['Schema', 'Pass']] };
canvas.nodes.media = { type: 'media', region: 'main', order: 60, span: 1, title: 'Pixel', src: 'pixel.png', caption: 'Local media' };
canvas.nodes.lead.frame = { x: 12, y: 20, width: 540, height: 320 };
canvas.edges.flow = { source: 'lead', target: 'code', label: 'produces' };
writeFileSync(one.canvas, `${JSON.stringify(canvas, null, 2)}\n`);
canvas = await waitRevision(firstMeta, 1);
assert(canvas.nodes.code?.code === '+ accepted', 'filesystem patch not served');
const change = JSON.parse(readFileSync(join(runRoot, 'change.json'), 'utf8'));
assert(change.previousRevision === 0 && change.currentRevision === 1 && change.changedIds.includes('nodes.code'), 'change.json lacks keyed changes');
assert(JSON.parse(readFileSync(join(runRoot, 'last-valid.json'), 'utf8')).revision === 1, 'last-valid not advanced');

const completeWrite = structuredClone(canvas);
completeWrite.nodes.checkpoint.body = 'Accepted only after the write is complete';
writeFileSync(one.canvas, '{"version":1');
await delay(180);
assert(JSON.parse(readFileSync(join(runRoot, 'validation.json'), 'utf8')).valid === true, 'partial write was validated before reaching stability');
writeFileSync(one.canvas, `${JSON.stringify(completeWrite, null, 2)}\n`);
canvas = await waitRevision(firstMeta, 2);
assert(canvas.nodes.checkpoint.body === completeWrite.nodes.checkpoint.body, 'stable complete write was not accepted');

const filesystemWins = structuredClone(canvas);
filesystemWins.nodes.checkpoint.body = 'Filesystem edit accepted before browser mutation';
writeFileSync(one.canvas, `${JSON.stringify(filesystemWins, null, 2)}\n`);
let mutation = await fetch(api(firstMeta, 'mutate'), {
  method: 'POST', headers: auth(firstMeta),
  body: JSON.stringify({ baseRevision: 2, patch: { title: 'browser overwrite' } }),
});
assert(mutation.status === 409, 'browser mutation overwrote a filesystem edit awaiting watcher processing');
canvas = await state(firstMeta);
assert(canvas.revision === 3 && canvas.nodes.checkpoint.body === filesystemWins.nodes.checkpoint.body && canvas.title !== 'browser overwrite', 'filesystem/browser reconciliation lost canonical data');

const socketRevision = waitWebSocketRevision(firstMeta, 4);
mutation = await fetch(api(firstMeta, 'mutate'), {
  method: 'POST', headers: auth(firstMeta),
  body: JSON.stringify({ baseRevision: 3, patch: { nodes: { lead: { title: 'Edited in browser' } } } }),
});
assert(mutation.ok, `browser mutation failed: ${mutation.status}`);
canvas = await mutation.json();
assert(canvas.revision === 4 && canvas.nodes.lead.title === 'Edited in browser', 'browser mutation did not update canonical state');
assert(await socketRevision === 4, 'WebSocket did not announce revision');
assert(JSON.parse(readFileSync(one.canvas, 'utf8')).nodes.lead.title === 'Edited in browser', 'browser mutation did not persist to canvas.json');

mutation = await fetch(api(firstMeta, 'mutate'), {
  method: 'POST', headers: auth(firstMeta),
  body: JSON.stringify({ baseRevision: 3, patch: { title: 'stale overwrite' } }),
});
assert(mutation.status === 409, 'stale browser mutation was not rejected');
assert((await state(firstMeta)).title !== 'stale overwrite', 'stale browser mutation overwrote state');

const rejectedSource = '{not-json';
await rejection('invalid_json', rejectedSource);
for (const attempt of ['first overwrite', 'second overwrite']) {
  mutation = await fetch(api(firstMeta, 'mutate'), {
    method: 'POST', headers: auth(firstMeta),
    body: JSON.stringify({ baseRevision: canvas.revision, patch: { title: attempt } }),
  });
  const rejectedMutation = await mutation.json();
  assert(mutation.status === 409 && rejectedMutation.error === 'filesystem_conflict', `${attempt} bypassed the rejected filesystem source`);
  assert(readFileSync(one.canvas, 'utf8') === rejectedSource, `${attempt} overwrote the rejected filesystem source`);
}
writeFileSync(one.canvas, `${JSON.stringify(canvas, null, 2)}\n`);
await waitFor(() => JSON.parse(readFileSync(join(runRoot, 'validation.json'), 'utf8')).valid === true, 4000, 'repair did not clear the rejected filesystem source');
mutation = await fetch(api(firstMeta, 'mutate'), {
  method: 'POST', headers: auth(firstMeta),
  body: JSON.stringify({ baseRevision: canvas.revision, patch: { title: 'Recovered browser edit' } }),
});
assert(mutation.ok, `browser mutation did not recover after source repair: ${mutation.status}`);
canvas = await mutation.json();
assert(canvas.revision === 5 && canvas.title === 'Recovered browser edit', 'recovered browser mutation did not become canonical');

for (const attack of [
  '{"baseRevision":5,"patch":{"nodes":{"lead":{"__proto__":{"polluted":true}}}}}',
  '{"baseRevision":5,"patch":{"nodes":{"lead":{"constructor":{"prototype":{"polluted":true}}}}}}',
  '{"baseRevision":5,"patch":{"nodes":{"lead":{"body":[{"prototype":{"polluted":true}}]}}}}',
]) {
  mutation = await fetch(api(firstMeta, 'mutate'), { method: 'POST', headers: auth(firstMeta), body: attack });
  const rejectedAttack = await mutation.json();
  assert(mutation.status === 422 && rejectedAttack.code === 'unsafe_patch', 'unsafe recursive merge key was not rejected');
  assert((await state(firstMeta)).revision === 5, 'unsafe recursive merge changed canonical state');
}
const invalidSchema = structuredClone(canvas);
invalidSchema.nodes.lead.region = 'missing';
await rejection('missing_reference', `${JSON.stringify(invalidSchema)}\n`);
const stale = structuredClone(canvas);
stale.revision = 0;
await rejection('stale_revision', `${JSON.stringify(stale)}\n`);
const alias = structuredClone(canvas);
alias.nodes.lead.text = 'undocumented renderer alias';
await rejection('schema', `${JSON.stringify(alias)}\n`);
const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0x20);
await rejection('document_too_large', oversized);

writeFileSync(one.canvas, `${JSON.stringify(canvas, null, 2)}\n`);
canvas = await waitRevision(firstMeta, 5);
const unsafe = structuredClone(canvas);
unsafe.nodes.lead.body = '<script>alert(1)</script>';
writeFileSync(one.canvas, `${JSON.stringify(unsafe)}\n`);
await waitValidation(runRoot, 'unsafe_html');
assert((await state(firstMeta)).revision === 5, 'unsafe HTML replaced last valid canvas');

const traversal = structuredClone(canvas);
traversal.revision = 5;
traversal.nodes.media.src = '../outside.png';
writeFileSync(join(dirname(runRoot), 'outside.png'), 'outside');
writeFileSync(one.canvas, `${JSON.stringify(traversal)}\n`);
await waitValidation(runRoot, 'path_traversal');
assert((await state(firstMeta)).revision === 5, 'path traversal replaced last valid canvas');

writeFileSync(one.canvas, `${JSON.stringify(canvas, null, 2)}\n`);
canvas = await waitRevision(firstMeta, 5);
const media = await fetch(`${api(firstMeta, 'media')}?path=pixel.png`, { headers: auth(firstMeta, false) });
assert(media.ok && (await media.arrayBuffer()).byteLength > 0, 'referenced local media not served');
const escaped = await fetch(`${api(firstMeta, 'media')}?path=../outside.png`, { headers: auth(firstMeta, false) });
assert(escaped.status === 404, 'unreferenced traversal media was served');

const largeCanvas = structuredClone(canvas);
largeCanvas.nodes.large = { type: 'story', region: 'main', order: 70, span: 1, title: 'Large', body: '' };
const baseBytes = Buffer.byteLength(JSON.stringify(largeCanvas));
largeCanvas.nodes.large.body = 'x'.repeat(5 * 1024 * 1024 - baseBytes - 16 * 1024);
writeFileSync(one.canvas, `${JSON.stringify(largeCanvas)}\n`);
const largeAccepted = await waitRevision(firstMeta, 6);
mutation = await fetch(api(firstMeta, 'mutate'), {
  method: 'POST', headers: auth(firstMeta),
  body: JSON.stringify({ baseRevision: 6, patch: { nodes: { large: { title: 'y'.repeat(32 * 1024) } } } }),
});
assert(mutation.status === 422 && (await mutation.json()).code === 'document_too_large', 'serialized merged browser document bypassed the 5 MiB limit');
assert((await state(firstMeta)).revision === largeAccepted.revision, 'oversized merged browser document replaced canonical state');
canvas.revision = largeAccepted.revision;
writeFileSync(one.canvas, `${JSON.stringify(canvas, null, 2)}\n`);
canvas = await waitRevision(firstMeta, 7);

const polled = await fetch(`${api(firstMeta, 'poll')}?since=0`, { headers: auth(firstMeta, false) }).then((response) => response.json());
assert(polled.changed && polled.canvas.revision === 7, 'revision-gap polling did not return authoritative state');
const unchanged = await fetch(`${api(firstMeta, 'poll')}?since=7`, { headers: auth(firstMeta, false) }).then((response) => response.json());
assert(unchanged.changed === false, 'unchanged poll returned changed state');

const status = cli('status', '--run', 'first-run');
assert(status.includes(one.canvas) && status.includes('Revision: 7') && status.includes(one.url), 'status lacks exact run details');
const validate = cli('validate', '--run', 'first-run');
assert(validate.includes('revision 7'), 'validate did not report exact revision');

cli('close', '--run', 'first-run');
assert(!existsSync(runRoot) && existsSync(dirname(two.canvas)), 'close removed the wrong run or retained its directory');
assert((await state(secondMeta)).revision === 0, 'remaining run stopped working after close');
cli('close', '--run', 'second-run');
assert(!existsSync(dirname(two.canvas)), 'second run directory survived close');
await waitFor(() => !existsSync(join(process.env.HOME, '.newspaper', 'service.json')), 6000, 'service did not exit after idle condition');

const occupied = await Promise.all(Array.from({ length: 29 }, (_, index) => listen(6971 + index)));
const exhausted = spawnSync(process.execPath, [script, 'start', '--run', 'no-port'], {
  encoding: 'utf8', env: { ...process.env, NEWSPAPER_IDLE_MS: '800' },
});
assert(exhausted.status !== 0 && exhausted.stderr.includes('No available loopback port from 6971 through 6999'), 'detached startup hid the exhausted port-range failure');
await Promise.all(occupied.filter(Boolean).map((server) => new Promise((resolvePromise) => server.close(resolvePromise))));

console.log('newspaper runtime contract passed');

async function rejection(code, source) {
  writeFileSync(one.canvas, source);
  await waitValidation(runRoot, code);
  const served = await state(firstMeta);
  assert(served.revision === canvas.revision && served.nodes.lead.title === 'Edited in browser', `${code} replaced last valid state`);
}

function assertSafeMergeContract() {
  const originalObjectPrototype = { ...Object.prototype };
  const originalArrayPrototype = { ...Array.prototype };
  const attacks = [
    JSON.parse('{"nodes":{"lead":{"__proto__":{"polluted":true}}}}'),
    JSON.parse('{"nodes":{"lead":{"constructor":{"prototype":{"polluted":true}}}}}'),
    JSON.parse('{"nodes":{"lead":{"body":[{"prototype":{"polluted":true}}]}}}'),
  ];
  for (const attack of attacks) {
    let error;
    try { mergeCanvasPatch({ nodes: { lead: { title: 'safe' } } }, attack); }
    catch (caught) { error = caught; }
    assert(error?.code === 'unsafe_patch', 'unsafe merge key did not fail the direct merge contract');
    assert(Object.prototype.polluted === undefined && Array.prototype.polluted === undefined, 'merge polluted a global prototype');
    assert(JSON.stringify({ ...Object.prototype }) === JSON.stringify(originalObjectPrototype), 'merge changed Object.prototype');
    assert(JSON.stringify({ ...Array.prototype }) === JSON.stringify(originalArrayPrototype), 'merge changed Array.prototype');
  }
  const merged = mergeCanvasPatch({ nodes: { lead: { title: 'old', body: 'kept' } } }, { nodes: { lead: { title: 'new' } } });
  assert(Object.getPrototypeOf(merged) === Object.prototype && Object.getPrototypeOf(merged.nodes.lead) === Object.prototype, 'merge broke plain-object invariants');
  assert(merged.nodes.lead.title === 'new' && merged.nodes.lead.body === 'kept', 'safe recursive merge changed behavior');
}

function assertCardOverflowContract(stylesheet) {
  const baseCard = cssRule(stylesheet, '.card');
  const framedCard = cssRule(stylesheet, '.card[data-explicit-frame="true"]');
  assert(/(?:^|;)\s*overflow\s*:\s*visible\s*(?:;|$)/.test(baseCard), 'ordinary cards are horizontal scroll containers');
  assert(/(?:^|;)\s*overflow-x\s*:\s*hidden\s*(?:;|$)/.test(framedCard), 'explicitly framed cards can scroll horizontally');
  assert(/(?:^|;)\s*overflow-y\s*:\s*auto\s*(?:;|$)/.test(framedCard), 'explicitly framed cards cannot scroll vertically');
}

function assertTypographyContract(stylesheet) {
  const mastheadTitle = cssRule(stylesheet, '.masthead h1');
  const regionTitle = cssRule(stylesheet, '.region h2');
  const body = cssRule(stylesheet, '.card__body');
  const labels = cssRuleContainingSelector(stylesheet, '.card__type');
  const footer = cssRule(stylesheet, '.card__footer');
  const regionNavigation = cssRule(stylesheet, '.react-flow__panel.region-nav button');
  assert(cssNumber(mastheadTitle, 'line-height') >= 1.08 && cssNumber(mastheadTitle, 'padding-block') > 0, 'masthead title can clip vertically');
  assert(cssNumber(regionTitle, 'line-height') >= 1.1, 'region title can clip vertically');
  assert(cssNumber(body, 'font-size') >= 15, 'body text is below the newspaper reading size');
  assert(cssNumber(labels, 'font-size') >= 12, 'content labels are below the newspaper reading size');
  assert(cssNumber(footer, 'font-size') >= 11, 'card footer labels are below the newspaper reading size');
  assert(cssNumber(regionNavigation, 'font-size') >= 13, 'region navigation labels are below the newspaper reading size');
}

function cssRule(stylesheet, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return stylesheet.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
}

function cssRuleContainingSelector(stylesheet, selector) {
  for (const match of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].split(',').some((candidate) => candidate.trim() === selector)) return match[2];
  }
  return '';
}

function cssNumber(rule, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Number(rule.match(new RegExp(`(?:^|;)\\s*${escaped}\\s*:\\s*([0-9.]+)`))?.[1] ?? 0);
}

function cliAsync(...args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: { ...process.env, NEWSPAPER_IDLE_MS: '800' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => status === 0 ? resolvePromise(stdout) : reject(new Error(`CLI failed (${args.join(' ')}): ${stderr}`)));
  });
}

function cli(...args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8', env: { ...process.env, NEWSPAPER_IDLE_MS: '800' },
  });
  if (result.status !== 0) throw new Error(`CLI failed (${args.join(' ')}): ${result.stderr}`);
  return result.stdout;
}

function parseStart(output) {
  const canvas = output.match(/^Canvas: (.+)$/m)?.[1];
  const url = output.match(/^URL: (.+)$/m)?.[1];
  assert(canvas && url, `start output incomplete: ${output}`);
  return { canvas, url };
}

function api(meta, operation) {
  return `http://127.0.0.1:${meta.port}/api/runs/${encodeURIComponent(meta.runKey)}/${operation}`;
}

function auth(meta, json = true) {
  return { 'X-Newspaper-Token': meta.token, ...(json ? { 'Content-Type': 'application/json' } : {}) };
}

async function state(meta) {
  const response = await fetch(api(meta, 'state'), { headers: auth(meta, false) });
  assert(response.ok, `state fetch failed: ${response.status}`);
  return response.json();
}

async function waitRevision(meta, revision) {
  let latest;
  await waitFor(async () => {
    latest = await state(meta);
    return latest.revision >= revision;
  }, 4000, `revision ${revision} not observed`);
  return latest;
}

async function waitValidation(root, code) {
  await waitFor(() => {
    try { return JSON.parse(readFileSync(join(root, 'validation.json'), 'utf8')).code === code; }
    catch { return false; }
  }, 4000, `validation ${code} not observed`);
}

async function waitFor(predicate, timeout, message) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function waitWebSocketRevision(meta, expected) {
  return new Promise((resolvePromise, reject) => {
    const socket = net.connect(meta.port, '127.0.0.1');
    const key = randomBytes(16).toString('base64');
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('WebSocket notification timeout')); }, 4000);
    socket.on('connect', () => socket.write([
      `GET /ws/${encodeURIComponent(meta.runKey)} HTTP/1.1`, `Host: 127.0.0.1:${meta.port}`,
      'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13', `Sec-WebSocket-Protocol: ${meta.token}`, '', '',
    ].join('\r\n')));
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        assert(buffer.subarray(0, end).toString().includes('101 Switching Protocols'), 'WebSocket authentication failed');
        buffer = buffer.subarray(end + 4);
        upgraded = true;
      }
      while (buffer.length >= 2) {
        let length = buffer[1] & 0x7f;
        let offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        if (buffer.length < offset + length) return;
        const message = JSON.parse(buffer.subarray(offset, offset + length).toString());
        buffer = buffer.subarray(offset + length);
        if (message.type === 'revision' && message.revision === expected) {
          clearTimeout(timer); socket.destroy(); resolvePromise(expected);
        }
      }
    });
    socket.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function statusWithHost(port, host) {
  return new Promise((resolvePromise, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path: '/health', headers: { Host: host } }, (response) => {
      response.resume();
      response.on('end', () => resolvePromise(response.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
}

function listen(port) {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once('error', (error) => error.code === 'EADDRINUSE' ? resolvePromise(null) : reject(error));
    server.listen(port, '127.0.0.1', () => resolvePromise(server));
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
