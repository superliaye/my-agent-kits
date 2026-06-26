| env | skill | when |
|---|---|---|
| `web` | `web-visual-loop` | a browser-rendered web UI / dev server |
| `electron` | `electron-visual-loop` | an Electron renderer you can launch with CDP |
| `desktop` | `desktop-app-loop` | a packaged/foreign native app with no debug port |

If a criterion omits `env`, infer it from the repo (web framework + dev server →
`web`; an `electron` dependency / main process → `electron`; a packaged native app
→ `desktop`) and state the inference in your evidence. When signals conflict — an
Electron app that *also* serves a web dev URL — pick the surface the repo **documents**
as shipping; if nothing documents it, report the ambiguity as a readiness gap.

**Drive the surface the app ships as, and confirm it shows real, populated data before
you judge.** A page can render and still be the wrong target — a login wall, a 401 or
empty shell, or an unauthenticated tab whose data only loads inside the shipped app.
Pick the route and wait for data to load; a screen that renders but stays
unauthenticated is a readiness gap, not a finding — treat it as unreachable and stop.

When your loop drives `agent-browser`, connect under a **unique per-run `--session
<name>`** (e.g. this run's slug) rather than the unnamed default — a parallel critic
or acceptance pass on the same machine otherwise shares and clobbers the one default
session. Your `--session` isolates you when several agents drive at once; whether the
app can *serve* parallel agents is the repo's loop setup to provide.

Write screenshots and scratch captures under a single run-scoped scratch dir (the OS
temp dir or `~/.cache/<name>/<run>/`), never the repo working tree — your pass must
leave no diff. If a tool forces an in-repo path, delete the file before you return.

Run-scoped naming keeps a finished pass's leftover session, captures, and user-data-dir
from colliding with the next run — they're safe to leave, so clean up only if it's cheap.
