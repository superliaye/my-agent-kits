---
name: my-domain-vocab
description: Vocabulary trainer that builds a non-native English speaker's working vocabulary of their field from documents they read. Use when the user feeds documents (design docs, Slack, PR comments, transcripts) to learn their terms, wants a vocabulary review session, or asks to inspect, fix, or undo their vocabulary state.
added_in: 0.51.0
---

# my-domain-vocab

The user is a non-native English speaker who reads their field's writing. The goal is recognition
first, then use, and above all no forgetting of a term they once looked up. Terms come only from
documents the user feeds in.

## The script

All state lives in one SQLite file per field at `~/.my-domain-vocab/<field>.db`. The text of each
ingested document stays next to it in `~/.my-domain-vocab/<field>/docs/`, named by content hash, so
the counts can be rebuilt; both stay on this machine, and only the `--llm` command of `serve` sees a
term's example sentences. Run every command as:

```sh
node "<skill-directory>/scripts/vocab.mjs" <command> [--field <name>]
```

`--field` defaults to `default`; use a separate field (`^[a-z0-9-]+$`) when the user studies another
domain. Each command prints JSON that includes the exact `db` and `docs_dir` paths; errors go to
stderr with a non-zero exit. When the script reports that `node:sqlite` is unavailable, tell the
user which Node version it names and stop.

| Command | Does |
|---|---|
| `ingest <dir>` | Each file is one document; its filename is the source label. Plain text and Markdown exports both work: the script drops code, URLs, paths, emails, images, mailto names, and markup, and keeps link labels. Prints the count of new words and the names of the newly qualified phrases. A document already ingested (same content) is skipped. |
| `rebuild` | Recounts every saved document with the current rules: corpus counts, candidates, term counts, examples, and phrase evidence. Every term keeps its state, box, due date, `rev`, history, and reviews, and every separation holds. A term whose words no longer occur keeps its learning state with zero counts, unless it is an untouched candidate or `new` term, which is dropped. Run it after a kit update changes the script, or when the user asks for a recount. |
| `pending` | Phrases that qualified and are still candidates. |
| `next [--new N]` | Today's cards: due reviews first, then the top new terms up to the daily new cap (default 10; `--new` sets it). |
| `review <term> pass\|fail\|hold --rev <rev>` | Records an answer. `rev` comes from the card; a stale `rev` means another session changed the term, so re-read it with `show`. |
| `set <state> <term>... [--box N] [--due YYYY-MM-DD\|today]` | Moves one or many terms to a state. Without `--box` the term keeps its box when the state allows it, otherwise it takes the lowest allowed box, due today. Archived and ignored keep their box, and their due date unless `--due` is given. |
| `separate <form>` | Splits a wrongly grouped form out of its word group (see the model). |
| `show <term>` | The term with its forms, examples, full history, and reviews. |
| `top [--limit N]` | Visible terms ranked by how many documents use them. |
| `stats` | Counts by kind and state, documents, and today's reviews. |
| `query "<sql>"` | Read-only SQL against the DB, returned as JSON rows. Read the schema with `SELECT sql FROM sqlite_master`. |
| `serve [--port N] [--batch N] [--new N] [--llm <command>]` | Serves the flash-card page on `127.0.0.1` (port 4870 by default) and prints its `url` with a one-time token and the `queue` path, then runs until stopped. `--batch` is the cards per batch (default 20); `--new` is the daily new cap it starts from. It needs the `ws` package; when it is missing, the error names the one-time install command. |

Every write goes through `ingest`, `rebuild`, `set`, `separate`, `review`, or the `serve` page, so the history stays complete. Use `query`
and `show` freely to answer questions.

## The model

**Terms.** A term is a word or a phrase. Word forms group under one base form (*cases* under
*case*, *used* under *use*), the more frequent base when the corpus holds several. The card shows the
most frequent form, commands accept any form, and a document that uses several forms counts once.
When a base form first appears, the groups of its inflections merge into it. Archiving or ignoring a
word covers all its forms: an archived group survives a merge, then an ignored one, then the group
in the higher box, and a `merge` history row notes the absorbed group's old position. History and
review rows written before a group merged or took another base form carry its earlier base form in
`merged_from`; they describe that group. A merge is permanent until a separation: `separate` moves a wrongly grouped
form (*news* under *new*), with the forms built on it, into its own word, and grouping never joins
it to that base again. The new word takes back the rows whose `merged_from` names it and resumes
their last position, or starts as `new`.
A phrase is a 2–3 word sequence from one sentence. A hyphenated compound (*one-way*) is one unit: a
phrase may start or end with it (*one-way door*) but never cuts through it. A sentence the corpus
already holds word for word, such as template boilerplate, counts only the first time.

