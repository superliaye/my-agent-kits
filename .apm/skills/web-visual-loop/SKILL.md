---
description: Automate and visually verify web apps (Vite, Next, SvelteKit, Astro, plain HTML, etc.) running on a local dev server using agent-browser via Chrome DevTools Protocol. Use when the user is iterating on a browser-rendered UI and wants a visual feedback loop — agent edits code, HMR reloads, agent re-screenshots and judges the pixels. Triggers include "visual feedback loop for the web app", "screenshot the dev server", "verify the UI renders", "test this route", "iterate on the design".
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*), Bash(google-chrome:*), Bash(chromium:*), Bash(open:*)
added_in: 0.11.0
---

# Web visual loop

The web-stack counterpart to `electron-visual-loop`. Same transport (Chrome DevTools Protocol via the `agent-browser` CLI), pointed at a Chromium instance loading a local dev server.

The inner loop:

1. **Boot the dev server** (if not already running).
2. **Launch Chromium with CDP** enabled.
3. **Connect** `agent-browser` to the CDP port.
4. **Navigate** to the route under test.
5. **Snapshot / screenshot** the rendered state.
6. **Iterate** — agent edits code, HMR reloads the page, agent re-snapshots.

## Boot the dev server

Use whatever the project ships. Examples:

```bash
npm run dev        # Vite, Next, Astro, SvelteKit
bun run dev
python -m http.server 8000   # static HTML
```

Run it in a background terminal or via `&`; capture the URL it prints (`http://localhost:5173`, etc.).

## Launch Chromium with `--remote-debugging-port`

### macOS

```bash
open -a "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/agent-chrome \
  http://localhost:5173
```

### Linux

```bash
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/agent-chrome \
  http://localhost:5173 &
```

### Windows

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir=%TEMP%\agent-chrome \
  http://localhost:5173
```

**Why `--user-data-dir`:** isolates the agent's session from your normal browser profile. Chromium refuses CDP on the default profile when another instance is running.

If you already have a Chromium-compatible browser open with debugging enabled, `agent-browser --auto-connect` finds it.

## Connect and drive

```bash
agent-browser connect 9222
agent-browser snapshot -i              # discover interactive elements (@e1, @e2, …)
agent-browser screenshot home.png
agent-browser click @e5
agent-browser snapshot -i              # re-snapshot after navigation
```

After the first `connect`, subsequent commands target the same session — no `--cdp` flag needed.

## Common patterns

### Screenshot every breakpoint
```bash
for w in 360 768 1280; do
  agent-browser viewport "${w}x800"
  agent-browser screenshot "home-${w}.png"
done
```

### Test a flow on the dev server
```bash
agent-browser navigate http://localhost:5173/checkout
agent-browser snapshot -i
agent-browser fill @e3 "test@example.com"
agent-browser click @e7
agent-browser wait 1000
agent-browser screenshot after-submit.png
```

### Read console errors after a code edit
HMR has reloaded the page in the connected tab. Capture console state:
```bash
agent-browser console --since-last 100   # last 100 messages since last call
```
(If your `agent-browser` version doesn't have `--since-last`, fall back to `agent-browser console`.)

### Multi-route visual sweep
```bash
for route in / /about /pricing /docs; do
  agent-browser navigate "http://localhost:5173${route}"
  agent-browser wait 500
  agent-browser screenshot "page$(echo $route | tr / _).png"
done
```

## Multi-tab / multi-window

`agent-browser tab` lists every open page (and webview). Switch with `agent-browser tab <index>` or `agent-browser tab --url "*settings*"`.

## Dark mode preservation

Default scheme through CDP is `light`. To honour the user's dark preference:
```bash
agent-browser --color-scheme dark snapshot -i
# or globally:
AGENT_BROWSER_COLOR_SCHEME=dark agent-browser connect 9222
```

## Troubleshooting

### "Connection refused" / "Cannot connect"
- Confirm Chromium launched with `--remote-debugging-port=9222`.
- A pre-existing Chromium instance on the same `--user-data-dir` will refuse CDP — use a dedicated `--user-data-dir`.
- Windows: `netstat -ano | findstr :9222` to confirm a process is listening.

### Page never reloads after code change
- HMR isn't running — check the dev server's terminal for build errors.
- Some frameworks require a full reload on certain file types; `agent-browser reload` forces it.

### Elements not in snapshot
- The page may still be hydrating. `agent-browser wait 500 && agent-browser snapshot -i`.

### Cannot type in input fields
- Custom React/Vue inputs may swallow synthetic key events. Try `agent-browser keyboard inserttext "text"` instead of `fill`.

## Runtime requirements

- `agent-browser` CLI on PATH (or use `npx agent-browser`). Same dep as `electron-visual-loop` — install once for both.
- A Chromium-based browser (Google Chrome, Chromium, Brave, Edge) on PATH. The agent does not auto-install one.
- A running dev server. The agent doesn't manage server lifecycle; that's part of the repo's existing tooling.

## Relationship to other skills

- **`electron-visual-loop`** — same transport (agent-browser CDP), different target (an Electron app launched with `--remote-debugging-port` vs. a Chromium instance loading a local URL). Use one or the other depending on the project type.
- **`design-critique`** — consumes the screenshots this skill produces; runs the qualitative judgment pass.
- **`feature-loop`** — Phase 5a invokes this skill for web stacks to capture screenshots of the just-implemented UI.
