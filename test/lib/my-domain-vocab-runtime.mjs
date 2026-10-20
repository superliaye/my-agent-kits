// Runtime contract for the deployed my-domain-vocab script. Every assertion goes through CLI output;
// the clock moves through the fake-clock preload and TZ.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skill = process.env.MY_DOMAIN_VOCAB_SKILL;
if (!skill) throw new Error('MY_DOMAIN_VOCAB_SKILL is required');
const script = join(skill, 'scripts', 'vocab.mjs');
const clockPreload = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'fake-clock.mjs')).href;
const home = process.env.HOME;
const store = join(home, '.my-domain-vocab');
const TZ = 'Asia/Kolkata';
const at = (local) => `${local}+05:30`;
let now = at('2026-03-02T10:00:00');

const scratch = mkdtempSync(join(tmpdir(), 'my-domain-vocab-test-'));
let docCounter = 0;
try {
  failFast();
  fieldsAndPaths();
  await concurrentFirstUse();
  phraseEvidence();
  longSentences();
  noiseStripping();
  markdownExports();
  hyphenatedCompounds();
  repeatedSentences();
  sentenceLogMigration();
  oneLineFences();
  interiorOneLetterWords();
  nestedStandalone();
  ladderAndQueue();
  archiveAndUndo();
  dailyCap();
  wordGrouping();
  formsBeforeBase();
  groupMerges();
  archiveCoversAllForms();
  staleCardAfterMerge();
  frequentBase();
  separateWrongMerge();
  separateTakesHistory();
  separateAfterRekey();
  separationProvenance();
  documentUnion();
  softWraps();
  pruning();
  readOnlyQuery();
  rebuildRecounts();
  console.log('my-domain-vocab runtime contract passed');
} catch (error) {
  console.error(`my-domain-vocab runtime: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

function failFast() {
  const isolated = join(scratch, 'no-sqlite-home');
  mkdirSync(isolated);
  const result = spawnSync(process.execPath, ['--no-experimental-sqlite', script, 'stats'], {
    encoding: 'utf8', env: { ...process.env, HOME: isolated, USERPROFILE: isolated },
  });
  assert(result.status !== 0, 'stats without node:sqlite exited zero');
  assert(/node:sqlite/.test(result.stderr) && /Node\.js/.test(result.stderr), `fail-fast message does not name the requirement: ${result.stderr}`);
  assert(!existsSync(join(isolated, '.my-domain-vocab')), 'fail-fast path created a database directory');
}

function fieldsAndPaths() {
  const bad = cli(['stats', '--field', 'Bad_Name']);
  assert(bad.status !== 0 && /--field/.test(bad.stderr), 'invalid --field was accepted');
  assert(!existsSync(join(store, 'Bad_Name.db')), 'invalid --field created a database');
  const second = vocab(['stats'], { field: 'second' });
  assert(second.documents === 0 && existsSync(join(store, 'second.db')), 'second field lacks its own database');
}

// Sessions that open a new field at the same moment all succeed.
async function concurrentFirstUse() {
  for (const field of ['parallel-a', 'parallel-b', 'parallel-c']) await openTogether(field, 12);
}

async function openTogether(field, sessions) {
  const results = await Promise.all(Array.from({ length: sessions }, (_, i) => {
    const dir = mkdtempSync(join(scratch, 'parallel-'));
    writeFileSync(join(dir, `session-${i}.md`), `Session ${'n'.repeat(i + 1)} wrote a note.`);
    return new Promise((done) => {
      const child = spawn(...invocation(['ingest', dir, '--field', field]));
      let stderr = '';
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('close', (status) => done({ status, stderr }));
    });
  }));
  const failed = results.filter((result) => result.status !== 0);
  assert(failed.length === 0, `concurrent first use failed: ${failed.map((result) => result.stderr.trim()).join(' | ')}`);
  assert(vocab(['stats'], { field }).documents === sessions, 'concurrent ingests lost a document');
}

function phraseEvidence() {
  const docs = [
    `The dead letter queue holds every failed message. We roll back the release when the canary looks unhealthy.
The on-call engineer can spin up a spare cluster. This design doc is the source of truth for the load balancer config.
Our blue widget renders the chart, and the blue widget, the blue widget, the blue widget keeps it tidy.
Ping @alice about ES-1234 and read \`kube proxy\` notes at https://zebra.example.com/stripe/crossing today.
\`\`\`
secret token secret token
\`\`\``,
    `Retries move poison messages to the dead letter queue after five attempts. If latency climbs, roll back first and debug later.
Page the on call person, then spin up extra capacity. Treat the runbook as the source of truth while the load balancer health check recovers.
The blue widget stays hidden. See \`kube proxy\` and https://zebra.example.com/stripe/crossing for context.
\`\`\`
secret token secret token
\`\`\``,
    `Drain the dead letter queue before the migration starts. Teams roll back schema changes with a script.
The on call rotation decides when to spin up the backup region. Keep one source of truth so the load balancer rules stay consistent.
Check \`kube proxy\` output and https://zebra.example.com/stripe/crossing again.
\`\`\`
secret token secret token
\`\`\``,
    `Alerts fire when the dead letter queue grows quickly. Operators roll back faulty flags while the dashboard shows latency.
Whoever is on call should spin up a debugger. That dashboard is the source of truth for load balancer traffic.`,
  ];
  const first = ingest([docs[0]]);
  ingest([docs[1]]);
  let pendingTerms = vocab(['pending']).phrases.map((p) => p.term);
  assert(!pendingTerms.includes('dead letter queue'), 'a phrase from two documents reached pending');
  const third = ingest([docs[2]]);
  const qualified = third.newly_qualified;
  for (const phrase of ['dead letter queue', 'load balancer', 'roll back', 'spin up', 'on call', 'source of truth']) {
    assert(qualified.includes(phrase), `"${phrase}" did not qualify at three documents: ${JSON.stringify(qualified)}`);
  }
  ingest([docs[3]]);
  pendingTerms = vocab(['pending']).phrases.map((p) => p.term);
  for (const phrase of ['dead letter queue', 'load balancer', 'roll back', 'spin up', 'on call', 'source of truth']) {
    assert(pendingTerms.includes(phrase), `"${phrase}" missing from pending`);
  }
  for (const phrase of ['blue widget', 'dead letter', 'letter queue', 'load balancer config', 'kube proxy', 'secret token']) {
    assert(!pendingTerms.includes(phrase), `"${phrase}" reached pending`);
  }
  const words = vocab(['query', "SELECT word FROM corpus_words WHERE word IN ('zebra', 'stripe', 'crossing', 'kube', 'secret', 'alice', 'es')"]);
  assert(words.rows.length === 0, `stripped text reached the corpus: ${JSON.stringify(words.rows)}`);
  const cards = vocab(['next', '--new', '1000']).cards;
  assert(cards.length > 0 && cards.every((c) => c.kind === 'word'), 'next exposed a candidate phrase');

  const before = vocab(['show', 'load balancer']).term;
  const tokensBefore = vocab(['stats']).tokens;
  const again = ingest([docs[0]], 'resent');
  assert(again.ingested.length === 0 && again.duplicates.length === 1, 'duplicate document was ingested');
  const after = vocab(['show', 'load balancer']).term;
  assert(after.raw_count === before.raw_count && after.raw_doc_count === before.raw_doc_count && after.doc_count === before.doc_count,
    'duplicate document raised phrase counts');
  assert(vocab(['stats']).tokens === tokensBefore, 'duplicate document raised corpus counts');
  assert(first.ingested.length === 1, 'first ingest reported no document');
}

