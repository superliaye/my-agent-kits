# agent-kit-installer (`my-agent-kits`) — Design Spec

**Date:** 2026-05-08
**Status:** Approved for implementation planning
**Author:** Leon YE (with Claude as brainstorming partner)

## 1. Problem statement

Deploying personal AI agent artifacts (instructions, slash-command prompts, skills, MCP server configs) across **Claude Code** and **Codex CLI** in a new repo or new machine is currently:

- **Manual** — every repo needs hand-edited `AGENTS.md`, `~/.claude/rules/`, etc.
- **Repetitive** — same primitives copy-pasted across many work and personal repos.
- **Error-prone** — APM has agent-specific gaps (e.g., Codex global deploy compiles to `~/.apm/AGENTS.md` not `~/.codex/AGENTS.md`); user must remember which extra steps to run.
- **Non-interactive** — APM assumes the user already knows which preset, agents, and primitives they want.

**Scope note:** v0.1 supports Claude Code and Codex CLI only. Other agents (Copilot CLI, Cursor, Windsurf, Gemini, OpenCode) are deferred — see Section 8.

Existing partial solutions:
- `superliaye/dotfiles` + `sync-claude.sh` — works for Claude Code only.
- `superliaye/personal-agent-kit` (APM package) — works at user scope for Claude only; doesn't deploy Codex global automatically.

### Goal

A private wrapper repo `superliaye/my-agent-kits` that:

1. Curates personal + Microsoft-internal primitives in one place.
2. Provides preset bundles (`personal`, `microsoft`, `minimal`).
3. Exposes an interactive wizard `agent-kit init` that asks 5 questions per repo and runs APM with the right flags + plugs APM's gaps.
4. Verifies the deployment after install.
5. Has a Docker-based test matrix that proves every supported `(agent, scope)` combination works for every primitive type.

## 2. Decisions snapshot

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Wrapper on top of APM | Don't reinvent APM's deploy/lockfile/auth/format-conversion. Stay small. |
| Repo strategy | Mono-repo (fold in `personal-agent-kit`) | One place for primitives + presets + wizard. |
| Visibility | Single private repo | Simplest. No public/private split inside the kit; bootstrap requires GitHub auth. |
| Wizard tech | Node 20+ with `@clack/prompts` | Best TUI library; user has Node via nvm. |
| Distribution | Clone + bootstrap-to-PATH | Standard for personal tools (`nvm`, `pyenv`); no public package needed. |
| Preset model | YAML files referencing primitives by name | Inheritable later (`extends:`); explicit, diff-friendly. |
| Supported agents (v0.1) | Claude Code + Codex CLI only | Both fully support repo-scoped AND global instructions; spike validated end-to-end. Other agents deferred. |
| Personal layer in team repos | Write `AGENTS.override.md` + `.gitignore` (Codex) | Codex's documented mechanism for personal-on-top-of-team. |

## 3. Repo layout

