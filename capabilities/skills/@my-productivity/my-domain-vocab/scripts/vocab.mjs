#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// node:sqlite prints an ExperimentalWarning on load; drop the printer before the dynamic import.
process.removeAllListeners("warning");
let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  fail("needs the built-in node:sqlite module (Node.js 22.13 or later; Node.js 24 LTS recommended).");
}

const SCHEMA_VERSION = 2;
const STORE = join(homedir(), ".my-domain-vocab");
const INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 21, 5: 60, 6: 60 };
const BOXES = {
  candidate: [0, 0], new: [0, 0], learning: [1, 3], recognized: [4, 5], active: [6, 6],
};
const STATES = ["candidate", "new", "learning", "recognized", "active", "archived", "ignored"];
const FROZEN = new Set(["archived", "ignored"]);
const REVIEWABLE = new Set(["new", "learning", "recognized", "active"]);
const SCHEDULED = new Set(["learning", "recognized", "active"]);
const HIDDEN = new Set(["candidate", ...FROZEN]);
const SCORE_CUTOFF = 10.83;
const MIN_DOCS = 3;
const PRUNE_AFTER_DOCS = 200;
const DAILY_NEW_CAP = 10;
const MAX_EXAMPLES = 10;
const MAX_EXAMPLE_CHARS = 300;
const RANK = "doc_count DESC, count DESC, id";
const statements = new WeakMap();
const HYPHEN = "";
const PARTICLES = new Set("up out off over down back in on through away".split(" "));
const START_PREPOSITIONS = new Set("on in at out".split(" "));
const FILLER = new Set(`
a about above after again against all also am an and any are aren't as at away back be because been
before being below between both but by can can't cannot could couldn't did didn't do does doesn't doing
don't down during each either else even ever every few for from further get gets got had hadn't has
hasn't have haven't having he her here hers herself him himself his how however i i'd i'll i'm i've if
in into is isn't it its itself just let let's may me might more most must my myself no nor not now of
off on once one only or other our ours ourselves out over own per quite rather really same shall she
should shouldn't so some such than that that's the their theirs them themselves then there there's
these they they'd they'll they're they've this those though through thus to too under until up upon
us very via was wasn't we we'd we'll we're we've were weren't what what's when where which while who
whom whose why will with within without won't would wouldn't yet you you'd you'll you're you've your
yours yourself yourselves
`.trim().split(/\s+/));

const argv = parseArgs(process.argv.slice(2));
const field = argv.flags.field ?? "default";
if (!/^[a-z0-9-]+$/.test(field)) fail(`--field must match ^[a-z0-9-]+$ (got "${field}").`);
const dbPath = join(STORE, `${field}.db`);
// The text of every ingested document, named by its content hash, so `rebuild` can recount it.
const docsDir = join(STORE, field, "docs");

const COMMANDS = { ingest, rebuild, pending, next, review, set, separate, show, top, stats, query };
const run = COMMANDS[argv.command];
if (!run) {
  fail("usage: vocab.mjs <ingest <dir>|rebuild|pending|next [--new N]|review <term> pass|fail|hold --rev N|"
    + "set <state> <term>... [--box N] [--due YYYY-MM-DD|today]|separate <form>|show <term>|top [--limit N]|stats|query <sql>> "
    + "[--field <name>]");
}
try {
  const result = run(argv.args, argv.flags);
  process.stdout.write(`${JSON.stringify({ db: dbPath, docs_dir: docsDir, ...result }, null, 2)}\n`);
} catch (error) {
  fail(error.message);
}

function ingest(args, flags) {
  allowFlags(flags, []);
  if (args.length !== 1) throw new Error("ingest takes one directory.");
  const dir = resolve(args[0]);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`not a directory: ${dir}`);
  const files = readdirSync(dir).filter((name) => !name.startsWith(".")).sort()
    .filter((name) => statSync(join(dir, name)).isFile());
  const db = openStore();
  mkdirSync(docsDir, { recursive: true, mode: 0o700 });
  return transaction(db, () => {
    const before = pendingKeys(db);
    let newWords = 0;
    let pruned = 0;
    const ingested = [];
    const duplicates = [];
    const restored = [];
    for (const name of files) {
      const text = readFileSync(join(dir, name), "utf8");
      const hash = contentHash(text);
      if (prepare(db, "SELECT 1 FROM docs WHERE hash = ?").get(hash)) {
        duplicates.push(name);
        if (savedText(hash) === null) {
          writeFileSync(savedPath(hash), text, { mode: 0o600 });
          restored.push(name);
        }
        continue;
      }
      writeFileSync(savedPath(hash), text, { mode: 0o600 });
      const docNo = metaNumber(db, "doc_seq") + 1;
      prepare(db, "INSERT INTO docs (hash, source, doc_no, ingested_at) VALUES (?, ?, ?, ?)")
        .run(hash, name, docNo, new Date().toISOString());
      const added = addDocument(db, text, name, docNo, 1, []);
      newWords += added.created;
      pruned += added.pruned;
      ingested.push(name);
    }
    const after = pendingPhrases(db);
    return {
      ingested,
      duplicates,
      restored_texts: restored,
      documents_total: metaNumber(db, "doc_seq"),
      new_words: newWords,
      newly_qualified: newlyQualified(before, after),
      pending_total: after.length,
      pruned_candidates: pruned,
    };
  });
}

// Recounts every saved document with the current rules in a scratch store, then moves each term's
// learning state onto the term that now holds its key or forms. The replay runs without the write
// lock; the transplant runs under it only when the replay's inputs are still current.
function rebuild(args, flags) {
  allowFlags(flags, []);
  noArgs(args, "rebuild");
  const db = openStore();
  for (let attempt = 1; ; attempt += 1) {
    const inputs = replayInputs(db);
    const texts = inputs.docs.map((doc) => savedText(doc.hash));
    const lost = inputs.docs.filter((doc, i) => texts[i] === null).map((doc) => doc.source);
    if (lost.length) {
      throw new Error(`the saved text of ${lost.length} document(s) is missing or changed in ${docsDir} `
        + `(${lost.join(", ")}); nothing was rebuilt. Ingest those documents again to restore their text.`);
    }
    const fresh = new DatabaseSync(":memory:");
    createSchema(fresh);
    const separation = prepare(fresh, "INSERT INTO separations (form, base, at) VALUES (?, ?, ?)");
    for (const row of inputs.separations) separation.run(row.form, row.base, row.at);
    inputs.docs.forEach((doc, i) => addDocument(fresh, texts[i], doc.source, doc.doc_no, MAX_EXAMPLES, inputs.kept));
    const result = transaction(db, () => {
      if (replayInputs(db).signature !== inputs.signature) return null;
      const before = pendingKeys(db);
      const moved = transplant(db, fresh);
      const after = pendingPhrases(db);
      return {
        documents_total: inputs.docs.length,
        ...moved,
        newly_qualified: newlyQualified(before, after),
        pending_total: after.length,
      };
    });
    fresh.close();
    if (result) return result;
    if (attempt === 3) throw new Error("other sessions kept adding documents or changing phrases during rebuild; run it again.");
  }
}

// What a replay depends on: the documents, the phrases kept from pruning, and the separations. Every
// scratch phrase is a candidate, so the phrases the user has touched are kept from pruning as they
// are in the live store.
function replayInputs(db) {
  const inputs = {
    docSeq: metaNumber(db, "doc_seq"),
    docs: prepare(db, "SELECT hash, source, doc_no FROM docs ORDER BY doc_no").all(),
    kept: prepare(db, `SELECT key FROM terms WHERE kind = 'phrase' AND (state != 'candidate'
      OR id IN (SELECT term_id FROM history) OR id IN (SELECT term_id FROM reviews)) ORDER BY key`).all().map((row) => row.key),
    separations: prepare(db, "SELECT form, base, at FROM separations ORDER BY form, base").all(),
  };
  return { ...inputs, signature: JSON.stringify([inputs.docSeq, inputs.docs.length, inputs.kept, inputs.separations]) };
}