// A sentence with no punctuation is tokenized whole; only the stored example is clipped.
function longSentences() {
  const field = 'long';
  const padding = 'our team reviewed the rollout plan with care and then we checked every dashboard twice '.repeat(5);
  const docs = [['first', 'north'], ['second', 'south'], ['third', 'east']]
    .map(([lead, side]) => `${lead} ${padding}${side} quokka burrow`);
  assert(docs.every((doc) => doc.indexOf('quokka') > 300 && !/[.!?,;:]/.test(doc)), 'long-sentence fixture is malformed');
  ingest(docs, 'long', field);
  const counted = vocab(['query', "SELECT count FROM corpus_words WHERE word = 'quokka'"], { field }).rows;
  assert(counted[0]?.count === 3, `a word after 300 characters was not counted: ${JSON.stringify(counted)}`);
  assert(vocab(['top', '--limit', '1000'], { field }).terms.some((t) => t.term === 'quokka'), 'a word after 300 characters missing from top');
  const words = docs.reduce((sum, doc) => sum + doc.trim().split(/\s+/).length, 0);
  assert(vocab(['stats'], { field }).tokens === words, 'corpus token total dropped words of a long sentence');
  assert(vocab(['pending'], { field }).phrases.some((p) => p.term === 'quokka burrow'), 'a phrase after 300 characters did not qualify');
  for (const term of ['quokka', 'quokka burrow']) {
    const example = vocab(['show', term], { field }).examples[0].sentence;
    assert(example.length <= 300 && example.includes(term), `stored example is over 300 characters or lacks "${term}": ${example}`);
  }
}

// Paths and markup tags are stripped; slash-joined word pairs and comparison signs keep their words.
function noiseStripping() {
  const field = 'strip';
  ingest([String.raw`The client/server split and read/write paths matter. If latency < 5 and errors > 3 we page.
See src/lib/vocab.js and ./scripts/run and C:\tools\bin for setup. <div class="note">Rendered</div> text.
Replace <api token> before the call. Our k8s and s3 setup runs 24 hours.`], 'strip', field);
  const kept = vocab(['query', `SELECT word FROM corpus_words WHERE word IN ('client', 'server', 'read', 'write', 'latency',
    'errors', 'setup', 'rendered', 'src', 'lib', 'vocab', 'scripts', 'run', 'tools', 'bin', 'div', 'note', 'api', 'token', 'k8s', 's3', 'hours', '24')`], { field })
    .rows.map((row) => row.word).sort();
  assert(JSON.stringify(kept) === JSON.stringify(['api', 'client', 'errors', 'hours', 'k8s', 'latency', 'read', 'rendered', 's3', 'server', 'setup', 'token', 'write']),
    `noise stripping kept or dropped the wrong words: ${JSON.stringify(kept)}`);
}

// A Markdown export ingests as is: a link keeps its label, and markup, images, mailto names, and escapes go.
function markdownExports() {
  const field = 'markdown';
  ingest([String.raw`# Rollout plan {#rollout-plan}

<!--bg:#666666--> Ask [Wren Tanager](mailto:wren@example.com) about the **gradual** rollout \[soon\] and [[Optional] canary checks](#[optional]-canary-checks).

![image1](/tmp/doc_image1.png) The *pelican* config stays one\-way.`], 'md', field);
  const words = vocab(['query', 'SELECT word FROM corpus_words ORDER BY word'], { field }).rows.map((row) => row.word);
  for (const word of ['rollout', 'gradual', 'canary', 'checks', 'optional', 'pelican', 'one', 'way']) {
    assert(words.includes(word), `a Markdown export lost "${word}": ${JSON.stringify(words)}`);
  }
  for (const word of ['wren', 'tanager', 'mailto', 'image1', 'bg', 'tmp', 'doc']) {
    assert(!words.includes(word), `a Markdown export kept "${word}": ${JSON.stringify(words)}`);
  }
  const phrases = vocab(['query', "SELECT key FROM terms WHERE kind = 'phrase'"], { field }).rows.map((row) => row.key);
  assert(phrases.includes('gradual rollout') && phrases.includes('canary checks'), `emphasis or link syntax split a phrase: ${JSON.stringify(phrases)}`);
}

// A hyphenated compound is one unit: a filler part may stand at a phrase edge, and no phrase cuts through it.
function hyphenatedCompounds() {
  const field = 'hyphen';
  ingest(['This choice is a one-way door for the team.', 'Treat the schema as a one-way door today.', 'Renaming it later is a one-way door too.'],
    'hy', field);
  const pendingTerms = vocab(['pending'], { field }).phrases.map((p) => p.term);
  assert(pendingTerms.includes('one way door'), `a hyphenated compound with a filler part did not qualify: ${JSON.stringify(pendingTerms)}`);
  const phrases = vocab(['query', "SELECT key FROM terms WHERE kind = 'phrase'"], { field }).rows.map((row) => row.key);
  assert(!phrases.includes('way door'), `a phrase cut through a hyphenated compound: ${JSON.stringify(phrases)}`);
  assert(vocab(['show', 'one-way door'], { field }).term.key === 'one way door', 'the hyphenated spelling did not resolve to its phrase');
}

// A sentence repeated word for word, in one document or across several, counts once.
function repeatedSentences() {
  const field = 'boilerplate';
  const template = 'Fill in the rollout checklist below. Describe the threat model here.';
  ingest([`${template} Pelicans nest on the cliff.`, `${template} Gannets dive for fish. Gannets dive for fish.`, `${template} Puffins carry fish.`],
    'tpl', field);
  const count = (name) => {
    const { raw_doc_count: docs, raw_count: n } = vocab(['show', name], { field }).term;
    return { docs, n };
  };
  assert(JSON.stringify(count('rollout checklist')) === '{"docs":1,"n":1}' && JSON.stringify(count('threat model')) === '{"docs":1,"n":1}',
    `a template sentence counted more than once: ${JSON.stringify([count('rollout checklist'), count('threat model')])}`);
  assert(count('gannets').n === 1, `a sentence repeated in one document counted twice: ${JSON.stringify(count('gannets'))}`);
  assert(count('fish').docs === 2, `fresh sentences that share words lost a document: ${JSON.stringify(count('fish'))}`);
  assert(vocab(['pending'], { field }).phrases.length === 0, 'template boilerplate reached pending');
}

