| env | skill | when |
|---|---|---|
| `web` | `web-visual-loop` | a browser-rendered web UI / dev server |
| `electron` | `electron-visual-loop` | an Electron renderer you can launch with CDP |
| `desktop` | `desktop-app-loop` | a packaged/foreign native app with no debug port |

If a criterion omits `env`, infer it from the repo (web framework + dev server →
`web`; an `electron` dependency / main process → `electron`; a packaged native app
→ `desktop`) and state the inference in your evidence.
