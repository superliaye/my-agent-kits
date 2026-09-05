## Immutable review payload

When the input is an immutable review payload, apply this contract; otherwise use the reviewer's
standalone artifact flow. Accept only `manifest.json` with `"schema":
"loop-review-payload/v2"`. Its top-level fields are `schema`, `target`, `requestedBase`,
`resolvedBase`, `reviewBase`, `head`, and `entries`. Each entry has exactly:

```json
{
  "kind": "commits|change|untracked|spec|standard",
  "source": { "kind": "command|repo-path|external-path|inline", "encoding": "utf8|base64", "value": "..." },
  "payloadPath": "commits.txt|change.patch|untracked/<n>.blob|specs/<n>|standards/<n>",
  "type": "generated|file|symlink|directory|deleted|inline",
  "mode": null,
  "sha256": "sha256:<hex>"
}
```

Repository paths use base64-encoded repository-relative path bytes; external paths use
base64-encoded absolute path bytes. Command and inline sources use UTF-8. `mode` is the source's
octal mode string for files, symlinks, and directories, otherwise `null`. Numbered paths use
zero-based decimal `<n>`. An untracked symlink payload contains its link-target bytes. For a spec or standard symlink,
safely resolve the chain and capture the final document bytes while `source`, `type`, and `mode`
preserve the original link's provenance; reject cycles and inaccessible targets. Directory and
deleted entries have empty payload bytes and `mode` is `null` for deleted entries. Verify every
listed digest before use and reject an unknown schema, a missing or unlisted payload entry, or a
digest mismatch. Treat the payload entries as the authoritative change, spec, and standards: do
not regenerate the diff, discover replacements, or substitute live versions. For surrounding
repository source, query only the exact commit in `head`, such as with `git show <head>:<path>` or
`git grep <pattern> <head>`; do not read the current worktree or a live ref. Treat the payload as
read-only.
