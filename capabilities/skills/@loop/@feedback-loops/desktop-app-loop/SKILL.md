---
description: Automate and visually verify an ARBITRARY foreign desktop app you did NOT build and did NOT launch in debug mode (e.g. the OpenAI Codex desktop app). A tiered, best-fidelity-first recipe — CDP relaunch, then OS-native accessibility read-back, then a vision computer-use fallback — for clicking through a packaged app's UI and reading back state with no cooperation from the app. Model-agnostic and OS-agnostic (Windows + macOS). Use when the user needs to drive or test a third-party/packaged desktop app, read a setting back from a foreign GUI, automate an app with no remote-debugging port, "control Codex app", "test this desktop app I didn't build", "read back a dropdown selection from a native app", or when electron-visual-loop fails because you don't control the launch.
allowed-tools: Bash(agent-browser:*), Bash(npx agent-browser:*), Bash(python:*), Bash(python3:*), Bash(py:*), Bash(pwsh:*), Bash(powershell:*)
added_in: 0.14.0
license: Apache-2.0
---

# Desktop App Loop (foreign / non-debug apps)

`electron-visual-loop` and `web-visual-loop` work only because **you control the
launch** — you add `--remote-debugging-port` and attach over CDP. This skill is
for the opposite case: a **packaged desktop app you did not build and did not
launch in debug mode** (canonical target: the OpenAI Codex desktop app). The
app gives you nothing; you recover control yourself.

Canonical task: open the app's settings, change the theme dropdown, and **read
back which item is selected**.

## The decision flow — try in order, fall through explicitly

```
Tier 1  CDP relaunch ........ can you relaunch the app? (incl. MSIX, see below)
        |  discover exe/pkg -> (confirm) quit -> relaunch with BOTH
        |    --remote-debugging-port=9222 --force-renderer-accessibility
        |  -> probe :9222/json
        |  port opens? -> agent-browser connect -> click + read DOM (assertion-exact). DONE.
        |  port empty (Electron 30+ ignored flag)? ----------------------------v
        v                       (...but the relaunch above also armed Tier 2)
Tier 2  OS-native accessibility read-back ...... Windows + macOS, NO port
        |  force/await the renderer a11y tree -> open the dropdown -> read the
        |  selected item from the structured tree (deterministic). DONE.
        |  hardened app (renderer a11y won't activate) & can't relaunch? -------v
        v
Tier 3  Vision computer-use (universal fallback) ......... any pixels, any OS
           screenshot -> grounding model picks a target -> synthesize input ->
           re-screenshot and judge. Pluggable model (agent itself, or UI-TARS).
```

**Invariant:** tiers rank by *verification* fidelity, not driving ability. Vision
(Tier 3) drives any UI fine — what drops is the oracle: Tiers 1–2 **assert** on
structured state (**no model**); Tier 3 **judges a screenshot**. Prefer the highest
tier that yields a structured read-back.

**Validated against the Codex desktop app (MSIX, Chromium 148, Windows):** all
three tiers work. Tier 1 needs the MSIX container relaunch; Tier 2 needs the
`--force-renderer-accessibility` flag from that same relaunch (Codex ignores
runtime activation); Tier 3 works as-is on the live app. One relaunch with both
flags arms Tiers 1 and 2 together.

All helper commands below assume the skill directory is the working dir (so
`helpers/...` resolves). Adjust the path if you run from elsewhere.

---

## Tier 1 — CDP relaunch (deterministic, full DOM)

Best fidelity. Available only if you can relaunch the app yourself.

### 1. Discover the executable and whether you can pass flags

**Windows:**
```powershell
pwsh -NoProfile -File helpers/discover_exe.ps1 -Match "codex"
```
Returns JSON: `kind` (`exe` | `msix`), `exePath`, `aumid`, `appId`,
`runningPids`, `mainWindowPids`, `launchCommand`, `relaunchWithArgs`,
**`canPassArgs`**.

- `kind: exe`, `canPassArgs: true` → relaunch directly (step 3a).
- `kind: msix` (Store-packaged, e.g. Codex) → the shell can't forward flags, but
  you **can** inject them inside the package container via the prebuilt
  `relaunchWithArgs` command (step 3b). **Validated: this opens the CDP port on
  Codex.** Don't give up on Tier 1 just because it's MSIX.

**macOS:** the app is `/Applications/<App>.app`; discover the running pid with
`pgrep -lf <App>` or `mdfind "kMDItemKind == 'Application'" | grep -i <app>`.

### 2. Quit the running instance (REQUIRED) — with a confirmation gate

Most Electron apps hold a single-instance lock: launching a second copy with the
flag just forwards args to the already-running portless instance and exits, so
the port never opens. You must fully quit first.

Quitting a foreign app the user is actively using can lose unsaved state.
**Confirm before killing**, unless the app isn't currently running:
```powershell
# after the user confirms (Codex has a GUI + a CLI process swarm — stop all):
Get-Process -Name codex | Stop-Process -Force
```

