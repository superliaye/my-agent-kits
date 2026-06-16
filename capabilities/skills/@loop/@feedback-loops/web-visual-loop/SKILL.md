---
description: Automate and visually verify a browser-rendered web UI using agent-browser via Chrome DevTools Protocol. Built for the local edit→reload→re-verify dev loop, but the connect + verification spine work against any URL (local, staging, production). Use when iterating on a UI and wanting a visual feedback loop, or to verify that a route renders, a flow works, or a page didn't regress. Triggers include "visual feedback loop for the web app", "screenshot the dev server", "verify the UI renders", "test this route", "iterate on the design".
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*), Bash(google-chrome:*), Bash(chromium:*), Bash(open:*)
added_in: 0.11.0
metadata:
  philosophy_reviewed: 2026-06
---

# Web visual loop

The web-stack counterpart to `electron-visual-loop` — same transport (Chrome DevTools Protocol via `agent-browser`), pointed at a Chromium instance loading a web page. Primary use is the **local dev loop** (edit code → HMR reload → re-verify), but the connect and verification steps work against **any URL** — only "boot the dev server" and "HMR reload" are dev-local.

This skill owns the **iteration philosophy and the verification spine**. It does **not** re-document `agent-browser`'s commands — those drift between versions.

## Load the command reference first

`agent-browser` ships an agent-oriented guide that always matches the installed binary. Read it instead of relying on memorized flags:

```bash
agent-browser --version              # need `diff`, `is`, `network`, `trace`
agent-browser skills get core --full # version-matched command reference
```

If a command below is missing: `agent-browser upgrade` (or `doctor --fix`). Treat `skills get core` as the source of truth for *how* to call commands; this file for *what to verify, in what order*.

## The loop

1. **Boot the dev server** if iterating locally (`npm run dev`, `bun run dev`, `python -m http.server`); capture its URL. Skip for a remote/deployed URL.
2. **Launch Chromium with CDP** and connect:
   ```bash
   # macOS:   open -a "Google Chrome" --args ...   |   Linux: google-chrome ...   |   Windows: chrome.exe ...
   chrome --remote-debugging-port=9222 --user-data-dir=/tmp/agent-chrome http://localhost:5173
   agent-browser connect 9222           # or: agent-browser --auto-connect
   ```
   A dedicated `--user-data-dir` is required — Chromium refuses CDP on a profile already open elsewhere.
3. **Navigate + run the verification spine** (below).
4. **Iterate** — edit code, HMR reloads, re-run the spine. (For a static URL, just re-run after a deploy.)

## The verification spine

**A bare "LLM looks at the screenshot and judges it" is not a reliable gate** — it passes broken UIs too often to be ground truth. Gate on deterministic signals first; reserve pixel judgment for genuinely aesthetic questions. `agent-browser batch --bail "…" "…"` chains these and stops on first failure.

1. **State — deterministic.** `agent-browser is visible "#checkout"` · `is enabled "#submit"` · `get count ".item"`. Pair with `wait <sel>` / `wait --load networkidle` so you assert after the page settles, not during hydration.
2. **A11y-tree regression — deterministic.** `snapshot -i > good.txt` once, then `diff snapshot --baseline good.txt`. Resists styling churn, unlike pixel diffs. (No `--baseline` → diffs against the session's last snapshot: "did this edit change the tree at all".)
3. **Console + network gating.** `errors` · `console` · `network requests --status 400-499` (and `500-599`). A clean screenshot can sit on a failed request.
4. **Visual regression — deterministic pixels.** `screenshot home.png` once, then `diff screenshot --baseline home.png --threshold 0.1`. Loop breakpoints with `set viewport <w> <h>`.
5. **Aesthetic judgment — last, structured.** Only here does screenshot-and-judge belong, and only for what has no deterministic answer (spacing, hierarchy, brand). Use `screenshot --annotate` and hand to `design-critique` — not a free-form "looks good?".
6. **Trace for forensics.** When a flow fails, `trace start trace.json` → drive → `trace stop` instead of reconstructing from screenshots.

## Notes

- **Dark mode:** default CDP scheme is `light`; use `--color-scheme dark` or `AGENT_BROWSER_COLOR_SCHEME=dark`.
- **Page won't reload after an edit:** HMR isn't running — check the dev-server terminal for build errors; `agent-browser reload` forces a full reload.
- **CDP "connection refused":** confirm `--remote-debugging-port=9222`; a pre-existing instance on the same `--user-data-dir` refuses CDP. Windows: `netstat -ano | findstr :9222`.
- Stale-ref / hydration / synthetic-input issues: see `agent-browser skills get core --full`.

## Requirements

`agent-browser` on PATH (or `npx agent-browser`); a Chromium-based browser on PATH (not auto-installed); a reachable URL. For an Electron app rather than a web page, use `electron-visual-loop` (same transport, different target).