**States and boxes.** The learning path is `new → learning → recognized → active`. Two side states,
`archived` (the user knows it for life) and `ignored` (not a real term), take a term out of every
queue and freeze its user-facing counts; raw statistics keep counting so phrase scoring stays
right. Phrases start as hidden `candidate`s; words start as `new`.

| State | Boxes | Card |
|---|---|---|
| candidate | 0 | none (hidden) |
| new | 0 | recognize: does the user know what it means? |
| learning | 1–3 | recognize |
| recognized | 4–5 | compose: can the user use it? |
| active | 6 | compose, on 60-day reviews |
| archived, ignored | the box they had | none |

**Schedule.** A pass moves a term up one box; `new` jumps to box 2. A fail sends any term to box 1.
A hold keeps the box. The due date is the box's interval from the start of the user's local day:
box 1 → 1 day, 2 → 3, 3 → 7, 4 → 21, 5 and 6 → 60. `set` and `review` reject a state and box pair
outside the table.

**Phrase lifecycle.** Every candidate collects counts silently. A phrase qualifies once it appears
in at least 3 distinct documents and its words stick together far more often than chance; a phrase
nested inside a qualified longer one counts only its free occurrences. A qualified candidate waits
in `pending` until you mark it `new` or `ignored`. Candidates seen in a single document disappear
after 200 more documents arrive, unless they have history or reviews.

## Modes

### Ingest

Save each source as one file in a fresh `mktemp -d` directory, named by a short source label. Have
the fetch tool write the export straight to that file, so the document text stays out of your
context; the script does the cleanup. When you assemble a file yourself, such as a chat thread, put
a blank line between messages: a blank line ends a sentence, and a single newline is a soft wrap.
Run `ingest` on the directory, then delete it.

Then go through `pending` until it is empty, one round at a time: one `set new` call for the real
terms of the field and one `set ignored` call for the fragments. Ignoring a longer phrase can let
the shorter phrases inside it qualify, so read `pending` again after each round.

### Learn

On the first session, propose batches of words from `top` that a five-year-old can use, and
archive each approved batch with one `set archived` call.

Then run `serve` in the background and give the user its `url`. The page shows one card at a time
with its example sentences and sources, and records each reply itself, with no agent turn per card.
A recognize card asks what the term means; a compose card asks the user to use it in a sentence of
their own. Every card offers four replies:

- **Archive** ("I know this for life"): `set archived`.
- **I recognize it**: `pass` on a recognize card, `hold` on a compose card.
- **Don't know**: `fail`, then more example sentences from the corpus.
- **Free text**: the user's own understanding or sentence, judged by the `--llm` command, which
  records `pass` or `fail`.

Each judged answer, and the page's **Explain** button, sharpen the user's understanding: the plain
meaning, its connotation, the root or origin, a memory hook, and one more example. When a batch
ends, the page loads the next one; at the daily new cap it offers more new words.

`--llm` is a shell command that reads a prompt on stdin and prints one JSON object. Give it a
headless call to the cheapest model tier that can follow a JSON format, and try it once on a short
prompt before you launch. Without `--llm`, or when the command fails or prints no valid JSON, the
request waits in the `queue` file. When the user comes back, work through that file: judge each
`judge` entry against the term's examples and record it with `review` and the entry's `rev`;
sharpen each `explain` entry in chat; then delete the file.

The server listens on `127.0.0.1` only. When the user's browser runs on another machine, have them
open the forwarded port.

### Hygiene

The user may ask to promote, undo, fix, or explain anything. Read the current state with `show` or
`query`, decide the target state, box, and due date from the model above, and write it with `set` or `separate`.
`show` history holds every previous state, box, and due date, so `set` can reverse any `set` or
`review`.