// Replaces the statistics in db with those in fresh. A term keeps its id, state, box, due date, rev,
// history, and reviews; occurrences it missed while archived or ignored stay out of its user-facing
// counts. Learning state whose words no longer occur stays on a term with no occurrences.
function transplant(db, fresh) {
  const oldTerms = prepare(db, "SELECT * FROM terms ORDER BY id").all();
  const oldForms = new Map();
  const oldOwner = new Map();
  for (const { form, term_id: termId } of prepare(db, "SELECT form, term_id FROM word_forms ORDER BY count DESC, form").all()) {
    if (!oldForms.has(termId)) oldForms.set(termId, []);
    oldForms.get(termId).push(form);
    oldOwner.set(form, termId);
  }
  const oldShown = new Map(prepare(db, "SELECT form, doc_no, shown FROM form_docs").all()
    .map((row) => [`${row.form}\u0000${row.doc_no}`, row.shown]));
  // A form merge is permanent until a separation, so the scratch groups that now hold forms of one old
  // group join again.
  let rejoined = 0;
  for (const term of oldTerms) {
    if (term.kind !== "word") continue;
    for (const form of oldForms.get(term.id) ?? []) {
      const keep = [term.key, ...oldForms.get(term.id)].map((name) => termByForm(fresh, name)).find(Boolean);
      const other = termByForm(fresh, form);
      if (other && other.id !== keep.id && merge(fresh, keep, other)) rejoined += 1;
    }
  }
  const freshTerms = prepare(fresh, "SELECT * FROM terms ORDER BY id").all();
  const freshPhrase = new Map(freshTerms.filter((term) => term.kind === "phrase").map((term) => [term.key, term.id]));
  const freshOwner = new Map(prepare(fresh, "SELECT form, term_id FROM word_forms").all().map((row) => [row.form, row.term_id]));
  const heirs = new Map();
  const orphans = [];
  for (const term of oldTerms) {
    const freshId = term.kind === "phrase" ? freshPhrase.get(term.key)
      : [term.key, ...(oldForms.get(term.id) ?? [])].map((form) => freshOwner.get(form)).find((id) => id !== undefined);
    if (freshId === undefined) orphans.push(term);
    else if (heirs.has(freshId)) heirs.get(freshId).push(term);
    else heirs.set(freshId, [term]);
  }

  for (const table of ["word_forms", "form_docs", "examples", "phrase_contexts", "corpus_words", "sentences"]) db.exec(`DELETE FROM ${table}`);
  // Park every key, so terms can take their new keys in any order.
  db.exec("UPDATE terms SET key = char(1) || id");
  const idOf = new Map();
  const stateOf = new Map();
  let created = 0;
  let merged = 0;
  for (const term of freshTerms) {
    const olds = heirs.get(term.id) ?? [];
    if (olds.length === 0) {
      const id = Number(prepare(db, `INSERT INTO terms (key, display, kind, state, box, doc_count, count,
        raw_doc_count, raw_count, last_doc) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`)
        .run(term.key, term.display, term.kind, term.state, term.doc_count, term.count, term.raw_doc_count,
          term.raw_count, term.last_doc).lastInsertRowid);
      idOf.set(term.id, id);
      stateOf.set(id, term.state);
      created += 1;
      continue;
    }
    const survivor = olds.reduce((a, b) => (outranks(b, a) > 0 ? b : a));
    if (survivor.key !== term.key) tagRows(db, survivor.id, survivor.key);
    for (const other of olds) {
      if (other === survivor) continue;
      absorb(db, survivor, other);
      merged += 1;
    }
    // A word's user-facing counts come from its form_docs rows below; a phrase subtracts what it missed.
    const missed = (raw, shown) => olds.reduce((sum, old) => sum + old[raw] - old[shown], 0);
    const [docCount, count] = FROZEN.has(survivor.state)
      ? [survivor.doc_count, survivor.count]
      : [Math.max(0, term.raw_doc_count - missed("raw_doc_count", "doc_count")), Math.max(0, term.raw_count - missed("raw_count", "count"))];
    prepare(db, `UPDATE terms SET key = ?, display = ?, doc_count = ?, count = ?, raw_doc_count = ?, raw_count = ?,
      last_doc = ? WHERE id = ?`)
      .run(term.key, term.display, docCount, count, term.raw_doc_count, term.raw_count, term.last_doc, survivor.id);
    idOf.set(term.id, survivor.id);
    stateOf.set(survivor.id, survivor.state);
  }
  let withoutOccurrences = 0;
  let dropped = 0;
  for (const term of orphans) {
    const touched = scalar(db, `SELECT (SELECT count(*) FROM history WHERE term_id = ?)
      + (SELECT count(*) FROM reviews WHERE term_id = ?)`, term.id, term.id);
    if (!touched && (term.state === "candidate" || term.state === "new")) {
      prepare(db, "DELETE FROM terms WHERE id = ?").run(term.id);
      dropped += 1;
      continue;
    }
    const frozen = FROZEN.has(term.state) && term.kind === "phrase";
    prepare(db, `UPDATE terms SET key = ?, raw_doc_count = 0, raw_count = 0, doc_count = ?, count = ? WHERE id = ?`)
      .run(term.key, frozen ? term.doc_count : 0, frozen ? term.count : 0, term.id);
    if (term.kind === "word") prepare(db, "INSERT INTO word_forms (form, term_id, count) VALUES (?, ?, 0)").run(term.key, term.id);
    withoutOccurrences += 1;
  }

  const copy = (table, columns) => {
    const insert = prepare(db, `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
    for (const row of prepare(fresh, `SELECT ${columns.join(", ")} FROM ${table} ORDER BY rowid`).all()) {
      insert.run(...columns.map((column) => (column === "term_id" ? idOf.get(row.term_id) : row[column])));
    }
  };
  copy("word_forms", ["form", "term_id", "count"]);
  copy("examples", ["term_id", "sentence", "source", "doc_no"]);
  copy("phrase_contexts", ["term_id", "doc_no", "left_key", "right_key", "count"]);
  copy("corpus_words", ["word", "count"]);
  copy("sentences", ["hash"]);
  // An occurrence keeps the visibility it had; a frozen group shows only occurrences it showed itself,
  // so its user-facing counts can fall with a rule change but never rise.
  const owners = new Map(prepare(fresh, "SELECT form, term_id FROM word_forms").all().map((row) => [row.form, idOf.get(row.term_id)]));
  const addFormDoc = prepare(db, "INSERT INTO form_docs (form, doc_no, count, shown) VALUES (?, ?, ?, ?)");
  for (const row of prepare(fresh, "SELECT form, doc_no, count FROM form_docs").all()) {
    const id = owners.get(row.form);
    const was = oldShown.get(`${row.form}\u0000${row.doc_no}`);
    const shown = FROZEN.has(stateOf.get(id)) ? Number(was === 1 && oldOwner.get(row.form) === id) : (was ?? 1);
    addFormDoc.run(row.form, row.doc_no, row.count, shown);
  }
  for (const id of new Set(owners.values())) recount(db, id);
  // The scratch store kept every term's examples; a candidate keeps only its first, as ingest does.
  db.exec(`DELETE FROM examples WHERE term_id IN (SELECT id FROM terms WHERE state = 'candidate')
    AND id NOT IN (SELECT min(id) FROM examples GROUP BY term_id)`);
  setMeta(db, "total_tokens", metaNumber(fresh, "total_tokens"));
  return { terms_created: created, terms_merged: merged, groups_rejoined: rejoined, terms_without_occurrences: withoutOccurrences, terms_dropped: dropped };
}

// One document through the counting rules; the caller has recorded it in docs. Phrases in kept, and
// candidates with history or reviews, are never pruned.
function addDocument(db, text, source, docNo, candidateExamples, kept) {
  setMeta(db, "doc_seq", docNo);
  const created = ingestDocument(db, analyze(text, sentenceLog(db)), source, docNo, candidateExamples);
  const pruned = prepare(db, `DELETE FROM terms WHERE kind = 'phrase' AND state = 'candidate'
    AND raw_doc_count = 1 AND last_doc <= ? AND key NOT IN (SELECT value FROM json_each(?))
    AND NOT EXISTS (SELECT 1 FROM history WHERE term_id = terms.id)
    AND NOT EXISTS (SELECT 1 FROM reviews WHERE term_id = terms.id)`)
    .run(docNo - PRUNE_AFTER_DOCS, JSON.stringify(kept)).changes;
  return { created, pruned: Number(pruned) };
}

function sentenceLog(db) {
  const insert = prepare(db, "INSERT OR IGNORE INTO sentences (hash) VALUES (?)");
  return (sentence) => insert.run(sentenceHash(sentence)).changes > 0;
}

// 48 bits of the case-folded sentence's SHA-256: an exact SQLite integer, and a collision only lets one
// sentence go uncounted.
function sentenceHash(sentence) {
  return createHash("sha256").update(sentence.toLowerCase()).digest().readUIntBE(0, 6);
}

function contentHash(text) {
  return createHash("sha256").update(text).digest("hex");
}

function savedPath(hash) {
  return join(docsDir, `${hash}.txt`);
}

// The saved text of a document, or null when it is missing or no longer matches its hash.
function savedText(hash) {
  if (!existsSync(savedPath(hash))) return null;
  const text = readFileSync(savedPath(hash), "utf8");
  return contentHash(text) === hash ? text : null;
}

function pending(args, flags) {
  allowFlags(flags, []);
  noArgs(args, "pending");
  return { phrases: pendingPhrases(openStore()) };
}

function next(args, flags) {
  allowFlags(flags, ["new"]);
  noArgs(args, "next");
  const cap = flags.new === undefined ? DAILY_NEW_CAP : intFlag(flags.new, "--new", 0);
  const db = openStore();
  const day = today();
  const due = dueReviews(db, day);
  const introduced = introducedOn(db, day);
  const room = Math.max(0, cap - introduced);
  const fresh = prepare(db, `SELECT * FROM terms WHERE state = 'new'
    ORDER BY ${RANK} LIMIT ?`).all(room);
  return {
    today: day,
    due_reviews: due.length,
    new_today: introduced,
    new_cap: cap,
    cards: [...due, ...fresh].map((term) => card(db, term)),
  };
}

function review(args, flags) {
  allowFlags(flags, ["rev"]);
  if (args.length !== 2) throw new Error("review takes <term> pass|fail|hold --rev N.");
  const [name, answer] = args;
  if (!["pass", "fail", "hold"].includes(answer)) throw new Error(`answer must be pass, fail, or hold (got "${answer}").`);
  if (flags.rev === undefined) throw new Error("review needs --rev from the card.");
  const rev = intFlag(flags.rev, "--rev", 0);
  const db = openStore();
  return transaction(db, () => {
    const term = resolveTerm(db, name);
    if (term.rev !== rev) {
      throw new Error(`stale card for "${term.display}": rev is ${term.rev}, card had ${rev}. Re-read it with show.`);
    }
    if (!REVIEWABLE.has(term.state)) throw new Error(`"${term.display}" is ${term.state}, which is not reviewable.`);
    const mode = cardMode(term.state);
    if (answer === "hold" && mode !== "compose") throw new Error(`hold applies only to compose cards; "${term.display}" is ${term.state}.`);
    const [state, box] = ladder(term, answer);
    const due = addDays(today(), INTERVALS[box]);
    const updated = change(db, term, { state, box, due }, `review ${answer}`);
    prepare(db, `INSERT INTO reviews (term_id, at, day, answer, mode, from_state, from_box, to_state, to_box, due)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(term.id, new Date().toISOString(), today(), answer, mode, term.state, term.box, state, box, due);
    return { term: term.display, answer, from: position(term), to: position(updated), rev: updated.rev };
  });
}

