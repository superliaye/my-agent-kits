# Design: `desktop-app-loop` skill

**Status:** implemented + validated end-to-end against Codex (Windows)
**Date:** 2026-05-29
**Target kit version:** 0.14.0
**Origin:** `%TEMP%\handoff-my-agent-kits-desktop-automation.md` (+ seed `handoff-nondebug-desktop-automation.md`)

## Problem

`electron-visual-loop` and `web-visual-loop` drive apps **we control** — they work only because we own the launch and can add `--remote-debugging-port`, exposing a CDP endpoint to click and assert against. A **foreign packaged desktop app we did not build and did not launch in debug mode** (canonical target: the OpenAI Codex desktop app) removes that single lever. Against such an app, the prior fallback was passive OS screen-capture: read-only, every interaction performed by a human, then re-capture.

This skill closes that gap: a tiered, self-checking recipe that lets an agent **click through a foreign desktop app's UI and read back state** — without the human owning the launch.

Canonical end-to-end test: open the target app's settings, change the theme dropdown, and confirm which item is selected.

## Non-goals

- Not enhancing `electron-visual-loop` in place (it is vendored from upstream; a sibling skill keeps re-sync clean and mirrors the electron/web-visual-loop pattern).
- Not ASAR patching / fuse-bypass injection as a default (breaks code signing + app updates, violates ToS — mention only as a flagged escape hatch).
- Linux accessibility (AT-SPI) is out of scope; Tiers 1 & 3 still work there, Tier 2 does not.
- No new `deploy.js` code path; the skill stays copy-only (kit philosophy: skills are file copies, bundles are the heavyweight escape hatch).

## Shape

A new skill at `.apm/skills/desktop-app-loop/`, sibling to `electron-visual-loop` and `web-visual-loop`. Original (not vendored) → no `SOURCE.md`. Model-agnostic and OS-agnostic (macOS + Windows).

```
.apm/skills/desktop-app-loop/
├── SKILL.md                  # the tiered recipe + decision flow
└── helpers/
    ├── a11y_readback.py      # cross-platform Tier-2 helper: pywinauto (Win) / PyObjC-AX (mac), uniform JSON CLI
    ├── requirements.txt      # env-marker pinned deps (installs only the OS-correct package)
    └── discover_exe.ps1      # Tier-1 Windows executable discovery (mac discovery is inline in SKILL.md)
```

Skill folders are copied recursively by `deploy.js` (`cpSync(srcDir, dstDir, { recursive: true })`), so `helpers/` lands in the consumer repo's `.claude/skills/desktop-app-loop/helpers/`.

## The three tiers (best-fidelity-first, explicit fall-through)

The skill implements the **decision flow**, not just a description. Invariant: **Tiers 1 & 2 are deterministic and model-free; only Tier 3 needs a model, and even that is swappable.**

### Tier 1 — CDP relaunch (deterministic, full DOM; agent-driven)

Best fidelity. Only available if the app can be relaunched.

1. **Discover the executable** (no human path-typing):
   - Windows: running process (`Get-Process <name> | Select-Object -Expand Path`), Start-Menu shortcut target, or registry (`HKCU\...\App Paths`, uninstall keys). Bundled `helpers/discover_exe.ps1`.
   - macOS: `/Applications/<App>.app`, `mdfind`, or `ps` (inline one-liner).
2. **Quit any running instance** — required, not optional, because most Electron apps call `requestSingleInstanceLock()`: a flagged launch while a portless copy runs just forwards args to the existing instance and exits, so the port never opens. **Confirmation gate before killing** a running foreign app (possible unsaved-state loss); no confirmation needed if not currently running.
3. **Relaunch with the flag**:
   - Windows: `Start-Process "<path>" -ArgumentList "--remote-debugging-port=9222"`
   - macOS: `open -a "<App>" --args --remote-debugging-port=9222`