// A version 1 store fills its sentence log from the saved documents on first use.
function sentenceLogMigration() {
  const field = 'migrate';
  ingest(['Describe the threat model here. Pelicans nest.'], 'mig', field);
  const sql = "DROP TABLE sentences; PRAGMA user_version = 1;";
  const downgrade = spawnSync(process.execPath, ['--no-warnings', '-e',
    `new (require('node:sqlite').DatabaseSync)(process.argv[1]).exec(${JSON.stringify(sql)})`, join(store, `${field}.db`)], { encoding: 'utf8' });
  assert(downgrade.status === 0, `could not build a version 1 store: ${downgrade.stderr}`);
  ingest(['Describe the threat model here. Gannets dive.'], 'mig', field);
  const docs = vocab(['query', "SELECT raw_doc_count AS docs FROM terms WHERE key = 'threat model'"], { field }).rows[0].docs;
  assert(docs === 1, `a migrated store counted an old sentence again: ${docs}`);
  assert(vocab(['query', 'PRAGMA user_version'], { field }).rows[0].user_version === 2, 'the store did not migrate to version 2');
}

// A line holding only a one-line ```code``` span is inline code, not a fence that swallows the prose after it.
function oneLineFences() {
  const field = 'fence';
  ingest(['```npm test```\nAlbatross notes follow here.\n\nGannet notes too.\n\n```make lint```\nPuffin closes it.'], 'fence', field);
  const kept = vocab(['query', "SELECT word FROM corpus_words WHERE word IN ('albatross', 'gannet', 'puffin', 'npm', 'lint')"], { field })
    .rows.map((row) => row.word).sort();
  assert(JSON.stringify(kept) === JSON.stringify(['albatross', 'gannet', 'puffin']), `one-line code spans dropped prose or kept code: ${JSON.stringify(kept)}`);
}

// A one-letter word is not a term, but it may sit inside a phrase.
function interiorOneLetterWords() {
  const field = 'idiom';
  ingest(['Please take a look at the rollout plan today.', 'Can you take a look before the review?', 'I will take a look at the logs tonight.'],
    'idiom', field);
  assert(vocab(['pending'], { field }).phrases.some((p) => p.term === 'take a look'), 'a phrase with an interior one-letter word did not qualify');
  assert(!vocab(['top', '--limit', '1000'], { field }).terms.some((t) => t.term === 'a'), 'a one-letter word became a term');
}

// A shorter phrase that also appears outside its qualified longer phrase keeps those documents.
function nestedStandalone() {
  const field = 'nested';
  // A repeated sentence counts once, so each padding sentence is unique.
  const padding = (doc) => Array.from({ length: 8 }, (_, k) => `Engineers wrote notes about caching and retries on day ${doc}${k}. `
    + `Reviewers asked for clearer metrics and smaller diffs in round ${doc}${k}. `).join('');
  ingest([['stores', 'lunch'], ['holds', 'dinner'], ['keeps', 'noon']].map(([verb, time], doc) =>
    `The feature flag service ${verb} rollout rules. Flip the feature flag before ${time}. ${padding(doc)}`), 'nested', field);
  const pendingTerms = vocab(['pending'], { field }).phrases.map((p) => p.term);
  assert(pendingTerms.includes('feature flag service'), `the longer phrase did not qualify: ${JSON.stringify(pendingTerms)}`);
  assert(pendingTerms.includes('feature flag'), `standalone uses of a nested phrase were discarded: ${JSON.stringify(pendingTerms)}`);
  assert(!pendingTerms.includes('flag service'), 'a phrase seen only inside a qualified longer phrase qualified');
}

function ladderAndQueue() {
  now = at('2026-03-02T10:00:00');
  const steps = [
    ['canary', 'pass', 'learning', 2, '2026-03-05'],
    ['canary', 'pass', 'learning', 3, '2026-03-09'],
    ['canary', 'pass', 'recognized', 4, '2026-03-23'],
    ['canary', 'pass', 'recognized', 5, '2026-05-01'],
    ['canary', 'pass', 'active', 6, '2026-05-01'],
    ['canary', 'pass', 'active', 6, '2026-05-01'],
    ['canary', 'hold', 'active', 6, '2026-05-01'],
    ['canary', 'fail', 'learning', 1, '2026-03-03'],
    ['canary', 'pass', 'learning', 2, '2026-03-05'],
    ['migration', 'fail', 'learning', 1, '2026-03-03'],
    ['migration', 'fail', 'learning', 1, '2026-03-03'],
  ];
  for (const [term, answer, state, box, due] of steps) {
    const result = vocab(['review', term, answer, '--rev', String(rev(term))]);
    assert(result.to.state === state && result.to.box === box && result.to.due === due,
      `${term} ${answer} gave ${JSON.stringify(result.to)}, expected ${state}/${box}/${due}`);
  }
  vocab(['set', 'recognized', 'runbook', '--box', '4']);
  let held = vocab(['review', 'runbook', 'hold', '--rev', String(rev('runbook'))]);
  assert(held.to.state === 'recognized' && held.to.box === 4 && held.to.due === '2026-03-23', 'recognized hold changed the box');
  vocab(['set', 'recognized', 'runbook', '--box', '5']);
  held = vocab(['review', 'runbook', 'hold', '--rev', String(rev('runbook'))]);
  assert(held.to.box === 5 && held.to.due === '2026-05-01', 'box 5 hold used the wrong interval');
  const failed = vocab(['review', 'runbook', 'fail', '--rev', String(rev('runbook'))]);
  assert(failed.to.state === 'learning' && failed.to.box === 1 && failed.to.due === '2026-03-03', 'compose fail did not reset to box 1');

  rejects(['review', 'migration', 'hold', '--rev', String(rev('migration'))], 'hold on a recognize card');
  rejects(['review', 'retries', 'hold', '--rev', String(rev('retries'))], 'hold on a new card');
  rejects(['review', 'canary', 'pass', '--rev', String(rev('canary') - 1)], 'stale rev', /stale/);
  rejects(['review', 'blue widget', 'pass', '--rev', '0'], 'review of a candidate');

  // Local midnight: 23:59 and 00:01 IST fall on the same UTC day but on different local days.
  now = at('2026-03-02T23:59:00');
  const late = vocab(['review', 'debugger', 'pass', '--rev', String(rev('debugger'))]);
  assert(late.to.due === '2026-03-05', `review at 23:59 local counted from the wrong day: ${late.to.due}`);
  now = at('2026-03-03T00:01:00');
  const early = vocab(['review', 'capacity', 'pass', '--rev', String(rev('capacity'))]);
  assert(early.to.due === '2026-03-06', `review at 00:01 local counted from the wrong day: ${early.to.due}`);
  now = at('2026-03-04T23:59:00');
  assert(!dueTerms().includes('debugger'), 'term was due before its local day');
  now = at('2026-03-05T00:00:30');
  assert(dueTerms().includes('debugger'), 'term was not due at the start of its local day');

  const queue = vocab(['next']).cards;
  const firstNew = queue.findIndex((c) => c.state === 'new');
  assert(firstNew > 0 && queue.slice(firstNew).every((c) => c.state === 'new'), 'next did not return due reviews before new terms');
  assert(queue.filter((c) => c.state === 'new').length === 10, 'next did not apply the default daily cap of 10');
  for (const c of queue) {
    assert(c.mode === (['new', 'learning'].includes(c.state) ? 'recognize' : 'compose'), `card mode ${c.mode} does not follow ${c.state}`);
    assert(Array.isArray(c.examples) && c.examples.length >= 1 && c.examples.length <= 3, 'card examples missing or over 3');
  }
}