function set(args, flags) {
  allowFlags(flags, ["box", "due"]);
  const [state, ...names] = args;
  if (!STATES.includes(state)) throw new Error(`state must be one of ${STATES.join(", ")} (got "${state}").`);
  if (names.length === 0) throw new Error("set needs at least one term.");
  if (FROZEN.has(state) && flags.box !== undefined) throw new Error(`${state} terms keep the box they had; omit --box.`);
  const box = flags.box === undefined ? undefined : intFlag(flags.box, "--box", 0);
  const due = flags.due === undefined ? undefined : dayFlag(flags.due);
  const db = openStore();
  return transaction(db, () => {
    const terms = [...new Map(names.map((name) => resolveTerm(db, name)).map((term) => [term.id, term])).values()];
    const changed = [];
    const unchanged = [];
    for (const term of terms) {
      if (state === "candidate" && term.kind !== "phrase") throw new Error(`"${term.display}" is a word; only phrases can be candidates.`);
      let target;
      if (FROZEN.has(state)) {
        target = { state, box: term.box, due: due ?? term.due };
      } else {
        const [low, high] = BOXES[state];
        const keep = term.box >= low && term.box <= high;
        const nextBox = box ?? (keep ? term.box : low);
        target = { state, box: nextBox, due: due ?? (nextBox === term.box ? term.due : today()) };
        if (target.box < low || target.box > high) {
          throw new Error(`${state} allows box ${low === high ? low : `${low}-${high}`}, not ${target.box}.`);
        }
      }
      if (target.state === term.state && target.box === term.box && target.due === term.due) {
        unchanged.push(term.display);
        continue;
      }
      const updated = change(db, term, target, `set ${state}`);
      changed.push({ term: term.display, from: position(term), to: position(updated), rev: updated.rev });
    }
    return { state, changed, unchanged };
  });
}

