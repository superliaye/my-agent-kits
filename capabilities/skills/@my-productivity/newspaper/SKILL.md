---
name: newspaper
description: Maintain a live, editable newspaper-style canvas for meaningful progress, decisions, risks, findings, code, tables, metrics, and local media during a long-running task.
added_in: 0.48.0
---

# newspaper

Use the bundled launcher to create a run:

```sh
node "<skill-directory>/scripts/newspaper.mjs" start
```

Keep both values it prints: the exact `canvas.json` path and the live URL. Share the URL with the
user immediately. Each run is isolated, so use that exact path for every later update.

Hydrate the canvas only at meaningful checkpoints: phase transitions, noticeable progress,
decisions, risks, or material findings. Patch stable keyed entries in `canvas.json`; leave its
`revision` unchanged because the service advances accepted revisions. Run `validate --run
<run-key>` after an uncertain edit and repair any error reported in the adjacent `validation.json`.
Keep the canvas useful as current state rather than an event transcript.

The default document demonstrates the common fields. Read `references/canvas-schema.md` when you
need code, table, metric, callout, media, edges, explicit placement, or another region.

When the user asks what they changed, read the exact `canvas.json`, including node content,
`focus`, and explicit `frame` geography. Browser edits persist there.

Use `status --run <run-key>` to recover paths and the URL. Use `close --run <run-key>` only when the
user no longer needs the live surface; closing removes that run instead of creating a final edition.