```
my-agent-kits/                       (private, github.com/superliaye/my-agent-kits)
├── apm.yml                          # APM manifest for this package
├── package.json                     # Node deps for the wizard (clack, yaml)
├── README.md
├── CLAUDE.md                        # maintenance guide
├── CHANGELOG.md
├── .gitignore
│
├── bin/
│   └── agent-kit                    # tiny shell shim, execs `node lib/wizard.js`
│
├── bootstrap.sh                     # one-time install: npm install + symlink to ~/.local/bin
│
├── presets/
│   ├── personal.yaml                # primitives: [core, typescript, my-commit, ...]
│   ├── microsoft.yaml               # personal + ms-rush, ms-sharepoint, graduate-killswitches
│   ├── minimal.yaml                 # core only
│   └── none.yaml                    # empty starting point
│
├── primitives/                      # all reusable building blocks
│   ├── instructions/
│   │   ├── core.instructions.md             # applyTo: "**"
│   │   ├── typescript.instructions.md       # applyTo: "**/*.{ts,tsx}"
│   │   ├── ms-rush.instructions.md          # applyTo: "**"
│   │   └── ms-sharepoint.instructions.md    # applyTo: "**"
│   ├── prompts/
│   │   ├── my-commit.prompt.md
│   │   ├── my-commit-and-push.prompt.md
│   │   ├── my-create-pr.prompt.md
│   │   ├── my-explain.prompt.md
│   │   ├── my-fix-build.prompt.md
│   │   └── my-clean-code.prompt.md
│   ├── skills/
│   │   └── graduate-killswitches/
│   │       └── SKILL.md
│   ├── mcp/
│   │   └── (empty for MVP)
│   └── hooks/
│       └── (empty for MVP)
│
├── lib/                             # wizard implementation (Node)
│   ├── wizard.js                    # entrypoint
│   ├── presets.js                   # loads presets/*.yaml
│   ├── primitives.js                # discovers primitives/
│   ├── apm-writer.js                # generates per-repo apm.yml
│   ├── deploy.js                    # orchestrates apm install + compile + post-steps
│   ├── agents.js                    # per-agent quirks (Codex global copy, refuse rules)
│   └── verify.js                    # post-install file checks + summary
│
└── test/
    ├── Dockerfile.test              # base image with apm + node + git + agent-kit
    ├── run-tests.sh                 # iterates the matrix
    ├── cases/
    │   ├── claude-repo.sh
    │   ├── claude-global.sh
    │   ├── codex-repo.sh
    │   ├── codex-global.sh
    │   ├── update-content-only.sh
    │   └── update-adopt-defaults.sh
    └── lib/
        └── assertions.sh
```

## 4. Wizard flow

`agent-kit init` is a 5-step interactive wizard. Run from any git repo, including from a fresh clone.

### Step 1/5 — Single-select preset

```
? Pick a preset:
  > personal              core + typescript + commit/PR prompts
    microsoft             personal + Rush + SharePoint + KS graduate
    minimal               core only, no slash commands
    none                  start empty, pick everything manually
```

### Step 2/5 — Multi-select customize primitives

Pre-checked = preset's defaults. User can add or remove.

```
? Add or remove primitives (space=toggle):
  Instructions
    [x] core
    [x] typescript
    [ ] react
    [ ] python
  Prompts
    [x] my-commit
    [x] my-commit-and-push
    [x] my-create-pr
    [x] my-explain
    [x] my-fix-build
    [x] my-clean-code
  Skills
    [ ] graduate-killswitches
  MCP servers
    [ ] (none defined for MVP)
```

### Step 3/5 — Multi-select coding agents

```
? Which agents in this repo?:
  [x] Claude Code
  [x] Codex CLI
```

(v0.1 supports these two only; see Section 8 for deferred agents.)

### Step 4/5 — Single-select install scope

```
? Where should these primitives live?:
  > Repo-scoped     written into this repo (./.claude/, ./AGENTS.md)
                    primitives are committed by default; AGENTS.override.md path is gitignored
    Global          written to ~/.claude/, ~/.codex/AGENTS.md
                    available across all repos on this machine
```

Both options work for both supported agents. No refusal logic in v0.1. (When v0.2 adds Copilot/Cursor, we revisit; their workspace-only nature will reintroduce the refusal sub-flow then.)

#### Step 4b (conditional) — Codex personal layer

Shown only when `scope=repo` AND `Codex` is in the selected agents:

```
? Codex supports a personal layer (`AGENTS.override.md`, gitignored) on top of
  the team's `AGENTS.md`. Add one for your selected primitives?
  > No   (preset's primitives go in the committed AGENTS.md only)
    Yes  (preset's primitives go in AGENTS.override.md, gitignored;
          the committed AGENTS.md is left untouched if it already exists,
          or created empty if it doesn't)
```

Default: **No**. Choosing Yes makes the install non-team-affecting at the cost of needing to redo on each clone. Useful when the user is testing a preset before promoting it to team standards.

### Step 5/5 — Apply + verify

```
✓ Wrote apm.yml (1 dep, 2 targets)
✓ Ran apm install --force
✓ Ran apm compile -t claude,codex
✓ For Codex global: copied ~/.apm/AGENTS.md → ~/.codex/AGENTS.md  (skipped: not global)
✓ Wrote AGENTS.override.md and added to .gitignore (personal layer for Codex, opt-in)

Verification:
  Claude Code         .claude/commands/          6 files OK
                      .claude/rules/             2 files OK
  Codex CLI           AGENTS.md                  OK (1.6 KiB, 5% of 32 KiB cap)
                      AGENTS.override.md         OK, gitignored

All deployments verified. Run /my-commit in Claude Code or invoke `codex` to confirm.
```