// Splits a wrongly grouped form, with the forms whose base chain runs through it, into its own word,
// and records the separation so grouping never joins it to the group's base again.
function separate(args, flags) {
  allowFlags(flags, []);
  if (args.length !== 1) throw new Error("separate takes one word form.");
  const form = normalizeTerm(args[0]);
  const db = openStore();
  return transaction(db, () => {
    const group = termByForm(db, form);
    if (!group) throw new Error(`"${args[0]}" is not a word form; separate splits a form out of a word group.`);
    if (form === group.key) throw new Error(`"${form}" is the base form of its group; separate the form that does not belong.`);
    prepare(db, "INSERT OR IGNORE INTO separations (form, base, at) VALUES (?, ?, ?)").run(form, group.key, new Date().toISOString());
    const baseOf = baseResolver(db);
    const groupForms = prepare(db, "SELECT form FROM word_forms WHERE term_id = ?").all(group.id).map((row) => row.form);
    const forms = groupForms.filter((name) => chainOf(name, baseOf).includes(form));
    const formList = JSON.stringify(forms);
    // The rows the moving forms brought in when their group merged describe them; their last position
    // is where the new word resumes.
    const last = prepare(db, `SELECT to_state, to_box, to_due FROM history WHERE term_id = ?
      AND merged_from IN (SELECT value FROM json_each(?)) ORDER BY id DESC LIMIT 1`).get(group.id, formList);
    const target = last ? { state: last.to_state, box: last.to_box, due: last.to_due } : { state: "new", box: 0, due: null };
    const termId = Number(prepare(db, `INSERT INTO terms (key, display, kind, state, box, due, rev, frozen_at)
      VALUES (?, ?, 'word', ?, ?, ?, ?, ?)`).run(form, form, target.state, target.box, target.due, nextRev(db),
      FROZEN.has(target.state) ? new Date().toISOString() : null).lastInsertRowid);
    prepare(db, "UPDATE word_forms SET term_id = ? WHERE form IN (SELECT value FROM json_each(?))").run(termId, formList);
    // The occurrences were hidden only by the wrong group, so a word in play shows them again.
    if (!FROZEN.has(target.state)) prepare(db, "UPDATE form_docs SET shown = 1 WHERE form IN (SELECT value FROM json_each(?))").run(formList);
    const moved = { history: 0, reviews: 0 };
    for (const table of ["history", "reviews"]) {
      moved[table] = Number(prepare(db, `UPDATE ${table} SET term_id = ?, merged_from = CASE WHEN merged_from = ? THEN NULL ELSE merged_from END
        WHERE term_id = ? AND merged_from IN (SELECT value FROM json_each(?))`).run(termId, form, group.id, formList).changes);
    }
    // An example moves when it uses only moving forms, and is copied when it uses both kinds.
    const remaining = groupForms.filter((name) => !forms.includes(name));
    for (const example of prepare(db, "SELECT * FROM examples WHERE term_id = ? ORDER BY id").all(group.id)) {
      const words = new Set(wordRuns(example.sentence).flatMap((run) => run.words));
      if (!forms.some((name) => words.has(name))) continue;
      if (remaining.some((name) => words.has(name))) {
        prepare(db, "INSERT INTO examples (term_id, sentence, source, doc_no) VALUES (?, ?, ?, ?)")
          .run(termId, example.sentence, example.source, example.doc_no);
      } else {
        prepare(db, "UPDATE examples SET term_id = ? WHERE id = ?").run(termId, example.id);
      }
    }
    prepare(db, "UPDATE terms SET rev = ? WHERE id = ?").run(nextRev(db), group.id);
    for (const id of [group.id, termId]) {
      recount(db, id);
      updateDisplay(db, id);
    }
    logHistory(db, group.id, `separate ${form}`, group, group);
    logHistory(db, termId, `separate from ${group.key}`, group, target);
    // The form may still have another base (stated -> state once kept from stat); it joins it as an
    // ingest would.
    climb(db, prepare(db, "SELECT * FROM terms WHERE id = ?").get(termId), baseOf);
    // Groups that an earlier separation left keyed by an inflection of a moved form rejoin it, as rebuild would.
    for (const name of forms) rekey(db, name, baseOf);
    const term = termByForm(db, form);
    const base = prepare(db, "SELECT * FROM terms WHERE id = ?").get(group.id);
    return {
      separated: forms,
      term: { term: term.display, ...position(term), rev: term.rev, doc_count: term.doc_count },
      from: { term: base.display, ...position(base), rev: base.rev, doc_count: base.doc_count },
      moved_history: moved.history,
      moved_reviews: moved.reviews,
    };
  });
}

function show(args, flags) {
  allowFlags(flags, []);
  if (args.length !== 1) throw new Error("show takes one term.");
  const db = openStore();
  const term = resolveTerm(db, args[0]);
  return {
    term: { ...term, mode: cardMode(term.state) },
    forms: prepare(db, "SELECT form, count FROM word_forms WHERE term_id = ? ORDER BY count DESC").all(term.id),
    examples: examplesOf(db, term.id, MAX_EXAMPLES),
    history: prepare(db, "SELECT * FROM history WHERE term_id = ? ORDER BY id").all(term.id),
    reviews: prepare(db, "SELECT * FROM reviews WHERE term_id = ? ORDER BY id").all(term.id),
  };
}

function top(args, flags) {
  allowFlags(flags, ["limit"]);
  noArgs(args, "top");
  const limit = flags.limit === undefined ? 50 : intFlag(flags.limit, "--limit", 1);
  const terms = prepare(openStore(), `SELECT display AS term, kind, state, doc_count, count FROM terms
    WHERE state NOT IN (${sqlList(HIDDEN)})
    ORDER BY ${RANK} LIMIT ?`).all(limit);
  return { terms };
}

function stats(args, flags) {
  allowFlags(flags, []);
  noArgs(args, "stats");
  const db = openStore();
  const day = today();
  const byState = {};
  for (const row of prepare(db, "SELECT kind, state, count(*) AS n FROM terms GROUP BY kind, state").all()) {
    (byState[row.kind] ??= {})[row.state] = row.n;
  }
  return {
    field,
    today: day,
    documents: metaNumber(db, "doc_seq"),
    tokens: metaNumber(db, "total_tokens"),
    terms: byState,
    pending_phrases: pendingPhrases(db).length,
    due_reviews: dueReviews(db, day).length,
    reviews_today: scalar(db, "SELECT count(*) FROM reviews WHERE day = ?", day),
    new_today: introducedOn(db, day),
  };
}

function query(args, flags) {
  allowFlags(flags, []);
  if (args.length !== 1) throw new Error("query takes one SQL statement.");
  if (!existsSync(dbPath)) throw new Error(`no database yet at ${dbPath}; ingest documents first.`);
  const db = new DatabaseSync(dbPath, { readOnly: true });
  db.exec("PRAGMA busy_timeout = 30000");
  checkVersion(db);
  return { rows: prepare(db, args[0]).all() };
}

function ladder(term, answer) {
  if (answer === "fail") return ["learning", 1];
  if (answer === "hold") return [term.state, term.box];
  const box = term.state === "new" ? 2 : Math.min(term.box + 1, BOXES.active[1]);
  const state = [...SCHEDULED].find((name) => box >= BOXES[name][0] && box <= BOXES[name][1]);
  return [state, box];
}

function cardMode(state) {
  if (state === "new" || state === "learning") return "recognize";
  if (state === "recognized" || state === "active") return "compose";
  return null;
}

function change(db, term, target, command) {
  const frozenAt = FROZEN.has(target.state) ? (term.frozen_at ?? new Date().toISOString()) : null;
  prepare(db, "UPDATE terms SET state = ?, box = ?, due = ?, frozen_at = ?, rev = ? WHERE id = ?")
    .run(target.state, target.box, target.due, frozenAt, nextRev(db), term.id);
  logHistory(db, term.id, command, term, target);
  return prepare(db, "SELECT * FROM terms WHERE id = ?").get(term.id);
}

// Revisions come from one store-wide counter, so a card read before a merge never matches the merged group.
function nextRev(db) {
  const rev = metaNumber(db, "rev_seq") + 1;
  setMeta(db, "rev_seq", rev);
  return rev;
}