function archiveAndUndo() {
  now = at('2026-03-05T09:00:00');
  vocab(['set', 'learning', 'dashboard', '--box', '3', '--due', '2026-03-09']);
  for (const [args, label] of [
    [['set', 'learning', 'dashboard', '--box', '5'], 'learning at box 5'],
    [['set', 'recognized', 'dashboard', '--box', '2'], 'recognized at box 2'],
    [['set', 'active', 'dashboard', '--box', '4'], 'active at box 4'],
    [['set', 'archived', 'dashboard', '--box', '2'], 'archived with a new box'],
    [['set', 'known', 'dashboard'], 'an unknown state'],
    [['set', 'candidate', 'dashboard'], 'a word as candidate'],
    [['set', 'archived', 'dashboard', 'no-such-term'], 'an unknown term'],
  ]) rejects(args, label);
  const kept = vocab(['show', 'dashboard']).term;
  assert(kept.state === 'learning' && kept.box === 3 && kept.due === '2026-03-09', 'a rejected set changed the term');
  const migration = vocab(['show', 'migration']).term;
  const ignoredDue = vocab(['set', 'ignored', 'migration', '--due', '2026-04-01']).changed[0].to;
  assert(ignoredDue.state === 'ignored' && ignoredDue.box === migration.box && ignoredDue.due === '2026-04-01',
    `set ignored --due did not keep the box and set the due date: ${JSON.stringify(ignoredDue)}`);

  const frozenBefore = {
    dashboard: vocab(['show', 'dashboard']).term,
    latency: vocab(['show', 'latency']).term,
    rollBack: vocab(['show', 'roll back']).term,
    queue: vocab(['show', 'dead letter queue']).term,
  };
  const controlBefore = vocab(['show', 'canary']).term;
  const bulk = vocab(['set', 'archived', 'dashboard', 'latency', 'dead letter queue']);
  assert(bulk.changed.length === 3, 'bulk archive did not change all three terms');
  vocab(['set', 'ignored', 'roll back']);

  const visible = visibleTerms();
  for (const term of ['dashboard', 'latency', 'dead letter queue', 'roll back']) {
    assert(!visible.includes(term), `${term} is still visible after archive or ignore`);
  }

  ingest([`The dashboard shows latency again, so we roll back. The dead letter queue is quiet and the canary is green.`]);
  ingest([`Another dead letter queue drill ran while the canary stayed green.`]);
  ingest([`A third dead letter queue review closed the canary incident.`]);
  for (const [name, term] of [['dashboard', 'dashboard'], ['latency', 'latency'], ['rollBack', 'roll back'], ['queue', 'dead letter queue']]) {
    const after = vocab(['show', term]).term;
    assert(after.doc_count === frozenBefore[name].doc_count && after.count === frozenBefore[name].count,
      `${term} user-facing counts moved while frozen`);
    assert(after.raw_doc_count > frozenBefore[name].raw_doc_count, `${term} raw counts stopped while frozen`);
  }
  const controlAfter = vocab(['show', 'canary']).term;
  assert(controlAfter.doc_count === controlBefore.doc_count + 3, 'control term counts did not rise');
  assert(!vocab(['pending']).phrases.some((p) => p.term === 'letter queue' || p.term === 'dead letter'),
    'nested phrase qualified after its longer phrase was archived');

  const shown = vocab(['show', 'dashboard']);
  assert(shown.term.state === 'archived' && shown.term.box === 3 && shown.term.due === '2026-03-09', 'archive did not keep box and due');
  const last = shown.history.at(-1);
  assert(last.from_state === 'learning' && last.from_box === 3 && last.to_state === 'archived', 'history lacks the archive transition');
  const undo = vocab(['set', last.from_state, 'dashboard', '--box', String(last.from_box)]);
  assert(undo.changed[0].to.state === 'learning' && undo.changed[0].to.box === 3 && undo.changed[0].to.due === '2026-03-09',
    `undo did not restore the learning position: ${JSON.stringify(undo.changed[0].to)}`);
  vocab(['set', 'new', 'latency']);
  assert(vocab(['next', '--new', '1000']).cards.some((c) => c.term === 'latency'), 'undone archive did not return to the queue');
  assert(vocab(['show', 'latency']).term.doc_count === frozenBefore.latency.doc_count, 'undo replaced frozen counts');
}

function dailyCap() {
  const field = 'cap';
  now = at('2026-04-01T09:00:00');
  ingest(['Kestrel heron osprey falcon plover. Kestrel heron osprey falcon plover.'], 'birds', field);
  let cards = vocab(['next', '--new', '2'], { field }).cards;
  assert(cards.length === 2 && cards.every((c) => c.state === 'new'), 'cap of 2 did not limit new cards');
  vocab(['review', cards[0].term, 'pass', '--rev', String(cards[0].rev)], { field });
  vocab(['review', cards[1].term, 'fail', '--rev', String(cards[1].rev)], { field });
  const failedTerm = cards[1].term;
  cards = vocab(['next', '--new', '2'], { field }).cards;
  assert(cards.length === 0, 'daily cap did not stop new cards after two introductions');
  now = at('2026-04-02T00:00:10');
  cards = vocab(['next', '--new', '2'], { field }).cards;
  assert(cards[0].term === failedTerm && cards[0].state === 'learning', 'due review did not lead the next day');
  assert(cards.filter((c) => c.state === 'new').length === 2, 'daily cap did not reset at local midnight');
}

function wordGrouping() {
  const field = 'words';
  ingest(['Two cases failed while the databases synced. We used it and it uses more. The statuses changed. The process is running slowly. The service deployed. The seed data loads.'], 'w1', field);
  ingest(['This case matters, the case is open, and the case is clear. The database grows. Use the tool and keep using it. One status remains. Run the job. Deploy the fix. We see it.'], 'w2', field);
  const key = (form) => vocab(['show', form], { field }).term.key;
  for (const [form, base] of [
    ['cases', 'case'], ['case', 'case'], ['databases', 'database'], ['used', 'use'], ['uses', 'use'], ['using', 'use'],
    ['statuses', 'status'], ['process', 'process'], ['running', 'run'], ['deployed', 'deploy'], ['seed', 'seed'], ['see', 'see'],
  ]) assert(key(form) === base, `${form} grouped under ${key(form)}, expected ${base}`);
  const use = vocab(['show', 'use'], { field });
  assert(['use', 'used', 'uses', 'using'].every((f) => use.forms.some((x) => x.form === f)), 'use group lacks a form');
  assert(vocab(['show', 'cases'], { field }).term.display === 'case', 'display is not the most frequent form');
}

// A form seen before its own base still joins one group, and every card's name resolves to that card's term.
// The same holds when each form arrives in its own document.
function formsBeforeBase() {
  const sentences = ['Read the findings first.', 'We find bugs.', 'The finding was clear. Each finding helps. One finding stayed.'];
  for (const [field, docs] of [
    ['form-order', [sentences.join(' ')]],
    ['form-order-docs', sentences],
    ['form-order-pair', ['Our findings matter.', 'We find a finding.']],
    ['form-order-swap', ['Our findings matter.', 'A finding we find.']],
  ]) {
    for (const doc of docs) ingest([doc], 'fo', field);
    const ids = ['findings', 'finding', 'find'].map((form) => vocab(['show', form], { field }).term.id);
    assert(new Set(ids).size === 1, `${field}: forms of one word landed in different groups: ${JSON.stringify(ids)}`);
    for (const c of vocab(['next', '--new', '1000'], { field }).cards) {
      const shown = vocab(['show', c.term], { field }).term;
      assert(shown.display === c.term, `${field}: card "${c.term}" resolves to the term shown as "${shown.display}"`);
    }
  }
}