If any verification check fails, exit code is non-zero and the gap is printed clearly.

### Non-interactive flags (for CI / scripting)

The same wizard can be driven without prompts:

```bash
agent-kit init \
  --preset personal \
  --agents claude,codex \
  --scope global \
  --primitives "+react,-typescript" \   # delta from preset
  --yes                                  # skip final confirm
```

Used by the test matrix and by power users.

## 4b. `agent-kit update` flow

After `init`, the kit (`my-agent-kits`) keeps evolving — new instructions, new prompts, new presets. The repo that was bootstrapped previously needs a low-friction way to catch up. `agent-kit update` is the answer.

### State tracking

`agent-kit init` writes a small state file to the repo on first run:

```yaml
# .agent-kit.yaml  (committed by default; user can move to .gitignore)
preset: personal
kit_version_at_last_run: 0.1.0       # the version of my-agent-kits at init/last update
last_run: 2026-05-08T12:34:56Z
selected_agents: [claude, codex]
scope: repo
primitives_at_last_run:              # snapshot — used to compute delta on update
  instructions: [core, typescript]
  prompts: [my-commit, my-commit-and-push, my-create-pr, my-explain, my-fix-build, my-clean-code]
  skills: []
  mcp: []
```

The kit's version comes from `package.json` of `my-agent-kits` (semver-tagged on each release). Per-primitive `added_in` field in each preset's YAML lets the wizard compute "what's new since `kit_version_at_last_run`".

### Update flow (interactive)

```
$ cd ~/work/some-repo
$ agent-kit update

Kit:  my-agent-kits 0.1.0 → 0.3.0   (3 versions ahead)
Repo: last initialized 2026-05-08, preset=personal, scope=repo

Step 1/3  Refresh existing primitives
  ✓ git pull on ~/my-agent-kits
  ✓ apm install --update --force
    - core.instructions.md         CONTENT changed (was sha256:abc..., now sha256:def...)
    - typescript.instructions.md   unchanged
    - my-commit.prompt.md          CONTENT changed
    ... 4 of 8 primitives had content updates

Step 2/3  New primitives available
  Your 'personal' preset gained these since 0.1.0:
    [ ] react.instructions.md       (added v0.2.0)
    [ ] my-review.prompt.md          (added v0.3.0)

  Other new primitives in the kit (not in your preset):
    [ ] github.mcp.yaml              (new MCP server, v0.2.5)
    [ ] code-review/SKILL.md         (new skill, v0.3.0)

  ? Adopt any of these? (space=toggle, enter=skip):

Step 3/3  Removed/renamed/deprecated primitives
  None.

✓ Updated apm.yml: 8 → 9 primitives
✓ Re-ran apm install --force + apm compile
✓ Re-verified deployments (same paths as init)
✓ Updated .agent-kit.yaml (kit_version_at_last_run=0.3.0)
```

### Update modes

| Command | Behavior | When to use |
|---|---|---|
| `agent-kit update` (default) | All 3 steps with prompts in Step 2 | Normal cadence — see what's new, decide what to adopt |
| `agent-kit update --content-only` | Step 1 only; skip detection of new primitives | CI / scripted refresh; you want updates but no prompts |
| `agent-kit update --adopt-preset-defaults` | Auto-add any new primitives the **preset** gained (not other kit additions); no prompt | "Give me whatever the latest preset says, no questions" |
| `agent-kit update --dry-run` | Show what would change; no writes | Safety check before pulling |

### Detecting new primitives

The wizard computes the delta as:

```
new_in_preset       = primitives_in_preset_at_HEAD  - primitives_in_preset_at_kit_version_at_last_run
new_in_kit_other    = all_primitives_at_HEAD        - primitives_in_preset_at_HEAD - primitives_user_already_has
removed_in_preset   = primitives_at_last_run        - primitives_in_preset_at_HEAD - primitives_user_explicitly_added
content_changed     = sha256(primitives_at_HEAD)   != sha256(primitives_at_last_run)
```