function logHistory(db, termId, command, from, to) {
  prepare(db, `INSERT INTO history (term_id, at, command, from_state, from_box, from_due, to_state, to_box, to_due)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(termId, new Date().toISOString(), command, from.state, from.box, from.due, to.state, to.box, to.due);
}

function dueReviews(db, day) {
  return prepare(db, `SELECT * FROM terms WHERE state IN (${sqlList(SCHEDULED)}) AND due <= ?
    ORDER BY due, box, id`).all(day);
}

function introducedOn(db, day) {
  return scalar(db, "SELECT count(*) FROM reviews WHERE day = ? AND from_state = 'new'", day);
}

function position(term) {
  return { state: term.state, box: term.box, due: term.due };
}

function card(db, term) {
  return {
    term: term.display,
    kind: term.kind,
    state: term.state,
    box: term.box,
    mode: cardMode(term.state),
    rev: term.rev,
    due: term.due,
    doc_count: term.doc_count,
    examples: examplesOf(db, term.id, 3),
  };
}

function examplesOf(db, termId, limit) {
  return prepare(db, "SELECT sentence, source FROM examples WHERE term_id = ? ORDER BY doc_no DESC, id LIMIT ?").all(termId, limit);
}

function resolveTerm(db, name) {
  const key = normalizeTerm(name);
  const term = termByForm(db, key) ?? prepare(db, "SELECT * FROM terms WHERE key = ?").get(key);
  if (!term) throw new Error(`unknown term "${name}".`);
  return term;
}

function termByForm(db, form) {
  return prepare(db, "SELECT t.* FROM word_forms f JOIN terms t ON t.id = f.term_id WHERE f.form = ?").get(form);
}

function normalizeTerm(name) {
  return name.toLowerCase().replace(/[’]/g, "'").replace(/'s\b/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

// firstSighting(sentence) records the sentence and tells whether the corpus held it before.
function analyze(text, firstSighting) {
  const words = new Map();
  const phrases = new Map();
  let tokens = 0;
  const note = (map, key, sentence) => {
    let entry = map.get(key);
    if (entry) entry.count += 1;
    else map.set(key, entry = { count: 1, sentence: excerpt(sentence, key) });
    return entry;
  };
  for (const sentence of sentences(stripNoise(text))) {
    // A sentence repeated word for word (template boilerplate, a pasted notice) counts only once.
    if (!firstSighting(sentence)) continue;
    for (const { words: run, joined } of wordRuns(sentence)) {
      tokens += run.length;
      for (const word of run) note(words, word, sentence);
      const gram = (i, n) => {
        if (i < 0 || i + n > run.length) return null;
        // A phrase never cuts through a hyphenated compound (way door out of one-way door).
        if (joined[i - 1] || joined[i + n - 1]) return null;
        const slice = run.slice(i, i + n);
        return phraseShaped(slice, joined.slice(i, i + n - 1)) ? slice.join(" ") : null;
      };
      for (let i = 0; i < run.length; i += 1) {
        const trigram = gram(i, 3);
        if (trigram) note(phrases, trigram, sentence);
        const bigram = gram(i, 2);
        if (!bigram) continue;
        // Each bigram occurrence records the trigrams around it, so qualification can count only
        // the occurrences outside a qualified longer phrase.
        const entry = note(phrases, bigram, sentence);
        const left = gram(i - 1, 3);
        const signature = `${left}\u0000${trigram}`;
        entry.contexts ??= new Map();
        const context = entry.contexts.get(signature);
        if (context) context.count += 1;
        else entry.contexts.set(signature, { left, right: trigram, count: 1 });
      }
    }
  }
  return { words, phrases, tokens };
}

// The stored example: the whole sentence, or a window of it around the term's first occurrence.
function excerpt(sentence, key) {
  if (sentence.length <= MAX_EXAMPLE_CHARS) return sentence;
  const term = new RegExp(`(?<!\\p{L})${key.split(" ").join("[\\s-]+")}(?!\\p{L})`, "iu");
  const at = Math.max(0, sentence.search(term));
  const room = MAX_EXAMPLE_CHARS - 6;
  const start = Math.max(0, Math.min(at - Math.floor(room / 3), sentence.length - room));
  const end = start + room;
  return `${start > 0 ? "..." : ""}${sentence.slice(start, end)}${end < sentence.length ? "..." : ""}`;
}

function stripNoise(text) {
  const gap = " … ";
  return text.replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, gap)
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, gap)
    .replace(/\[((?:[^[\]\n]|\[[^[\]\n]*\])*)\]\(([^)\s]*)(?:\s+"[^"\n]*")?\)/g, (link, label, target) => (/^mailto:/i.test(target) ? gap : label))
    .replace(/\{#[^}\n]*\}/g, gap)
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1")
    .replace(/^([ \t]*)\*(?=[ \t])/gm, "$1-")
    .replace(/\*+/g, "")
    .replace(/^ {0,3}(`{3,}(?=[^`\n]*$)|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*$/gm, "\n\n")
    .replace(/^ {0,3}(`{3,}(?=[^`\n]*$)|~{3,})[\s\S]*$/m, "\n\n")
    .replace(/`[^`\n]+`/g, gap)
    .replace(/\b(?:https?|ftp|file):\/\/\S+|\bwww\.\S+/gi, gap)
    .replace(/<\/?[A-Za-z][\w:-]*\s*\/?>|<[A-Za-z][\w:-]*\s[^<>\n]*=[^<>\n]*>/g, gap)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, gap)
    .replace(/(?<![\w@])@[\w][\w.-]*/g, gap)
    .replace(/\b[A-Z][A-Z0-9]+-\d+\b/g, gap)
    .replace(/(?<![\w])#\d+\b/g, gap)
    .replace(/(?<![\w.~-])(?:~|\.{1,2})?\/[\w.-]+(?:\/[\w.-]*)*/g, gap)
    .replace(/[\w.-]+(?:\/[\w.-]+){2,}\/?|[\w.-]+\/[\w./-]*\.[a-z][a-z0-9]{0,4}\b/g, gap)
    .replace(/(?:[A-Za-z]:)?(?:[\w.-]*\\)+[\w.-]*/g, gap)
    .replace(/\b[\w-]+\.[a-z][a-z0-9]{0,4}\b/g, gap)
    .replace(/:[a-z0-9_+-]+:/g, gap);
}

// A sentence ends at final punctuation or a blank line; list, heading, quote, and table lines stand
// alone. A single newline inside a paragraph is a soft wrap.
function sentences(text) {
  return text.replace(/^[ \t]*(?:[-*+>|]|#{1,6}|\d+[.)])[ \t].*$/gm, "\n$&\n")
    .split(/\n[ \t]*\n|(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => /\p{L}/u.test(sentence));
}

// Runs of consecutive words that no punctuation, bare number, or stripped span separates. A word may
// mix letters and digits (k8s, s3, oauth2). The parts of a hyphenated compound (one-way) are separate
// words; joined[i] is true when word i is hyphenated to word i + 1.
function wordRuns(sentence) {
  const runs = [];
  const marked = sentence.replace(/(?<=\p{L})-(?=\p{L})/gu, HYPHEN);
  for (const segment of marked.split(/[^\p{L}\p{N}\s'’]+/u)) {
    let run = { words: [], joined: [] };
    for (const match of segment.matchAll(/[\p{L}\p{N}]+(?:['’]\p{L}+)*/gu)) {
      const token = match[0].toLowerCase().replace(/’/g, "'").replace(/'s$/, "");
      if (/\p{L}/u.test(token)) {
        run.words.push(token);
        run.joined.push(segment[match.index + match[0].length] === HYPHEN);
      } else {
        if (run.words.length) runs.push(run);
        run = { words: [], joined: [] };
      }
    }
    if (run.words.length) runs.push(run);
  }
  return runs;
}

// joined holds, for each pair of neighbors in gram, whether a hyphen joins them.
function phraseShaped(gram, joined) {
  // A one-letter word may sit inside a phrase (take a look) but not at its edge.
  if (gram[0].length < 2 || gram.at(-1).length < 2) return false;
  // A hyphenated compound is one unit, so a filler part (one-way, built-in) may stand at its edge.
  if (joined.every(Boolean)) return true;
  if (gram.every((word) => FILLER.has(word))) return false;
  const first = gram[0];
  const last = gram[gram.length - 1];
  const startOk = !FILLER.has(first) || joined[0] || (gram.length === 2 && START_PREPOSITIONS.has(first));
  const endOk = !FILLER.has(last) || joined.at(-1) || PARTICLES.has(last);
  return startOk && endOk;
}

// The base a form groups under: the most frequent candidate the corpus already holds (the first in
// rule order on a tie), skipping any whose own chain reaches a base the form was separated from.
function baseResolver(db) {
  const corpusCount = prepare(db, "SELECT count FROM corpus_words WHERE word = ?");
  const apart = new Map();
  for (const { form, base } of prepare(db, "SELECT form, base FROM separations").all()) {
    if (!apart.has(form)) apart.set(form, new Set());
    apart.get(form).add(base);
  }
  const baseOf = (form) => {
    let best;
    let bestCount = 0;
    for (const candidate of baseCandidates(form)) {
      const count = corpusCount.get(candidate)?.count ?? 0;
      if (count <= bestCount) continue;
      if (apart.has(form) && chainOf(candidate, baseOf).some((base) => apart.get(form).has(base))) continue;
      best = candidate;
      bestCount = count;
    }
    return best;
  };
  return baseOf;
}

// The form and its bases in order (findings -> finding -> find).
function chainOf(form, baseOf) {
  const chain = [];
  for (let base = form; base !== undefined; base = baseOf(base)) chain.push(base);
  return chain;
}

// Base-form candidates in rule order; a candidate counts only when the corpus already holds it.
function baseCandidates(form) {
  if (FILLER.has(form)) return [];
  const out = [];
  if (form.endsWith("s") && !form.endsWith("ss")) out.push(form.slice(0, -1));
  if (form.endsWith("ies")) out.push(`${form.slice(0, -3)}y`);
  if (form.endsWith("es")) out.push(form.slice(0, -2));
  for (const suffix of ["ed", "ing"]) {
    if (!form.endsWith(suffix)) continue;
    const stem = form.slice(0, -suffix.length);
    out.push(stem);
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
    if (suffix === "ed" && stem.endsWith("i")) out.push(`${stem.slice(0, -1)}y`);
    // A short stem already ending in -e (seed, feed, need) is a word of its own, not see + -ed.
    if (!(stem.endsWith("e") && stem.length <= 2)) out.push(`${stem}e`);
  }
  return out.filter((base) => base.length >= 3 && !FILLER.has(base));
}

function inflections(base) {
  const out = [`${base}s`, `${base}es`, `${base}ed`, `${base}ing`];
  if (/[b-df-hj-np-tv-z]$/.test(base)) out.push(`${base}${base.at(-1)}ed`, `${base}${base.at(-1)}ing`);
  if (base.endsWith("e")) out.push(`${base.slice(0, -1)}ed`, `${base.slice(0, -1)}ing`);
  if (base.endsWith("y")) out.push(`${base.slice(0, -1)}ies`, `${base.slice(0, -1)}ied`);
  return out;
}

function ingestDocument(db, analysis, source, docNo, candidateExamples) {
  const corpusCount = prepare(db, "SELECT count FROM corpus_words WHERE word = ?");
  const firstSeen = [];
  const bumpWord = prepare(db, `INSERT INTO corpus_words (word, count) VALUES (?, ?)
    ON CONFLICT(word) DO UPDATE SET count = count + excluded.count`);
  for (const [word, { count }] of analysis.words) {
    if (!corpusCount.get(word)) firstSeen.push(word);
    bumpWord.run(word, count);
  }
  setMeta(db, "total_tokens", metaNumber(db, "total_tokens") + analysis.tokens);
  const baseOf = baseResolver(db);

  for (const base of firstSeen) rekey(db, base, baseOf);

  const termByKey = prepare(db, "SELECT id FROM terms WHERE key = ?");
  const createTerm = prepare(db, `INSERT INTO terms (key, display, kind, state, box, last_doc)
    VALUES (?, ?, ?, ?, 0, ?)`);
  const addForm = prepare(db, `INSERT INTO word_forms (form, term_id, count) VALUES (?, ?, ?)
    ON CONFLICT(form) DO UPDATE SET count = count + excluded.count`);
  const perTerm = new Map();
  let created = 0;
  // A form joins the group of the first form on its base chain (findings -> finding -> find) that has
  // one; a new group is keyed by, and owns, the chain's root, so every key is also one of its forms.
  const groupOf = (form) => {
    const { owner, root } = chainOwner(db, form, form, baseOf);
    if (owner) return owner.id;
    const keyed = termByKey.get(root)?.id;
    if (keyed !== undefined) return keyed;
    const termId = Number(createTerm.run(root, form, "word", "new", docNo).lastInsertRowid);
    addForm.run(root, termId, 0);
    created += 1;
    return termId;
  };
  const groups = new Map();
  for (const [form, entry] of analysis.words) {
    if (form.length < 2) continue;
    const termId = groupOf(form);
    addForm.run(form, termId, entry.count);
    groups.set(form, termId);
    const total = perTerm.get(termId);
    if (total) total.count += entry.count;
    else perTerm.set(termId, { ...entry });
  }
  for (const [termId, entry] of perTerm) {
    countOccurrence(db, termId, entry, source, docNo, candidateExamples);
    updateDisplay(db, termId);
  }
  const stateOf = prepare(db, "SELECT state FROM terms WHERE id = ?");
  const addFormDoc = prepare(db, "INSERT INTO form_docs (form, doc_no, count, shown) VALUES (?, ?, ?, ?)");
  for (const [form, termId] of groups) {
    addFormDoc.run(form, docNo, analysis.words.get(form).count, FROZEN.has(stateOf.get(termId).state) ? 0 : 1);
  }

  const addContext = prepare(db, `INSERT INTO phrase_contexts (term_id, doc_no, left_key, right_key, count)
    VALUES (?, ?, ?, ?, ?)`);
  for (const [key, entry] of analysis.phrases) {
    let termId = termByKey.get(key)?.id;
    if (termId === undefined) termId = Number(createTerm.run(key, key, "phrase", "candidate", docNo).lastInsertRowid);
    countOccurrence(db, termId, entry, source, docNo, candidateExamples);
    for (const { left, right, count } of entry.contexts?.values() ?? []) addContext.run(termId, docNo, left, right, count);
  }
  return created;
}

function countOccurrence(db, termId, entry, source, docNo, candidateExamples) {
  prepare(db, `UPDATE terms SET raw_count = raw_count + ?, raw_doc_count = raw_doc_count + 1, last_doc = ?,
    count = count + CASE WHEN state IN (${sqlList(FROZEN)}) THEN 0 ELSE ? END,
    doc_count = doc_count + CASE WHEN state IN (${sqlList(FROZEN)}) THEN 0 ELSE 1 END
    WHERE id = ?`).run(entry.count, docNo, entry.count, termId);
  const { state } = prepare(db, "SELECT state FROM terms WHERE id = ?").get(termId);
  if (FROZEN.has(state)) return;
  const limit = state === "candidate" ? candidateExamples : MAX_EXAMPLES;
  const have = scalar(db, "SELECT count(*) FROM examples WHERE term_id = ?", termId);
  if (have < limit) {
    prepare(db, "INSERT INTO examples (term_id, sentence, source, doc_no) VALUES (?, ?, ?, ?)")
      .run(termId, entry.sentence, source, docNo);
  }
}

// A base form seen for the first time puts the word groups keyed by its inflections back on their
// base chain.
function rekey(db, base, baseOf) {
  if (base.length < 3 || FILLER.has(base)) return;
  for (const form of inflections(base)) {
    if (baseOf(form) !== base) continue;
    const group = prepare(db, "SELECT * FROM terms WHERE key = ? AND kind = 'word'").get(form);
    if (group) climb(db, group, baseOf);
  }
}

// A group joins the first group up its base chain (findings -> finding -> find), or else takes the
// chain's root as its key and form.
function climb(db, group, baseOf) {
  const { owner, root } = chainOwner(db, baseOf(group.key), group.key, baseOf);
  if (owner) {
    if (owner.id !== group.id) merge(db, owner, group);
    return;
  }
  if (root === group.key) return;
  tagRows(db, group.id, group.key);
  prepare(db, "UPDATE terms SET key = ? WHERE id = ?").run(root, group.id);
  prepare(db, "INSERT INTO word_forms (form, term_id, count) VALUES (?, ?, 0)").run(root, group.id);
}

// Walks the base chain from start (findings -> finding -> find) to the first group that owns one of
// its forms; root is the chain's last form, or fallback when the chain is empty.
function chainOwner(db, start, fallback, baseOf) {
  let root = fallback;
  for (let base = start; base !== undefined; base = baseOf(base)) {
    const owner = termByForm(db, base);
    if (owner) return { owner, root };
    root = base;
  }
  return { owner: undefined, root };
}

// The merged group takes keep's key and the learning state of whichever group outranks the other.
// Groups that a separation keeps apart stay apart; returns whether they merged.
function merge(db, keep, drop) {
  const apart = prepare(db, `SELECT 1 FROM separations s JOIN word_forms f ON f.form = s.form JOIN word_forms b ON b.form = s.base
    WHERE (f.term_id = ?1 AND b.term_id = ?2) OR (f.term_id = ?2 AND b.term_id = ?1) LIMIT 1`).get(keep.id, drop.id);
  if (apart) return false;
  const [survivor, absorbed] = outranks(drop, keep) > 0 ? [drop, keep] : [keep, drop];
  if (survivor.id !== keep.id) tagRows(db, survivor.id, survivor.key);
  absorb(db, survivor, absorbed);
  if (survivor.id !== keep.id) prepare(db, "UPDATE terms SET key = ? WHERE id = ?").run(keep.key, survivor.id);
  return true;
}

// History and review rows written before a group took another base form keep its earlier base form, so
// a separation can tell which rows describe the forms it splits out.
function tagRows(db, termId, name) {
  for (const table of ["history", "reviews"]) {
    prepare(db, `UPDATE ${table} SET merged_from = coalesce(merged_from, ?) WHERE term_id = ?`).run(name, termId);
  }
}

// Positive when a's learning state should survive a merge with b. Archiving or ignoring a word covers
// all its forms, so archived outranks ignored and both outrank a group in play; then the higher box,
// the state further along the path, and the older group win. The order of the arguments never
// changes the outcome.
function outranks(a, b) {
  const side = (term) => ({ archived: 2, ignored: 1 })[term.state] ?? 0;
  return side(a) - side(b) || a.box - b.box || STATES.indexOf(a.state) - STATES.indexOf(b.state) || b.id - a.id;
}

// Moves absorbed's forms, examples, history, and reviews to survivor and recounts it; survivor's
// history notes the absorbed group's position.
function absorb(db, survivor, absorbed) {
  // A frozen group's user-facing counts stay as they were, so the occurrences it takes in stay hidden.
  if (FROZEN.has(survivor.state)) {
    prepare(db, "UPDATE form_docs SET shown = 0 WHERE form IN (SELECT form FROM word_forms WHERE term_id = ?)").run(absorbed.id);
  }
  for (const table of ["word_forms", "examples"]) {
    prepare(db, `UPDATE ${table} SET term_id = ? WHERE term_id = ?`).run(survivor.id, absorbed.id);
  }
  for (const table of ["history", "reviews"]) {
    prepare(db, `UPDATE ${table} SET term_id = ?, merged_from = coalesce(merged_from, ?) WHERE term_id = ?`)
      .run(survivor.id, absorbed.key, absorbed.id);
  }
  prepare(db, "UPDATE terms SET rev = ? WHERE id = ?").run(nextRev(db), survivor.id);
  recount(db, survivor.id);
  updateDisplay(db, survivor.id);
  logHistory(db, survivor.id, `merge ${absorbed.display} (was ${absorbed.state}, box ${absorbed.box}, due ${absorbed.due})`, survivor, survivor);
  prepare(db, "DELETE FROM terms WHERE id = ?").run(absorbed.id);
}

// A word group's counts from its forms' documents: a document that uses several forms counts once.
function recount(db, termId) {
  prepare(db, `UPDATE terms SET (raw_count, raw_doc_count, count, doc_count, last_doc) = (
    SELECT coalesce(sum(d.count), 0), count(DISTINCT d.doc_no), coalesce(sum(d.count * d.shown), 0),
      count(DISTINCT CASE WHEN d.shown = 1 THEN d.doc_no END), coalesce(max(d.doc_no), terms.last_doc)
    FROM word_forms f JOIN form_docs d ON d.form = f.form WHERE f.term_id = terms.id) WHERE id = ?`).run(termId);
}

function updateDisplay(db, termId) {
  prepare(db, `UPDATE terms SET display = coalesce((SELECT form FROM word_forms WHERE term_id = terms.id
    ORDER BY count DESC, form LIMIT 1), display) WHERE id = ?`).run(termId);
}

function pendingPhrases(db) {
  const total = metaNumber(db, "total_tokens");
  const wordCount = prepare(db, "SELECT count FROM corpus_words WHERE word = ?");
  const cache = new Map();
  const unigram = (word) => {
    if (!cache.has(word)) cache.set(word, wordCount.get(word)?.count ?? 0);
    return cache.get(word);
  };
  const rows = prepare(db, `SELECT * FROM terms WHERE kind = 'phrase'
    AND (raw_doc_count >= ? OR state NOT IN ('candidate', 'ignored'))`).all(MIN_DOCS);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  // A trigram split's two-word marginal: the stored count, or the count expected by chance.
  const pairCount = (words) => {
    const stored = byKey.get(words.join(" "));
    if (stored) return stored.raw_count;
    return (unigram(words[0]) * unigram(words[1])) / Math.max(total, 1);
  };
  const qualifies = (docs, score) => docs >= MIN_DOCS && score >= SCORE_CUTOFF;
  const suppressing = [];
  const results = [];
  for (const row of rows) {
    const words = row.key.split(" ");
    if (words.length !== 3) continue;
    const [a, b, c] = words;
    const score = Math.min(
      g2(row.raw_count, pairCount([a, b]), unigram(c), total),
      g2(row.raw_count, unigram(a), pairCount([b, c]), total),
    );
    const qualified = qualifies(row.raw_doc_count, score);
    results.push({ row, score, docs: row.raw_doc_count, qualified });
    if (row.state !== "ignored" && (row.state !== "candidate" || qualified)) suppressing.push(row.key);
  }
  const bigrams = rows.filter((row) => row.key.split(" ").length === 2);
  const standalone = new Map(prepare(db, `WITH outer_phrases (key) AS (SELECT value FROM json_each(?))
    SELECT term_id, count(DISTINCT doc_no) AS docs, sum(count) AS count FROM phrase_contexts
    WHERE term_id IN (SELECT value FROM json_each(?))
      AND (left_key IS NULL OR left_key NOT IN outer_phrases)
      AND (right_key IS NULL OR right_key NOT IN outer_phrases)
    GROUP BY term_id`).all(JSON.stringify(suppressing), JSON.stringify(bigrams.map((row) => row.id)))
    .map((row) => [row.term_id, row]));
  for (const row of bigrams) {
    const words = row.key.split(" ");
    const { count = 0, docs = 0 } = standalone.get(row.id) ?? {};
    const score = g2(count, unigram(words[0]), unigram(words[1]), total);
    results.push({ row, score, docs, qualified: qualifies(docs, score) });
  }
  return results
    .filter((result) => result.qualified && result.row.state === "candidate")
    .sort((x, y) => y.docs - x.docs || y.score - x.score || x.row.key.localeCompare(y.row.key))
    .map(({ row, score, docs }) => ({
      term: row.key,
      docs,
      count: row.raw_count,
      score: Math.round(score * 100) / 100,
      example: examplesOf(db, row.id, 1)[0] ?? null,
    }));
}

// The names only; `pending` shows each phrase with its evidence and an example.
function newlyQualified(before, after) {
  return after.filter((phrase) => !before.has(phrase.term)).map((phrase) => phrase.term);
}

function pendingKeys(db) {
  return new Set(pendingPhrases(db).map((phrase) => phrase.term));
}

// Dunning log-likelihood G² for a 2x2 contingency table; 0 unless the pair co-occurs more than chance.
function g2(joint, left, right, total) {
  if (joint <= 0 || total <= 0) return 0;
  const a = Math.max(left, joint);
  const b = Math.max(right, joint);
  if (joint * total <= a * b) return 0;
  const cells = [
    [joint, a, b],
    [a - joint, a, total - b],
    [b - joint, total - a, b],
    [total - a - b + joint, total - a, total - b],
  ];
  let sum = 0;
  for (const [observed, row, column] of cells) {
    if (observed > 0 && row > 0 && column > 0) sum += observed * Math.log((observed * total) / (row * column));
  }
  return Math.max(0, 2 * sum);
}

function openStore() {
  mkdirSync(STORE, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 30000");
  // The journal-mode switch skips the busy handler while another session creates the file.
  for (let attempt = 1; ; attempt += 1) {
    try {
      db.exec("PRAGMA journal_mode = WAL");
      break;
    } catch (error) {
      if (!/locked|busy/i.test(error.message) || attempt === 600) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  db.exec("PRAGMA foreign_keys = ON");
  const version = prepare(db, "PRAGMA user_version").get().user_version;
  if (version === 0) {
    transaction(db, () => {
      if (prepare(db, "PRAGMA user_version").get().user_version === 0) createSchema(db);
    });
  }
  if (version === 1) {
    transaction(db, () => {
      if (prepare(db, "PRAGMA user_version").get().user_version === 1) addSentences(db);
    });
  }
  checkVersion(db);
  return db;
}

function checkVersion(db) {
  const version = prepare(db, "PRAGMA user_version").get().user_version;
  if (version !== SCHEMA_VERSION) {
    throw new Error(`${dbPath} has schema version ${version}; this script reads version ${SCHEMA_VERSION}.`);
  }
}

// Version 2 counts a repeated sentence once. The saved documents fill the sentence log, so new documents
// skip their sentences; `rebuild` recounts the old documents.
function addSentences(db) {
  db.exec(`CREATE TABLE sentences (hash INTEGER PRIMARY KEY); PRAGMA user_version = 2;`);
  const firstSighting = sentenceLog(db);
  for (const { hash } of prepare(db, "SELECT hash FROM docs ORDER BY doc_no").all()) {
    const text = savedText(hash);
    if (text !== null) for (const sentence of sentences(stripNoise(text))) firstSighting(sentence);
  }
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE terms (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      display TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('word', 'phrase')),
      state TEXT NOT NULL,
      box INTEGER NOT NULL DEFAULT 0,
      due TEXT,
      rev INTEGER NOT NULL DEFAULT 0,
      doc_count INTEGER NOT NULL DEFAULT 0,
      count INTEGER NOT NULL DEFAULT 0,
      raw_doc_count INTEGER NOT NULL DEFAULT 0,
      raw_count INTEGER NOT NULL DEFAULT 0,
      last_doc INTEGER,
      frozen_at TEXT
    );
    CREATE INDEX terms_state_doc_count ON terms (state, doc_count);
    CREATE INDEX terms_kind_raw_doc_count ON terms (kind, raw_doc_count);
    CREATE TABLE word_forms (
      form TEXT PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
      count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX word_forms_term ON word_forms (term_id);
    CREATE TABLE examples (
      id INTEGER PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
      sentence TEXT NOT NULL,
      source TEXT NOT NULL,
      doc_no INTEGER NOT NULL
    );
    CREATE INDEX examples_term ON examples (term_id, doc_no);
    -- One row per two-word phrase, document, and pair of enclosing three-word phrases (NULL when absent).
    CREATE TABLE phrase_contexts (
      term_id INTEGER NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
      doc_no INTEGER NOT NULL,
      left_key TEXT,
      right_key TEXT,
      count INTEGER NOT NULL
    );
    CREATE INDEX phrase_contexts_term ON phrase_contexts (term_id);
    CREATE TABLE docs (
      hash TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      doc_no INTEGER NOT NULL UNIQUE,
      ingested_at TEXT NOT NULL
    );
    CREATE TABLE history (
      id INTEGER PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
      at TEXT NOT NULL,
      command TEXT NOT NULL,
      from_state TEXT, from_box INTEGER, from_due TEXT,
      to_state TEXT, to_box INTEGER, to_due TEXT,
      merged_from TEXT
    );
    CREATE INDEX history_term ON history (term_id);
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY,
      term_id INTEGER NOT NULL REFERENCES terms (id) ON DELETE CASCADE,
      at TEXT NOT NULL,
      day TEXT NOT NULL,
      answer TEXT NOT NULL,
      mode TEXT NOT NULL,
      from_state TEXT NOT NULL, from_box INTEGER NOT NULL,
      to_state TEXT NOT NULL, to_box INTEGER NOT NULL,
      due TEXT NOT NULL,
      merged_from TEXT
    );
    CREATE INDEX reviews_day ON reviews (day, from_state);
    CREATE INDEX reviews_term ON reviews (term_id);
    -- One row per word form and document that uses it; shown is 0 when those occurrences stayed out of
    -- the user-facing counts. A word group's counts are the union over its forms.
    CREATE TABLE form_docs (
      form TEXT NOT NULL,
      doc_no INTEGER NOT NULL,
      count INTEGER NOT NULL,
      shown INTEGER NOT NULL CHECK (shown IN (0, 1)),
      PRIMARY KEY (form, doc_no)
    ) WITHOUT ROWID;
    -- A form the user split out of the group keyed by base; grouping never joins the two again.
    CREATE TABLE separations (form TEXT NOT NULL, base TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (form, base));
    CREATE TABLE corpus_words (word TEXT PRIMARY KEY, count INTEGER NOT NULL);
    -- Every sentence the corpus has counted, by sentenceHash.
    CREATE TABLE sentences (hash INTEGER PRIMARY KEY);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    INSERT INTO meta (key, value) VALUES ('doc_seq', 0), ('total_tokens', 0), ('rev_seq', 0);
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

function transaction(db, body) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = body();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function prepare(db, sql) {
  if (!statements.has(db)) statements.set(db, new Map());
  const cache = statements.get(db);
  if (!cache.has(sql)) cache.set(sql, db.prepare(sql));
  return cache.get(sql);
}

function sqlList(states) {
  return [...states].map((state) => `'${state}'`).join(", ");
}

function scalar(db, sql, ...params) {
  return Object.values(prepare(db, sql).get(...params))[0];
}

function metaNumber(db, key) {
  return prepare(db, "SELECT value FROM meta WHERE key = ?").get(key).value;
}

function setMeta(db, key, value) {
  prepare(db, "UPDATE meta SET value = ? WHERE key = ?").run(value, key);
}

function today() {
  return localDay(new Date());
}

function localDay(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(day, days) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + days));
}

function dayFlag(value) {
  if (value === "today") return today();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || addDays(value, 0) !== value) throw new Error(`--due must be YYYY-MM-DD or today (got "${value}").`);
  return value;
}

function intFlag(value, name, min) {
  if (!/^\d+$/.test(value) || Number(value) < min) throw new Error(`${name} must be an integer >= ${min} (got "${value}").`);
  return Number(value);
}

function parseArgs(list) {
  const [command, ...rest] = list;
  const args = [];
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (item.startsWith("--")) {
      const [name, inline] = item.slice(2).split(/=(.*)/s);
      const value = inline ?? rest[i + 1];
      if (value === undefined) fail(`--${name} needs a value.`);
      if (inline === undefined) i += 1;
      flags[name] = value;
    } else {
      args.push(item);
    }
  }
  return { command, args, flags };
}

function allowFlags(flags, names) {
  for (const name of Object.keys(flags)) {
    if (name !== "field" && !names.includes(name)) throw new Error(`unknown option --${name}.`);
  }
}

function noArgs(args, command) {
  if (args.length) throw new Error(`${command} takes no arguments.`);
}

function fail(message) {
  process.stderr.write(`my-domain-vocab: ${message}\n`);
  process.exit(1);
}