### 3a. Relaunch a normal exe with the flags, then probe
```powershell
Start-Process "<exePath>" -ArgumentList "--remote-debugging-port=9222 --force-renderer-accessibility"
# macOS: open -a "<App>" --args --remote-debugging-port=9222
```

### 3b. Relaunch an MSIX app with the flags (inside its package container)
**Run the `relaunchWithArgs` string from discovery verbatim** — it already has the
right `PackageFamilyName`, `AppId`, and `exePath` filled in. The example below is
Codex's (its `AppId` happens to be `App`; other apps differ — use discovery's value):
```powershell
Import-Module Appx -UseWindowsPowerShell
Invoke-CommandInDesktopPackage -PackageFamilyName 'OpenAI.Codex_2p2nqsd0c76g0' `
  -AppId 'App' -Command '<exePath>' -Args '--remote-debugging-port=9222 --force-renderer-accessibility'
```

### 4-pre. Probe
```powershell
Start-Sleep -Seconds 3
(Invoke-WebRequest http://localhost:9222/json -UseBasicParsing).Content   # any targets?
```
Empty / connection refused → Electron ignored the flag (possible on Electron 30+).
**Fall through to Tier 2.**

> **Key insight from validation:** include `--force-renderer-accessibility` in the
> relaunch even when you want CDP. It costs nothing for Tier 1 and simultaneously
> unblocks **Tier 2** — so one relaunch arms both deterministic tiers for a
> hardened app like Codex.

### 4. Connect and drive (same loop as electron-visual-loop)
```bash
agent-browser connect 9222          # or: npx agent-browser connect 9222
agent-browser snapshot -i           # discover @e refs
agent-browser click @e5             # open the theme dropdown
agent-browser snapshot -i           # re-snapshot; read the selected option from the DOM
```

> ASAR patching to force a debug port is an **explicitly-flagged escape hatch
> only** — it breaks code signing and app updates and may violate the app's ToS.
> Never do it by default.

---

## Tier 2 — OS-native accessibility read-back (no debug port)

The closest thing to `electron-visual-loop` for a foreign app: structured,
assertion-based read-back with no port. Windows uses UI Automation; macOS uses
the AX API. One cross-platform helper handles both.

### 0. Ensure the dependency (idempotent — installs only the OS-correct package)
```bash
python -m pip install -r helpers/requirements.txt
```

### 1. Confirm the a11y tree populates (the lazy-build check)

The Chromium renderer a11y tree builds **lazily**. The helper auto-activates it
(sets the system screen-reader flag + binds MSAA to the render-widget HWND, then
**restores the flag** on exit) and polls until the tree settles:
```bash
python helpers/a11y_readback.py dump --title-re "(?i)codex" --out tree.json
# total_descendants should be hundreds/thousands, not ~9.
```

**Two outcomes, from real validation:**
- **Cooperative apps** (VS Code, Slack, …) activate at runtime — the helper alone
  yields a full tree (VS Code: 1400+ nodes).
- **Hardened apps** (Codex) **ignore all runtime activation** — screen-reader
  flag, MSAA bind, and UIA event handlers all leave a ~12-node skeleton. The
  **only** thing that works is relaunching with `--force-renderer-accessibility`
  (Tier 1, step 3). After that relaunch, this same dump returns the real tree
  (Codex: a `Document`/RootWebArea with the full UI). So: skeleton + you can
  relaunch → do the Tier-1 relaunch with the a11y flag, then read here.

### 2. Open the target widget, THEN read it

Collapsed/virtualized dropdowns don't populate their options until opened. Open
the dropdown (via Tier-3 input synthesis, a UIA Invoke, or by asking the user),
then read back which item is selected:
```bash
# find the theme combobox
python helpers/a11y_readback.py dump --title-re "(?i)codex" --control-type ComboBox

# with the dropdown open, read the selected option
python helpers/a11y_readback.py selected --title-re "(?i)codex" --name-re "(?i)theme|dark|light|system"
```
`selected` returns only elements whose `SelectionItem.IsSelected` (Windows) /
`AXSelected` (macOS) is true — your assertion target.

Helper verbs: `dump` (walk subtree → JSON) and `selected` (only selected items).
Filters: `--name-re`, `--control-type`, `--pid`, `--max`, `--max-depth`.

---

## Tier 3 — Vision computer-use (structure-blind channel, model-agnostic)

Reach here when no structured read-back exists — no relaunch, widget invisible to
a11y, or a non-Windows/macOS OS. Three layers:

1. **Executor** — bundled, no extra deps:
   - **Screenshot**: `pwsh helpers/capture_window.ps1 -ProcId <pid> -Out shot.png`
     (DPI-aware OS capture). It **foregrounds the target first** — OS capture grabs
     whatever is *painted* at the window rect, so an occluded window would capture
     whatever sits on top of it (pass `-NoForeground` to skip). Prints the window's
     screen-space `x,y,width,height`.
   - **Input synthesis**: `python helpers/input_synth.py <verb>` — `click --x --y`,
     `move --x --y`, `scroll --x --y --amount` (negative = down), `type --text`,
     `key --keys` (Win32 `SendInput` / macOS `CGEvent`; `key` chords are
     Windows-only today). Coordinates are absolute screen pixels — add the in-image
     offset to the window origin from `capture_window.ps1`. The target must be
     foregrounded (the screenshot step does this) or input lands in the wrong window.
2. **Grounding model** — a **pluggable slot** ("given this screenshot, where do I
   click?"). Two ways to fill it:
   - **The agent itself** (lightweight, no install): screenshot → you read the
     PNG and pick coordinates → `input_synth.py click`. **This is the validated
     path** — it dismissed Codex's onboarding modal end-to-end.
   - **[UI-TARS-desktop](https://github.com/bytedance/UI-TARS-desktop)** (heavier,
     local, no cloud) as the default autonomous driver; or Claude computer-use /
     OpenAI CUA / Gemini Computer Use. The loop shape is identical.
3. **Optional** [OmniParser V2](https://www.microsoft.com/en-us/research/articles/omniparser-v2-turning-any-llm-into-a-computer-use-agent/)
   — turns a screenshot into a numbered element list for steadier targeting.

The validated loop (screenshot → locate → click → re-screenshot to verify):
```powershell
pwsh helpers/capture_window.ps1 -ProcId 49208 -Out before.png   # read it, find target
python helpers/input_synth.py click --x 578 --y 568             # act
pwsh helpers/capture_window.ps1 -ProcId 49208 -Out after.png    # verify state changed
```

Verification here is **vision-based** (judge a screenshot), not assertion-based —
add explicit waits/retries; there is no event to await.

---

## Enumerating a scrollable list (e.g. a long dropdown)

A concrete lesson from reading a 27-item theme dropdown with all three tiers:

- **Tiers 1 & 2 read the whole list in one query** — the full set of options is in
  the DOM / UIA tree even when scrolled out of view. Tier 1:
  `agent-browser --cdp 9222 eval "Array.from(document.querySelectorAll('[role=menu] [role=menuitem], [role=option]')).map(e=>e.textContent.trim())"`.
  Tier 2: `a11y_readback.py dump --pid <pid> --control-type MenuItem` (or `ListItem`).
  Open the popup first; collapsed/virtualized lists don't populate.
- **Tier 3 (vision) must scroll and stitch**, and is **gap-prone**: a scroll step
  larger than the visible window skips items. Scroll in **small, overlapping**
  steps (`input_synth.py scroll --amount -3`, re-screenshot, repeat) and verify
  continuity between captures. Prefer Tier 1/2 for exhaustive enumeration.
- **Selected/checked state**: a `menu`/`menuitem` widget does *not* expose
  selection via UIA's SelectionItem (Tier 2 returns no `selected`). Read it from
  the DOM `aria-checked` (Tier 1) or the visible checkmark (Tier 3) instead.

---

## Platform & model matrix

| Tier | Windows | macOS | Linux | Needs a model? |
|---|---|---|---|---|
| 1 CDP relaunch | yes | yes | yes (untested) | no |
| 2 a11y read-back | UIA / pywinauto | AX / PyObjC | no (AT-SPI out of scope) | no |
| 3 vision | SendInput | CGEvent | yes | yes (swappable) |

## Troubleshooting

**Tier 1 — port never opens.** For MSIX apps, make sure you used `relaunchWithArgs`
(Invoke-CommandInDesktopPackage), not the shell launch — the shell silently drops
the flag. If you did and it's still empty, Electron 30+ may have dropped
`--remote-debugging-port`; fall through to Tier 2 (which the same relaunch armed
via `--force-renderer-accessibility`).

**Tier 2 — only ~12 nodes / tree won't populate.** The helper auto-activates, so a
persistent skeleton means a **hardened app** (Codex behaves this way): no runtime
signal works. Relaunch it with `--force-renderer-accessibility` (Tier 1 step 3),
then re-run `dump`. Also confirm the target widget is on-screen and, for dropdown
options, that the dropdown is **open**.

**Tier 2 — widget present but no `selected`.** Custom widgets sometimes expose
the value via the Value pattern instead of SelectionItem — check the `value`
field in `dump` output. If neither is exposed, fall through to Tier 3.

**Targeting the wrong process.** Packaged apps spawn many helper processes (Codex
has a windowless CLI swarm + the GUI). Use `mainWindowPids` from
`discover_exe.ps1` and pass `--pid` to the helper to pin the GUI window.

## Runtime requirements

If you control the app's launch (can start it with a debug port), use `electron-visual-loop` instead — this skill is the fallback for a foreign app you can't relaunch debuggable.

- Tier 1: `agent-browser` on PATH (or `npx agent-browser`); a way to relaunch
  (`Start-Process` for exe apps, `Invoke-CommandInDesktopPackage` for MSIX).
- Tier 2: Python 3.9+ and `pip install -r helpers/requirements.txt` (pywinauto on
  Windows, PyObjC AX on macOS). PowerShell 7 (`pwsh`) for `discover_exe.ps1`.
- Tier 3: Python + PowerShell for the bundled executor (no extra deps). An
  optional autonomous grounding model (UI-TARS-desktop) installs separately.