function groupMerges() {
  const field = 'merge';
  ingest(['They uses it. They used it. We tested them, and the tests passed. Two tables broke. He checks it. She checked it. She walks home.'], 'm1', field);
  vocab(['set', 'learning', 'checks', '--box', '1', '--due', '2026-03-22'], { field });
  vocab(['set', 'learning', 'checked', '--box', '3', '--due', '2026-03-23'], { field });
  vocab(['set', 'learning', 'uses', '--box', '2', '--due', '2026-03-20'], { field });
  vocab(['set', 'learning', 'walks', '--box', '2', '--due', '2026-03-19'], { field });
  vocab(['set', 'archived', 'used'], { field });
  vocab(['set', 'learning', 'tested', '--box', '3', '--due', '2026-03-21'], { field });
  const both = vocab(['set', 'archived', 'tables', 'Tables'], { field });
  assert(both.changed.length === 1 && both.unchanged.length === 0, 'two names for one term wrote two changes');
  const frozen = { used: vocab(['show', 'used'], { field }).term, tables: vocab(['show', 'tables'], { field }).term };
  const second = ingest(['We use it. One table stays. We test it. Check it. We walk.'], 'm2', field);
  assert(second.new_words === 2, `new_words is not the number of word terms created ("one", "stays"): ${second.new_words}`);

  const check = vocab(['show', 'checks'], { field }).term;
  assert(check.key === 'check' && check.state === 'learning' && check.box === 3 && check.due === '2026-03-23',
    `merge of two learning groups did not keep the higher box: ${JSON.stringify(check)}`);

  const walk = vocab(['show', 'walks'], { field }).term;
  assert(walk.key === 'walk' && walk.state === 'learning' && walk.box === 2 && walk.due === '2026-03-19',
    `rekey did not keep the learning position: ${JSON.stringify(walk)}`);
  const use = vocab(['show', 'uses'], { field }).term;
  assert(use.key === 'use' && use.id === vocab(['show', 'used'], { field }).term.id && use.state === 'archived'
    && use.doc_count === frozen.used.doc_count && use.count === frozen.used.count,
    `an archived form did not take its in-play forms along with frozen counts: ${JSON.stringify(use)}`);
  assert(!visibleTerms(field).some((term) => ['use', 'used', 'uses'].includes(term)), 'an archived word came back into next, top, or pending');

  const test = vocab(['show', 'tests'], { field });
  assert(test.term.key === 'test' && test.term.state === 'learning' && test.term.box === 3 && test.term.due === '2026-03-21',
    `merge did not keep the group further along: ${JSON.stringify(test.term)}`);
  const merged = test.history.find((h) => h.command.startsWith('merge '));
  assert(merged && merged.from_state === merged.to_state && merged.from_box === merged.to_box,
    'merge history row records a position move');

  const table = vocab(['show', 'table'], { field }).term;
  assert(table.key === 'table' && table.state === 'archived', 'rekey changed the archived group');
  assert(table.doc_count === frozen.tables.doc_count && table.count === frozen.tables.count
    && table.raw_doc_count === frozen.tables.raw_doc_count + 1, 'rekey moved frozen counts or stopped raw counts');
}

// Archiving or ignoring a word covers all its forms. The merged group is the same whichever group the
// merge meets first: sentence order within a document, or which form the user archived.
function archiveCoversAllForms() {
  const outcome = (field, forms) => {
    const shown = forms.map((form) => vocab(['show', form], { field }));
    assert(new Set(shown.map((s) => s.term.id)).size === 1, `${field}: forms of one word landed in different groups`);
    assert(!visibleTerms(field).some((term) => forms.includes(term)), `${field}: an archived word came back into next, top, or pending`);
    const { key, state, box, due, doc_count: docCount, count, raw_doc_count: rawDocs, raw_count: raw } = shown[0].term;
    return JSON.stringify({ key, state, box, due, docCount, count, rawDocs, raw, forms: shown[0].forms.map((f) => f.form).sort() });
  };
  const sentenceOrder = [['archive-order-a', 'The finding helps. We find bugs.'], ['archive-order-b', 'We find bugs. The finding helps.']]
    .map(([field, second]) => {
      ingest(['Our findings matter. He finds bugs.'], 'ao', field);
      vocab(['set', 'archived', 'findings'], { field });
      vocab(['set', 'learning', 'finds', '--box', '2'], { field });
      ingest([second], 'ao', field);
      return outcome(field, ['findings', 'finding', 'finds', 'find']);
    });
  assert(sentenceOrder[0] === sentenceOrder[1], `sentence order changed the merged group: ${sentenceOrder.join(' vs ')}`);
  assert(JSON.parse(sentenceOrder[0]).state === 'archived' && JSON.parse(sentenceOrder[0]).docCount === 1,
    `archive did not cover every form with frozen counts: ${sentenceOrder[0]}`);

  const archivedSide = [['archive-side-a', 'used', 'uses'], ['archive-side-b', 'uses', 'used']]
    .map(([field, archived, learning]) => {
      ingest(['They uses it. They used it.'], 'as', field);
      vocab(['set', 'learning', learning, '--box', '2'], { field });
      vocab(['set', 'archived', archived], { field });
      ingest(['We use it.'], 'as', field);
      return outcome(field, ['use', 'used', 'uses']);
    });
  assert(archivedSide[0] === archivedSide[1], `the archived form changed the merged group: ${archivedSide.join(' vs ')}`);
  assert(JSON.parse(archivedSide[0]).state === 'archived', `archive did not cover every form: ${archivedSide[0]}`);

  const field = 'archive-over-ignore';
  ingest(['Our findings matter. He finds bugs.'], 'ai', field);
  vocab(['set', 'ignored', 'findings'], { field });
  vocab(['set', 'archived', 'finds'], { field });
  ingest(['The finding helps. We find bugs.'], 'ai', field);
  assert(JSON.parse(outcome(field, ['findings', 'finding', 'finds', 'find'])).state === 'archived', 'ignored outranked archived in a merge');
}

// A card read before a merge must not apply to the merged group, even when per-term change counts match.
function staleCardAfterMerge() {
  const field = 'merge-rev';
  ingest(['He checks it. She checked it.'], 'mr1', field);
  for (const due of ['2026-03-20', '2026-03-21', '2026-03-22']) {
    vocab(['set', 'learning', 'checks', '--box', '1', '--due', due], { field });
  }
  vocab(['set', 'learning', 'checked', '--box', '2'], { field });
  vocab(['set', 'learning', 'checked', '--box', '3'], { field });
  const card = vocab(['show', 'checks'], { field }).term;
  ingest(['Check it.'], 'mr2', field);
  const merged = vocab(['show', 'checks'], { field }).term;
  assert(merged.key === 'check' && merged.box === 3, `fixture did not merge into the box-3 group: ${JSON.stringify(merged)}`);
  rejects(['review', 'checks', 'pass', '--rev', String(card.rev)], 'a card read before a merge', /stale/, { field });
  const after = vocab(['show', 'checks'], { field });
  assert(after.term.box === 3, 'a stale card moved the merged group');
  const own = after.history.filter((h) => h.command.startsWith('set ') && h.merged_from === 'checked');
  const absorbed = after.history.filter((h) => h.merged_from === 'checks');
  assert(own.length === 2 && own.every((h) => h.to_box >= 2) && absorbed.length === 3 && absorbed.every((h) => h.to_box === 1),
    `merged history rows are not told apart from the group's own rows: ${JSON.stringify(after.history)}`);
}