Each primitive file declares its origin version in YAML frontmatter:

```yaml
---
description: React conventions
applyTo: "**/*.{tsx,jsx}"
added_in: 0.2.0
---
```

`added_in` is set when the primitive is first committed to the kit and never changed afterward. (Edits to content don't bump it; only adding a brand-new primitive sets it.)

### Removed primitives

If a primitive the user has in their `apm.yml` was removed/renamed/deprecated in a later kit version, Step 3 surfaces it:

```
Step 3/3  Removed/renamed/deprecated primitives
  - my-old-prompt.prompt.md     REMOVED in v0.2.0  (your apm.yml still references it)

  ? What to do?
    > Drop it from apm.yml (recommended)
      Keep in apm.yml (will warn on each update)
```

### Re-running init vs. update

| Situation | Command |
|---|---|
| First time setting up agent-kit in a repo | `agent-kit init` |
| Catch up to latest kit | `agent-kit update` |
| Change preset, agent list, or scope | `agent-kit init` (overwrites; reads `.agent-kit.yaml` to pre-fill prior choices) |
| Adopt every new primitive automatically | `agent-kit update --adopt-preset-defaults` |
| Just refresh content, no new primitives | `agent-kit update --content-only` |

`agent-kit init` re-reads `.agent-kit.yaml` if present and uses the prior values as defaults — so re-running it isn't a complete restart, just an interactive change-of-mind.

## 5. Preset format

```yaml
# presets/personal.yaml
name: personal
description: Generic AI coding kit — language-agnostic rules + universal slash commands
default_agents: [claude, codex]   # pre-checked in Step 3

primitives:
  instructions:
    - core
    - typescript
  prompts:
    - my-commit
    - my-commit-and-push
    - my-create-pr
    - my-fix-build
    - my-explain
    - my-clean-code
  skills: []
  mcp: []
  hooks: []

apm_dependencies: []   # external APM packages to also pull in (none for personal MVP)
```

```yaml
# presets/microsoft.yaml
name: microsoft
description: Personal kit + Microsoft-specific (ODSP/Rush/SharePoint)
extends: personal      # MVP: implemented as a literal copy + additions; factor out later
default_agents: [claude, codex]

primitives:
  instructions:
    - ms-rush
    - ms-sharepoint
  skills:
    - graduate-killswitches
```

**MVP note:** `extends:` is implemented at v0.1 as "copy the parent preset's primitives, then merge". No deep inheritance graph. If complexity grows, revisit.

### Per-primitive `added_in` (used by `agent-kit update`)

Each primitive declares the kit version where it was first introduced. Set when the primitive lands in the kit; never edited afterward. Used by Section 4b's update-flow delta detection.

```yaml
---
description: React conventions
applyTo: "**/*.{tsx,jsx}"
added_in: 0.2.0
---
```

If `added_in` is missing on a primitive, the wizard treats it as `0.0.0` (i.e., always existed) — safe default that keeps old kits compatible.

## 6. Per-agent deployment matrix

This is the truth table the wizard implements:

| Agent | Repo-scoped target | Global target | Notes |
|---|---|---|---|
| **Claude Code** | `.claude/rules/*.md`, `.claude/commands/*.md` | `~/.claude/rules/*.md`, `~/.claude/commands/*.md` | APM native both ways |
| **Codex** | `./AGENTS.md` (APM-compiled at repo root); optional `./AGENTS.override.md` (gitignored personal layer) | `~/.codex/AGENTS.md` (wizard copies from `~/.apm/AGENTS.md`) | Requires `apm compile` step. Global needs wizard's manual copy. |

Both supported agents work in both scopes; no refusal logic needed in v0.1.

### Per-agent install procedure (deploy.js logic — used by both `init` and `update`)

For each selected agent at the selected scope:

1. Always: ensure `apm.yml` lists the right deps and `targets:`.
2. Run `apm install` (workspace) or `apm install -g` (global). **Use `--force`** so re-runs overwrite previously-deployed APM-managed files. APM otherwise refuses to overwrite "locally-authored" files (observed in spike: 6 prompts skipped when `~/.claude/commands/` already had files from `sync-claude.sh`). Files outside APM's managed set (user's hand-written rules) are unaffected by `--force`. For `update`, also pass `--update` to re-resolve to latest Git refs.
3. Run `apm compile -t <comma-separated agents>` — needed for Codex/Gemini, harmless for others.
4. **Codex global only:** copy `~/.apm/AGENTS.md` → `~/.codex/AGENTS.md`. (`apm compile` doesn't auto-place it.)
5. **Codex personal layer (opt-in via Step 4b):** write `AGENTS.override.md` with the selected primitives' instructions concatenated, and add to `.gitignore`.
6. Write/refresh `.agent-kit.yaml` state file with kit version, preset, agents, scope, and primitives snapshot.
7. Run verification (Section 10) and summarize.

## 7. Tech stack & invocation

- **Wizard runtime:** Node 20+
- **Prompts library:** `@clack/prompts` (best-in-class TUI)
- **YAML parsing:** `yaml` package
- **Subprocess to APM:** `node:child_process` (`spawnSync`)
- **No bundler** — plain `node lib/wizard.js`

### Bootstrap (one-time, on any machine)

```bash
git clone git@github.com:superliaye/my-agent-kits.git ~/my-agent-kits
cd ~/my-agent-kits && bash bootstrap.sh
```

`bootstrap.sh` does exactly two things:

1. `npm install --prefix ~/my-agent-kits` (installs `@clack/prompts` + `yaml`)
2. Symlinks `~/my-agent-kits/bin/agent-kit` into `~/.local/bin/agent-kit` (or appends a PATH line if `~/.local/bin` isn't on PATH).

### `bin/agent-kit` (the launcher)

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
exec node "$DIR/lib/wizard.js" "$@"
```

### Update flow

```bash
cd ~/my-agent-kits && git pull && npm install
# Or wrap as: agent-kit update
```

## 8. MVP scope

### In MVP (v0.1)

- `agent-kit init` interactive — 5-step wizard, generates `apm.yml`, runs `apm install` + `apm compile`, performs post-steps (Codex global copy, optional `AGENTS.override.md`), writes `.agent-kit.yaml` state file.
- `agent-kit init --preset ... --agents ... --scope ... --yes` non-interactive equivalent.
- `agent-kit update` — Section 4b's 3-step update flow: refresh content, prompt for new primitives, handle removed ones. Includes flags: `--content-only`, `--adopt-preset-defaults`, `--dry-run`.
- 3 presets: `personal`, `microsoft`, `minimal`.
- 2 agent targets: Claude Code, Codex CLI.
- Primitive types: instructions, prompts, skills. (MCP and hooks: directory exists but empty for MVP.)
- Per-primitive `added_in` frontmatter for delta detection.
- Bootstrap script with PATH setup.
- Primitives folded in from `personal-agent-kit` (with `description` + `applyTo` + `added_in: 0.1.0` frontmatter added).
- `agent-kit test` shortcut delegating to `bash test/run-tests.sh`.

### Deferred (v0.2+)

- **Additional agent targets:** Copilot CLI, Cursor, Windsurf, Gemini, OpenCode. Adding any of these brings back the global-scope refusal logic (Copilot/Cursor are workspace-only by agent design).
- `agent-kit list` — show what's installed in cwd.
- `agent-kit add <primitive>` — quick add without re-running the full wizard.
- MCP server primitives + the wizard step to pick them.
- Hooks primitives (lifecycle scripts).
- Real preset inheritance graph (replace MVP's literal-copy `extends:`).
- "Doctor" command to detect and repair broken state.

### Explicitly out of scope

- Replacing APM (the wizard is a wrapper; we delegate everything we can).
- Cross-repo sync of customization choices (each repo is independent).
- A registry / marketplace for presets (presets are local to this repo).
- Live-invocation smoke tests against agents (verification is file-existence + content-hash; live agent calls are manual).
- A GUI (this is a CLI-only tool).

## 9. Test matrix

Following the dotfiles `Dockerfile.test` pattern, but specific to APM-deploy verification.

### Init matrix (every supported agent × every scope, each test covers all valid primitive types)

| # | Agent | Scope | Primitives covered | Asserts |
|---|---|---|---|---|
| 1 | Claude | repo | instructions, prompts, skills | files at `.claude/rules/`, `.claude/commands/`, `.claude/skills/`; content matches source (sha256) |
| 2 | Claude | global | instructions, prompts, skills | same paths under `~/.claude/` |
| 3 | Codex | repo | instructions (concat into AGENTS.md) | `./AGENTS.md` exists + has source-comment markers; size < 32 KiB |
| 4 | Codex | global | instructions concat | `~/.codex/AGENTS.md` exists (after wizard's copy step from `~/.apm/AGENTS.md`); content matches `~/.apm/AGENTS.md` |

### Update tests

Use a synthetic kit at version `0.1.0` then bump it to `0.2.0` with one added + one content-changed primitive.

| # | Scenario | Expected |
|---|---|---|
| 5 | `agent-kit update --content-only` after init at v0.1.0 against a v0.2.0 kit | Refreshed content matches v0.2.0 sources; `apm.yml` primitive list unchanged; `.agent-kit.yaml` `kit_version_at_last_run` bumps to `0.2.0`. No interactive prompt invoked. |
| 6 | `agent-kit update --adopt-preset-defaults` after init at v0.1.0 against a v0.2.0 kit (with one new primitive added to the preset) | New primitive auto-adopted into `apm.yml`; deployment includes it; `.agent-kit.yaml` reflects updated primitives snapshot. No prompt. |

**6 test cases total.**

The interactive Step 2 prompt path (selectively adopting some new primitives) is covered manually rather than in CI — driving an interactive multi-select via stdin is brittle, and the underlying delta-detection logic is exercised by case #6.

No negative tests in v0.1: with only Claude and Codex supported, every `(agent, scope)` combo is valid. When v0.2 adds Copilot/Cursor, restore the refused-global negative tests.

### Test runner architecture

- One Docker image (`Dockerfile.test`) provides apm + node + git + the wizard repo, isolated `$HOME`.
- `test/run-tests.sh` is the entrypoint. Iterates `cases/*.sh`, runs each, aggregates pass/fail.
- Each case script:
  1. Creates a fresh empty git repo at `/tmp/case-N/`.
  2. Runs `agent-kit init --preset personal --agents <X> --scope <Y> --yes`.
  3. Calls `assert_file_exists`, `assert_content_contains`, `assert_sha256` from `lib/assertions.sh`.
  4. Exits non-zero on any failure.
- `run-tests.sh` prints a summary like dotfiles' tests:
  ```
  [1] claude-repo
    [pass] instructions deployed
    [pass] prompts deployed
  ...
  Results: 6 passed, 0 failed
  ```
- CI: GitHub Action runs `bash test/run-tests.sh` on every PR.
- Local quick-run: `agent-kit test` (or just `bash test/run-tests.sh`).

### What the matrix does NOT cover

- Real agent invocations (e.g., starting `claude` and asking it to use `/my-commit`). That's a manual smoke test post-install.
- Multi-preset combinations beyond `personal` (covered indirectly because `microsoft` is a superset).
- Persistence across re-runs (idempotency) — flagged as a follow-up test if drift becomes a problem.

## 10. Verify step semantics (Step 5 of wizard)

For each `(agent, primitive_type)` pair the wizard touched, in order:

1. **File existence:** verify expected paths exist.
2. **Content sanity:** non-empty; for compiled outputs (`AGENTS.md`), verify the build-ID HTML comment is present.
3. **Codex specific:** print `% of 32 KiB cap used` so user knows when they're getting close.
4. **Summary table** in the format shown in Section 4 Step 5.
5. **Per-agent test hint** — one-line invocation suggestion the user can run to confirm the agent picks up the deployment (e.g., `claude --print "/my-commit --help"`).

If any step fails, exit non-zero and print the specific gap. Don't claim success.

## 11. Migration path

| Asset | Fate |
|---|---|
| **superliaye/dotfiles** | Keep. Shell aliases stay (out of scope for AI tooling). `sync-claude.sh` keeps working until you cut over to `agent-kit` everywhere — then slim it down to just the plugin install (superpowers, ECC). |
| **superliaye/personal-agent-kit** | Fold its primitives into `my-agent-kits/primitives/` with `description` + `applyTo` frontmatter added. Archive the GitHub repo with a README pointing at `my-agent-kits`. Don't delete (preserves history). |
| **Existing `~/.claude/` content** | Untouched on first `agent-kit init`. After the wizard works in real workflows, optionally `rm -rf ~/.claude/{commands,rules,CLAUDE.md}` and re-run with `--scope global` to land cleanly. |
| **APM CLI** | Already installed via scoop (v0.12.4). `bootstrap.sh` checks for it and prints install hint if missing; doesn't auto-install. |

## 12. Risks & open items

| Risk | Mitigation |
|---|---|
| APM is brand-new (v0.12.4); behavior may change | Pin `apm` version in `bootstrap.sh` requirements; document tested version in `CLAUDE.md`. |
| Codex global copy step is fragile if APM changes its compile output location | Re-test on every APM version bump; consider replacing with a direct AGENTS.md write if APM behavior is unstable. |
| `applyTo` semantics for Codex specifically: Codex's runtime is purely concat-and-feed, so `applyTo` is effectively advisory for Codex. | Document in `CLAUDE.md`; rely on Codex's 32 KiB cap for runtime behavior. (When Copilot is added in v0.2, `applyTo` becomes load-bearing for it.) |
| Personal-agent-kit primitives lack `description` + `applyTo` frontmatter | First implementation task: add frontmatter to every primitive before tests can pass. |
| Private repo means bootstrap requires GitHub auth on every machine | Document SSH-key prerequisite in README; `bootstrap.sh` prints clear error if auth fails. |
| Hooks and MCP primitive types are placeholders in MVP | Reserve directories now; add primitives + wizard prompts in v0.2. |
| Adding Copilot/Cursor in v0.2 reintroduces the global-scope refusal logic | Build wizard with the decision-path already structured (per-agent capability table) so adding agents is config, not code restructure. |

## 13. Implementation order (next: writing-plans skill)

Suggested high-level sequencing for the implementation plan:

1. Add `description` + `applyTo` + `added_in: 0.1.0` frontmatter to `personal-agent-kit` primitives (preparatory).
2. Create `my-agent-kits` repo skeleton with the directory layout from Section 3.
3. Move `personal-agent-kit` primitives into `my-agent-kits/primitives/`.
4. Author `presets/personal.yaml`, `presets/microsoft.yaml`, `presets/minimal.yaml`, `presets/none.yaml`.
5. Implement `lib/` modules in order: `presets.js` → `primitives.js` → `state.js` (read/write `.agent-kit.yaml`) → `apm-writer.js` → `agents.js` → `deploy.js` → `verify.js` → `init.js` → `update.js` (delta detection) → `wizard.js` (entrypoint dispatcher).
6. Implement `bootstrap.sh` and `bin/agent-kit`.
7. Build out `test/Dockerfile.test`, `test/run-tests.sh`, and `cases/*.sh` per Section 9 (6 cases — 4 init happy paths for Claude/Codex × repo/global, 2 update tests).
8. Run the matrix; iterate until 6/6 green.
9. Archive `personal-agent-kit` on GitHub with redirect README.
10. Document in root `README.md` + `CLAUDE.md`.

## Appendix A — Why these decisions, in one paragraph

We picked a wrapper-on-APM mono-repo because rewriting APM is a year of work for diminishing returns; APM does deploy + lockfile + auth + per-agent format conversion well enough that the only missing pieces are (a) interactive UX, (b) presets, (c) a few specific gap-plugs (Codex global copy, `AGENTS.override.md`). A private mono-repo is the simplest visibility model — public/private split inside the kit creates more friction than it saves. Node + clack is the polish-vs-effort sweet spot for personal tooling. Narrowing v0.1 to Claude Code + Codex CLI was the late simplification: both fully support repo-scoped AND global instructions, so the matrix shrinks to 4 init combos + 2 update tests = 6 cases — no negative tests needed. The architecture leaves room to add Copilot/Cursor/Windsurf in v0.2 by extending the per-agent capability table, at which point the global-scope refusal logic returns.
