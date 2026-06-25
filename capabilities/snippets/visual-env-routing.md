| env | skill | when |
|---|---|---|
| `web` | `web-visual-loop` | a browser-rendered web UI / dev server |
| `electron` | `electron-visual-loop` | an Electron renderer you can launch with CDP |
| `desktop` | `desktop-app-loop` | a packaged/foreign native app with no debug port |

If a criterion omits `env`, infer it from the repo (web framework + dev server →
`web`; an `electron` dependency / main process → `electron`; a packaged native app
→ `desktop`) and state the inference in your evidence.

When your loop drives `agent-browser`, connect under a **unique per-run `--session
<name>`** (e.g. this run's slug) rather than the unnamed default — a parallel critic
or acceptance pass on the same machine otherwise shares and clobbers the one default
session.

Write any screenshots or scratch captures to a host-neutral scratch path (the OS
temp dir, or `~/.cache/<name>/<run>/`), never the repo working tree — your pass must
leave no diff. If a tool forces an in-repo path, delete the file before you return.