// When a form has several bases in the corpus, it groups under the more frequent one.
function frequentBase() {
  const field = 'frequent-base';
  ingest(['The stat looks odd. The state is clear and the state holds. We stated it.'], 'fb', field);
  const stated = vocab(['show', 'stated'], { field }).term;
  assert(stated.key === 'state', `stated grouped under ${stated.key}, expected the more frequent base state`);
}

// A separated form leaves its group for good: its own term in play, its own counts, and no merge back
// in a later ingest or a rebuild.
function separateWrongMerge() {
  const field = 'separate';
  ingest(['A new build shipped. The new flag works.'], 'sep', field);
  vocab(['set', 'archived', 'new'], { field });
  ingest(['We read the news. The news helps today.'], 'sep', field);
  assert(vocab(['show', 'news'], { field }).term.key === 'new', 'fixture did not fold news into new');
  const split = vocab(['separate', 'news'], { field });
  assert(JSON.stringify(split.separated) === '["news"]' && split.term.state === 'new' && split.from.state === 'archived',
    `separate did not split news into a new term: ${JSON.stringify(split)}`);
  rejects(['separate', 'new'], 'separating a group\'s base form', /base form/, { field });
  const check = (label) => {
    const news = vocab(['show', 'news'], { field });
    const base = vocab(['show', 'new'], { field });
    assert(news.term.key === 'news' && news.term.state === 'new' && news.term.id !== base.term.id,
      `${label}: news is not its own term in play: ${JSON.stringify(news.term)}`);
    assert(!base.forms.some((f) => f.form === 'news') && base.term.state === 'archived', `${label}: the base kept news or lost its state`);
    assert(news.examples.every((e) => /\bnews\b/i.test(e.sentence)) && base.examples.every((e) => /\bnew\b/i.test(e.sentence)),
      `${label}: examples of news stayed with the base`);
    assert(news.history.some((h) => h.command === 'separate from new' && h.from_state === 'archived' && h.to_state === 'new')
      && base.history.some((h) => h.command === 'separate news'), `${label}: history does not report the separation`);
    assert(visibleTerms(field).includes('news') && !visibleTerms(field).includes('new'), `${label}: the queue shows the wrong term`);
    return { news: news.term, base: base.term };
  };
  const first = check('after separate');
  assert(first.news.doc_count === 1 && first.news.raw_doc_count === 1 && first.base.raw_doc_count === 1,
    `separate did not split the counts: ${JSON.stringify(first)}`);
  ingest(['More news arrived with a new plan.'], 'sep', field);
  const later = check('after a later ingest');
  assert(vocab(['show', 'news'], { field }).examples.length === 1, 'news in play stored no example');
  assert(later.news.doc_count === 2 && later.base.doc_count === first.base.doc_count, `a later ingest miscounted: ${JSON.stringify(later)}`);
  const rebuilt = vocab(['rebuild'], { field });
  assert(rebuilt.terms_merged === 0 && rebuilt.groups_rejoined === 0, `rebuild folded the separated form back: ${JSON.stringify(rebuilt)}`);
  const after = check('after rebuild');
  assert(JSON.stringify(after) === JSON.stringify(later), `rebuild changed the separated terms: ${JSON.stringify(later)} -> ${JSON.stringify(after)}`);
}

// A separated form takes back the history it brought into the group and resumes its own position;
// then it joins the base it does belong to.
function separateTakesHistory() {
  const field = 'separate-history';
  ingest(['The stats look odd. We stated it.'], 'sh', field);
  vocab(['set', 'learning', 'stated', '--box', '2', '--due', '2026-06-01'], { field });
  vocab(['set', 'learning', 'stats', '--box', '3', '--due', '2026-06-02'], { field });
  ingest(['One stat matters.'], 'sh', field);
  const merged = vocab(['show', 'stated'], { field });
  assert(merged.term.key === 'stat' && merged.history.some((h) => h.merged_from === 'stated'), 'fixture did not fold stated into stat');
  const split = vocab(['separate', 'stated'], { field });
  assert(split.moved_history === 1, `separate did not move the form's history: ${JSON.stringify(split)}`);
  const stated = vocab(['show', 'stated'], { field });
  assert(stated.term.state === 'learning' && stated.term.box === 2 && stated.term.due === '2026-06-01',
    `separated form did not resume its own position: ${JSON.stringify(stated.term)}`);
  const statShown = vocab(['show', 'stat'], { field });
  assert(stated.examples.some((e) => e.sentence === 'We stated it.') && !statShown.examples.some((e) => e.sentence === 'We stated it.'),
    'separate did not move the form\'s examples');
  const stat = statShown.term;
  assert(stat.state === 'learning' && stat.box === 3 && stat.due === '2026-06-02', `the base lost its position: ${JSON.stringify(stat)}`);
  ingest(['The state is clear. The state holds.'], 'sh', field);
  const joined = vocab(['show', 'stated'], { field }).term;
  assert(joined.key === 'state' && joined.box === 2 && vocab(['show', 'stat'], { field }).term.id !== joined.id,
    `the separated form did not join its real base: ${JSON.stringify(joined)}`);
  const snapshot = () => JSON.stringify(['stat', 'stats', 'state', 'stated'].map((form) => vocab(['show', form], { field }).term));
  const before = snapshot();
  vocab(['rebuild'], { field });
  assert(snapshot() === before, `rebuild moved a separated form: ${before} -> ${snapshot()}`);
}

// A form studied before its base appeared keeps that history through the re-key, and takes it back
// when separated.
function separateAfterRekey() {
  const field = 'separate-rekey';
  ingest(['We read the news. The news helps.'], 'sr', field);
  vocab(['set', 'learning', 'news', '--box', '3', '--due', '2026-06-03'], { field });
  ingest(['A new build shipped.'], 'sr', field);
  assert(vocab(['show', 'new'], { field }).term.key === 'new', 'fixture did not re-key news to new');
  const split = vocab(['separate', 'news'], { field });
  assert(split.moved_history === 1, `separate did not move history written before the re-key: ${JSON.stringify(split)}`);
  const news = vocab(['show', 'news'], { field });
  assert(news.term.state === 'learning' && news.term.box === 3 && news.term.due === '2026-06-03'
    && news.history.some((h) => h.command === 'set learning'), `news did not resume its own position: ${JSON.stringify(news)}`);
  const before = JSON.stringify(vocab(['show', 'news'], { field }).term);
  vocab(['rebuild'], { field });
  assert(JSON.stringify(vocab(['show', 'news'], { field }).term) === before, 'rebuild moved the separated form');
}