4. **Probe** `http://localhost:9222/json`. Target present → `agent-browser connect 9222` → standard snapshot/click/read-DOM flow (assertion-exact).
5. **Fall through if the probe is empty.** Electron 30+ can silently ignore/reject the CLI flag before JS runs (broke Playwright's launcher: microsoft/playwright#39008, fixed #39012, 2026-01-28). Probe `:9222/json`; if empty, drop to Tier 2 — do not fight it.

Notes:
- Reuses `agent-browser` (already the visual-loop family's documented dep). Playwright's `_electron` API only *launches* a process it spawns — it cannot attach; use `agent-browser` / `connectOverCDP`.
- ASAR patching: flagged escape hatch only, never default.

### Tier 2 — OS-native accessibility read-back (no debug port)

The closest `electron-visual-loop`-equivalent for a foreign app: structured, assertion-based read-back, no port. Same *shape* on both OSes (find window → force the lazy renderer a11y tree to build → open the dropdown → read the selected item from the structured tree), different *backend*.

- **Windows:** UIA via **pywinauto** (`uia` backend). Chromium implements the Windows UIA provider natively, on by default from Chrome 138 / Chromium 142 (Aug 2025), so ARIA roles map into the UIA tree (a `role="combobox"` div exposes its options + `SelectionItem.IsSelected`). Catch: the renderer a11y tree is built lazily — a naive scrape sees only a ~9-node window skeleton. Force activation (launch flag `--force-renderer-accessibility` if the app forwards it, or runtime AT-activation). Open the dropdown before reading (collapsed/virtualized popups don't populate). Poll for the tree to settle after each action.
- **macOS:** the **AX API** via PyObjC. Force the renderer tree by setting **`AXManualAccessibility = true`** on the app's AX element (the mac analog of the Windows force-accessibility handshake — Chromium builds its tree lazily on both OSes). Read selection from `AXValue` / selected-children.

One **cross-platform helper** `helpers/a11y_readback.py` detects the OS and branches internally, exposing a uniform CLI: dump the structured tree as JSON, and read the selected item. Avoid WinAppDriver (unmaintained since Nov 2023) and Appium-Windows (wraps that dead server).

### Tier 3 — Vision computer-use (universal fallback; model-agnostic)

Works on any pixels when Tiers 1–2 are unavailable. Three layers:

1. **Executor** — screenshot + OS input synthesis (Windows `SendInput`; macOS Quartz `CGEvent`), DPI-aware, target window foregrounded.
2. **Grounding model** — a **pluggable slot**, never Claude-locked. Default: **UI-TARS-desktop** (ByteDance; local on Windows + macOS, pure-pixel grounding, ships executors for both OSes). Documented swaps: Claude computer-use, OpenAI CUA, Gemini Computer Use.
3. **Optional OmniParser V2** — turns a screenshot into a numbered element list for better targeting + more deterministic verification.

Verification here is vision-based (a model judges a screenshot), not assertion-based → explicit waits/retries; no event to await.

UI-TARS-desktop is a heavy GUI app → **documented install only**, never auto-installed.

## Platform & model matrix

| Tier | Windows | macOS | Linux | Needs a model? |
|---|---|---|---|---|
| 1 — CDP relaunch | ✓ | ✓ | ✓ (works, untested in scope) | No |
| 2 — A11y read-back | ✓ UIA/pywinauto | ✓ AX/PyObjC | ✗ (AT-SPI out of scope) | No |
| 3 — Vision | ✓ SendInput | ✓ CGEvent | ✓ | Yes (swappable) |

## Dependencies

Bundled **with the skill folder**, not as a preset-level bundle, and not installed at wizard-deploy time (keeps deploy copy-only / network-free per kit philosophy):

- `helpers/requirements.txt` with environment markers so `pip install -r` resolves only the OS-correct package:
  - `pywinauto ; platform_system == "Windows"`
  - `pyobjc-framework-ApplicationServices ; platform_system == "Darwin"` (minimal AX subset — not the full PyObjC metapackage)
- The SKILL.md Tier-2 step begins with one **idempotent** line — `python -m pip install -r helpers/requirements.txt` — run automatically by the agent the first time Tier 2 is reached. No-ops if already present.
- Tier 1: `agent-browser` (reuse visual-loop family's documented dep). Tier 3: UI-TARS-desktop (documented-only).

## Registration

- Add `desktop-app-loop` to `presets/experimenting-engineering.yaml` under `primitives.skills`.
- One-line cross-reference added to `electron-visual-loop` and `web-visual-loop` ("for a foreign app you didn't launch, see `desktop-app-loop`").
- Frontmatter: `added_in: 0.14.0`, `allowed-tools` whitelisting `agent-browser`, `python`, and the PowerShell discovery helper; model-invocable (no `disable-model-invocation`).
- Bump `package.json` to 0.14.0 + CHANGELOG entry.

## Build & validation plan

1. **Write spec** (this doc) + commit.
2. **Build skill basics** — SKILL.md tiered recipe, `helpers/a11y_readback.py` (both OS branches), `requirements.txt`, `discover_exe.ps1` — without fully executing.
3. **Validate each tier live against the Codex desktop app on Windows** (this machine is win32 → Tier 2 exercises the UIA path; the macOS AX branch is built but cannot be live-validated here):
   - Tier 1: discover Codex exe → quit → relaunch with `--remote-debugging-port` → probe → (if port opens) connect + read theme dropdown via DOM. Records whether Codex's Electron version honors the flag.
   - Tier 2: pywinauto force-activate Codex's renderer a11y tree → open theme dropdown → read `IsSelected`.
   - Tier 3: vision loop screenshots Codex → grounding model targets the dropdown → input synthesis → re-screenshot verify.
4. **Finalize** once all three tiers are demonstrated working (or each tier's real-world limit is documented — e.g., Tier 1 unavailable if Codex's Electron ignores the flag, which is itself a valid recorded outcome that proves the fall-through).
5. Deploy-path check: `agent-kit init … --primitives '+desktop-app-loop'` lands the full folder (incl. `helpers/`) in a target repo's `.claude/skills/`; `verify.js` confirms.

## Validation results (2026-05-29, Codex desktop, Windows)

Validated end-to-end against the OpenAI Codex desktop app (MSIX package
`OpenAI.Codex_2p2nqsd0c76g0`, Electron/Chromium 148). All three tiers work.

- **Tier 1 — CDP relaunch: PASS.** `discover_exe.ps1` correctly classified Codex
  as `kind: msix`, `canPassArgs: false`, and emitted a `relaunchWithArgs` using
  `Invoke-CommandInDesktopPackage`. Quitting Codex and running that relaunch with
  `--remote-debugging-port=9222 --force-renderer-accessibility` opened the CDP
  port (`/json/version` → Chrome/148); `agent-browser --cdp 9222 snapshot -i`
  returned an interactive snapshot with clickable refs. **Finding:** MSIX apps,
  initially thought to block Tier 1, are drivable via the package-container
  relaunch — Electron honored the debug flag.
- **Tier 2 — accessibility read-back: PASS (with caveat).** Codex is *hardened*:
  pure runtime activation (system screen-reader flag + MSAA `AccessibleObjectFrom­
  Window` bind + UIA focus-event handler) all failed — the renderer tree stayed a
  ~12-node skeleton. The helper was proven correct against VS Code (1400+ nodes).
  The unlock is the `--force-renderer-accessibility` flag from the Tier-1
  relaunch: after it, `a11y_readback.py` returned Codex's real `Document`/
  RootWebArea tree (sidebar, dialog, buttons, text — 187 nodes with the modal
  dismissed). **Finding:** one relaunch with both flags arms Tiers 1 and 2
  together; the helper now self-activates and restores the screen-reader flag.
- **Tier 3 — vision: PASS.** `capture_window.ps1` (DPI-aware OS capture) →
  agent-as-grounding-model located the "Later" button → `input_synth.py click`
  (Win32 SendInput) → re-screenshot confirmed the onboarding modal was dismissed.
  No debug port, no accessibility, no cloud model required.

Helpers added beyond the original plan: `capture_window.ps1` + `input_synth.py`
(Tier-3 executor, needed to make the vision tier usable with the agent as the
swappable grounding model). The a11y helper gained a self-activation step.

## Open items to verify at implementation (current-state, not from this session's research)

The handoff researched **Windows only**. Verify against current (≤12-month) docs when authoring:

- macOS: `AXManualAccessibility` activation behavior on current Electron/Chromium; best-maintained Python AX client in 2026 (`atomacos` vs raw PyObjC `ApplicationServices`).
- UI-TARS-desktop current version, repo, and Windows/macOS executor availability.
- pywinauto current version + `uia` backend behavior against Chromium 142+ native UIA.
- Whether Codex desktop's Electron build honors `--remote-debugging-port` or `--force-renderer-accessibility` (determined empirically in step 3).