// History rows carry the base form of the group that wrote them, whether that group was absorbed in an
// ingest or re-keyed by a rebuild, so separating a form returns only its own group's history.
function separationProvenance() {
  const field = 'separate-provenance';
  ingest(['The settings changed. One setting stays. The settings help. He sets it.'], 'sp', field);
  const shown = vocab(['show', 'settings'], { field }).term;
  assert(shown.key === 'setting' && shown.display === 'settings', `fixture did not group settings under setting: ${JSON.stringify(shown)}`);
  vocab(['set', 'learning', 'sets', '--box', '3', '--due', '2026-06-05'], { field });
  vocab(['set', 'learning', 'setting', '--box', '2', '--due', '2026-06-04'], { field });
  ingest(['Set it.'], 'sp', field);
  assert(vocab(['show', 'setting'], { field }).term.key === 'set', 'fixture did not merge setting into set');
  const plural = vocab(['separate', 'settings'], { field });
  assert(plural.moved_history === 0 && plural.term.state === 'new', `separating one form took its whole group's history: ${JSON.stringify(plural)}`);
  vocab(['set', 'learning', 'settings', '--box', '3', '--due', '2026-06-06'], { field });
  const group = vocab(['separate', 'setting'], { field });
  assert(group.moved_history === 1, `separating the group's base form did not return its history: ${JSON.stringify(group)}`);
  // The separated settings rejoins setting at once, as a rebuild would, and the higher box wins.
  const joined = vocab(['show', 'settings'], { field }).term;
  assert(joined.key === 'setting' && joined.box === 3 && joined.due === '2026-06-06',
    `separate did not re-key settings under setting: ${JSON.stringify(joined)}`);
  const rebuilt = vocab(['rebuild'], { field });
  assert(rebuilt.terms_merged === 0 && JSON.stringify(vocab(['show', 'settings'], { field }).term) === JSON.stringify(joined),
    `rebuild disagreed with live grouping after two separations: ${JSON.stringify(rebuilt)}`);
  const again = vocab(['separate', 'settings'], { field });
  assert(again.moved_history >= 1 && again.term.state === 'learning' && again.term.box === 3 && again.term.due === '2026-06-06',
    `rows written before the re-key did not follow the form: ${JSON.stringify(again)}`);
}

// A document that uses several forms of one word counts once for it, in ingest and in rebuild.
function documentUnion() {
  const field = 'union';
  ingest(['He checks it. She checked it.'], 'un', field);
  ingest(['Check it.'], 'un', field);
  const counts = () => {
    const { doc_count: docs, raw_doc_count: rawDocs, count, raw_count: raw } = vocab(['show', 'checked'], { field }).term;
    return { docs, rawDocs, count, raw };
  };
  const ingested = counts();
  assert(JSON.stringify(ingested) === JSON.stringify({ docs: 2, rawDocs: 2, count: 3, raw: 3 }),
    `check counted documents more than once: ${JSON.stringify(ingested)}`);
  assert(vocab(['top', '--limit', '1000'], { field }).terms.find((t) => t.term === 'check' || t.term === 'checks' || t.term === 'checked').doc_count === 2,
    'top reports an inflated document count');
  vocab(['rebuild'], { field });
  assert(JSON.stringify(counts()) === JSON.stringify(ingested), `rebuild counted documents differently: ${JSON.stringify(counts())}`);
}

function softWraps() {
  const field = 'wrap';
  ingest([
    'We watched the replica\nlag climb during the first test.\n\n- alpha item\n- beta item',
    'Ops saw replica\nlag again on Monday.',
    'The replica\nlag alert fired twice.',
  ], 'wrap', field);
  const pending = vocab(['pending'], { field }).phrases;
  const lag = pending.find((p) => p.term === 'replica lag');
  assert(lag, 'a phrase across a soft line wrap did not qualify');
  assert(!vocab(['query', "SELECT 1 FROM terms WHERE key = 'item beta'"], { field }).rows.length, 'a phrase crossed two list items');
  const examples = vocab(['show', 'replica lag'], { field }).examples;
  assert(examples[0].sentence.includes('replica lag'), `example kept the line break fragment: ${examples[0].sentence}`);
}

function pruning() {
  const field = 'prune';
  ingest(['An orange pelican landed once. A teal heron left. An amber falcon circled.'], 'once', field);
  const exists = (key = 'orange pelican') => vocab(['query', `SELECT 1 FROM terms WHERE key = '${key}'`], { field }).rows.length === 1;
  assert(exists(), 'candidate was not stored');
  vocab(['set', 'new', 'teal heron'], { field });
  // A candidate the user changed and later returned keeps its history.
  vocab(['set', 'new', 'amber falcon'], { field });
  vocab(['set', 'candidate', 'amber falcon'], { field });
  ingest(Array.from({ length: 199 }, (_, i) => `Later note ${i}.`), 'later', field);
  assert(exists(), 'candidate was pruned before 200 later documents');
  ingest(['The final later note.'], 'last', field);
  assert(!exists(), 'one-document candidate survived 200 later documents');
  const promoted = vocab(['show', 'teal heron'], { field }).term;
  assert(promoted.raw_doc_count === 1, 'a promoted one-document phrase was pruned');
  assert(exists('amber falcon') && vocab(['show', 'amber falcon'], { field }).history.length === 2,
    'pruning erased a candidate with history');
  const touched = vocab(['show', 'amber falcon'], { field }).term;
  const rebuilt = vocab(['rebuild'], { field });
  assert(!exists() && rebuilt.terms_without_occurrences === 0, `rebuild pruned differently from ingest: ${JSON.stringify(rebuilt)}`);
  assert(JSON.stringify(vocab(['show', 'teal heron'], { field }).term) === JSON.stringify(promoted), 'rebuild changed a promoted one-document phrase');
  assert(JSON.stringify(vocab(['show', 'amber falcon'], { field }).term) === JSON.stringify(touched), 'rebuild changed a candidate with history');
}

function readOnlyQuery() {
  const schema = vocab(['query', "SELECT sql FROM sqlite_master WHERE name = 'terms'"]);
  assert(/CREATE TABLE terms/.test(schema.rows[0]?.sql ?? ''), 'query cannot read the schema');
  rejects(['query', 'DELETE FROM terms'], 'a write through query');
  assert(vocab(['stats']).documents > 0, 'query write removed data');
}

// rebuild recounts the saved texts: with the rules unchanged every count, form, phrase, and the queue
// come back identical, and every term keeps its learning state.
function rebuildRecounts() {
  const field = 'rebuild';
  now = at('2026-05-04T09:00:00');
  const note = (verb, extra) => `The feature flag service ${verb} rollout rules. Flip the feature flag before lunch, as it ${verb} them. `
    + `Our findings matter and the canary checks pass when it ${verb} them. ${extra}`;
  const texts = [note('stores', 'We find bugs.'), note('holds', 'Lunch ran late.')];
  ingest(texts, 'rb', field);
  vocab(['review', 'canary', 'pass', '--rev', String(vocab(['show', 'canary'], { field }).term.rev)], { field });
  vocab(['set', 'archived', 'findings'], { field });
  vocab(['set', 'archived', 'lunch'], { field });
  texts.push(note('keeps', 'The finding helps.'));
  ingest([texts[2]], 'rb', field);
  vocab(['set', 'new', 'lunch'], { field });
  vocab(['set', 'new', 'feature flag service'], { field });
  vocab(['set', 'ignored', 'rollout rules'], { field });
  texts.push(note('guards', 'Lunch moved.'));
  ingest([texts[3]], 'rb', field);
  const again = ingest([texts[0]], 'rb', field);
  assert(again.duplicates.length === 1, 'rebuild fixture re-ingested a duplicate');

  const docsDir = join(store, field, 'docs');
  const saved = readdirSync(docsDir).map((name) => readFileSync(join(docsDir, name), 'utf8')).sort();
  assert(JSON.stringify(saved) === JSON.stringify([...texts].sort()), 'saved document texts differ from the ingested documents');

  const rows = (sql) => vocab(['query', sql], { field }).rows;
  const snapshot = () => JSON.stringify({
    terms: rows('SELECT id, key, display, kind, state, box, due, rev, doc_count, count, raw_doc_count, raw_count, last_doc, frozen_at FROM terms ORDER BY id'),
    forms: rows('SELECT form, term_id, count FROM word_forms ORDER BY form'),
    corpus: rows('SELECT word, count FROM corpus_words ORDER BY word'),
    contexts: rows('SELECT term_id, doc_no, left_key, right_key, count FROM phrase_contexts ORDER BY term_id, doc_no, left_key, right_key, count'),
    history: rows('SELECT * FROM history ORDER BY id'),
    reviews: rows('SELECT * FROM reviews ORDER BY id'),
    examples: rows(`SELECT term_id, sentence, source, doc_no FROM examples WHERE term_id IN (SELECT id FROM terms
      WHERE kind = 'word' AND id NOT IN (SELECT term_id FROM history WHERE to_state IN ('archived', 'ignored')))
      ORDER BY term_id, doc_no, sentence`),
    stats: vocab(['stats'], { field }),
    pending: vocab(['pending'], { field }).phrases,
    next: vocab(['next', '--new', '1000'], { field }).cards.map(({ examples, ...rest }) => rest),
  });
  // Rebuilt examples may add sentences that ingest skipped while a phrase was a candidate or a word archived.
  const examples = () => new Map(vocab(['next', '--new', '1000'], { field }).cards
    .map((c) => [c.term, vocab(['show', c.term], { field }).examples.map((e) => `${e.source}: ${e.sentence}`)]));
  const before = snapshot();
  const examplesBefore = examples();
  const parsed = JSON.parse(before);
  assert(parsed.pending.some((p) => p.term === 'feature flag'), `rebuild fixture has no pending phrase: ${JSON.stringify(parsed.pending)}`);
  const lunch = parsed.terms.find((t) => t.key === 'lunch');
  assert(lunch.state === 'new' && lunch.doc_count < lunch.raw_doc_count, `rebuild fixture lacks a term that missed documents while archived: ${JSON.stringify(lunch)}`);
  assert(parsed.terms.find((t) => t.key === 'find').state === 'archived', 'rebuild fixture lacks an archived word group');

  const rebuilt = vocab(['rebuild'], { field });
  assert(rebuilt.documents_total === texts.length && rebuilt.terms_created === 0 && rebuilt.terms_merged === 0 && rebuilt.groups_rejoined === 0
    && rebuilt.terms_without_occurrences === 0 && rebuilt.terms_dropped === 0 && rebuilt.newly_qualified.length === 0,
    `rebuild of unchanged rules reported changes: ${JSON.stringify(rebuilt)}`);
  const after = snapshot();
  assert(after === before, `rebuild changed counts or learning state:\n${before}\n${after}`);
  for (const [term, list] of examples()) {
    const had = examplesBefore.get(term);
    assert(had.every((e) => list.includes(e)),
      `rebuild lost card examples of "${term}": ${JSON.stringify(had)} -> ${JSON.stringify(list)}`);
  }

  const moved = join(scratch, 'moved-doc.txt');
  renameSync(join(docsDir, readdirSync(docsDir)[0]), moved);
  rejects(['rebuild', '--field', field], 'a rebuild with a missing saved text', /saved text.*Ingest those documents again/s);
  assert(snapshot() === before, 'a refused rebuild changed the database');
  const restored = ingest([readFileSync(moved, 'utf8')], 'rb', field);
  assert(restored.duplicates.length === 1 && restored.restored_texts.length === 1, `re-ingest did not restore the saved text: ${JSON.stringify(restored)}`);
  vocab(['rebuild'], { field });
  assert(snapshot() === before, 'rebuild after restoring a saved text changed counts or learning state');
}

function ingest(texts, prefix = 'doc', field) {
  const dir = mkdtempSync(join(scratch, 'ingest-'));
  texts.forEach((text, i) => {
    docCounter += 1;
    writeFileSync(join(dir, `${prefix}-${String(i).padStart(3, '0')}-${docCounter}.md`), text);
  });
  const result = vocab(['ingest', dir], { field });
  rmSync(dir, { recursive: true, force: true });
  return result;
}

function rev(term) {
  return vocab(['show', term]).term.rev;
}

function dueTerms() {
  return vocab(['next', '--new', '0']).cards.map((c) => c.term);
}

// The script under the fake clock: arguments for spawn or spawnSync.
function invocation(args) {
  return [process.execPath, ['--import', clockPreload, script, ...args], { env: { ...process.env, TZ, FAKE_NOW: now } }];
}

function cli(args) {
  const [command, argv, options] = invocation(args);
  return spawnSync(command, argv, { ...options, encoding: 'utf8' });
}

function withField(args, field) {
  return field ? [...args, '--field', field] : args;
}

// Terms the user can see: today's cards, the top list, and pending phrases.
function visibleTerms(field) {
  return [
    ...vocab(['next', '--new', '1000'], { field }).cards.map((c) => c.term),
    ...vocab(['top', '--limit', '1000'], { field }).terms.map((t) => t.term),
    ...vocab(['pending'], { field }).phrases.map((p) => p.term),
  ];
}

function vocab(args, { field } = {}) {
  const full = withField(args, field);
  const result = cli(full);
  assert(result.status === 0, `vocab ${full.join(' ')} failed: ${result.stderr}`);
  assert(result.stderr === '', `vocab ${full.join(' ')} wrote to stderr: ${result.stderr}`);
  const output = JSON.parse(result.stdout);
  assert(output.db === join(store, `${field ?? 'default'}.db`), `vocab ${full[0]} did not print the database path`);
  assert(output.docs_dir === join(store, field ?? 'default', 'docs'), `vocab ${full[0]} did not print the saved-documents path`);
  assert(existsSync(output.db), `printed database path does not exist: ${output.db}`);
  return output;
}

function rejects(args, label, pattern, { field } = {}) {
  const result = cli(withField(args, field));
  assert(result.status !== 0, `accepted ${label}`);
  assert(result.stdout === '', `printed output for rejected ${label}`);
  if (pattern) assert(pattern.test(result.stderr), `rejection of ${label} did not explain: ${result.stderr}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
