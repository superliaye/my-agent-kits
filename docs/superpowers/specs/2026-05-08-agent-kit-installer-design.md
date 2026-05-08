# agent-kit-installer (`my-agent-kits`) — Design Spec

**Date:** 2026-05-08
**Status:** Approved for implementation planning
**Author:** Leon YE (with Claude as brainstorming partner)

## 1. Problem statement

Deploying personal AI agent artifacts (instructions, slash-command prompts, skills, MCP server configs) across multiple coding agents — Claude Code, GitHub Copilot, Codex CLI, Cursor — in a new repo or new machine is currently:

- **Manual** — every repo needs hand-edited `.github/copilot-instructions.md`, `AGENTS.md`, `.cursor/rules/`, etc.
- **Repetitive** — same primitives copy-pasted across many work and personal repos.
- **Error-prone** — APM has agent-specific gaps (e.g., Codex global deploy compiles to `~/.apm/AGENTS.md` not `~/.codex/AGENTS.md`); user must remember which extra steps to run.
- **Non-interactive** — APM assumes the user already knows which preset, agents, and primitives they want.

Existing partial solutions:
- `superliaye/dotfiles` + `sync-claude.sh` — works for Claude Code only.
- `superliaye/personal-agent-kit` (APM package) — works at user scope for Claude only; partially or not at all for Copilot, Codex at user scope.

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
| Step 4 unsupported-agent behavior | Refuse with clear error | Strictest. No partial state. User chooses repo-scoped or deselects unsupported agents. |
| Personal layer in team repos | Write `AGENTS.override.md` + `.gitignore` (Codex); analogous patterns documented per agent | Codex's documented mechanism for personal-on-top-of-team. |

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
    │   ├── copilot-repo.sh
    │   ├── codex-repo.sh
    │   ├── codex-global.sh
    │   ├── cursor-repo.sh
    │   └── refused-combos.sh        # negative tests
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
  [x] GitHub Copilot
  [x] Codex CLI
  [ ] Cursor
```

### Step 4/5 — Single-select install scope

```
? Where should these primitives live?:
  > Repo-scoped     written into this repo (.github/, AGENTS.md, .cursor/, .claude/...)
                    works reliably for ALL selected agents
    Global          written to ~/.claude/, ~/.codex/...
                    works reliably for: Claude, Codex
                    NOT supported by: Copilot, Cursor (agent design)
                    Wizard refuses if any unsupported agent is selected.
```

If the user picks **Global** with Copilot or Cursor selected, the wizard prints:

```
[!] Global scope is not supported by Copilot/Cursor (agent limitation).
    Either:
      - Pick repo-scoped, or
      - Deselect Copilot and Cursor, then re-confirm.
```

…and returns to Step 3 or 4. No partial deployment.

### Step 5/5 — Apply + verify

```
✓ Wrote apm.yml (3 deps, 3 targets)
✓ Ran apm install
✓ Ran apm compile -t claude,copilot,codex
✓ For Codex global: copied ~/.apm/AGENTS.md → ~/.codex/AGENTS.md  (skipped: not global)
✓ Wrote AGENTS.override.md and added to .gitignore (personal layer for Codex, opt-in)

Verification:
  Claude Code         ~/.claude/commands/        6 files OK
                      ~/.claude/rules/           2 files OK
  GitHub Copilot      .github/copilot-instructions.md       OK (1.2 KiB)
                      .github/prompts/           6 files OK
  Codex CLI           AGENTS.md                  OK (1.6 KiB, 5% of 32 KiB cap)
                      AGENTS.override.md         OK, gitignored

All deployments verified. Run /my-commit (Claude) or `gh copilot suggest`/`codex` to test.
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

## 5. Preset format

```yaml
# presets/personal.yaml
name: personal
description: Generic AI coding kit — language-agnostic rules + universal slash commands
default_agents: [claude, copilot, codex]   # pre-checked in Step 3

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
default_agents: [claude, copilot]

primitives:
  instructions:
    - ms-rush
    - ms-sharepoint
  skills:
    - graduate-killswitches
```

**MVP note:** `extends:` is implemented at v0.1 as "copy the parent preset's primitives, then merge". No deep inheritance graph. If complexity grows, revisit.

## 6. Per-agent deployment matrix

This is the truth table the wizard implements:

| Agent | Repo-scoped target | Global target | Notes |
|---|---|---|---|
| **Claude Code** | `.claude/rules/*.md`, `.claude/commands/*.md` | `~/.claude/rules/*.md`, `~/.claude/commands/*.md` | APM native both ways |
| **Copilot** | `.github/copilot-instructions.md` (single concat file), `.github/prompts/*.prompt.md` | ❌ refuse | Workspace-only by agent design |
| **Codex** | `./AGENTS.md` (APM-compiled at repo root); optional `./AGENTS.override.md` (gitignored personal layer) | `~/.codex/AGENTS.md` (wizard copies from `~/.apm/AGENTS.md`) | Requires `apm compile` step. Global needs wizard's manual copy. |
| **Cursor** | `.cursor/rules/*.mdc` | ❌ refuse | Workspace-only by agent design |

### Per-agent install procedure (deploy.js logic)

For each selected agent at the selected scope:

1. Always: ensure `apm.yml` lists the right deps and `targets:`.
2. Run `apm install` (workspace) or `apm install -g` (global).
3. Run `apm compile -t <comma-separated agents>` — needed for Codex/Gemini, harmless for others.
4. **Codex global only:** copy `~/.apm/AGENTS.md` → `~/.codex/AGENTS.md`. (`apm compile` doesn't auto-place it.)
5. **Codex personal layer (opt-in):** if user opted in during Step 5, write `AGENTS.override.md` with the personal preset's instructions concatenated, and add to `.gitignore`.
6. Run verification (Section 10) and summarize.

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

- `agent-kit init` interactive — 5-step wizard, generates `apm.yml`, runs `apm install` + `apm compile`, performs post-steps (Codex global copy, optional `AGENTS.override.md`).
- `agent-kit init --preset ... --agents ... --scope ... --yes` non-interactive equivalent.
- 3 presets: `personal`, `microsoft`, `minimal`.
- 4 agent targets: Claude Code, Copilot, Codex CLI, Cursor.
- Primitive types: instructions, prompts, skills. (MCP and hooks: directory exists but empty for MVP.)
- Bootstrap script with PATH setup.
- Primitives folded in from `personal-agent-kit` (with `description` + `applyTo` frontmatter added).
- `agent-kit test` shortcut delegating to `bash test/run-tests.sh`.

### Deferred (v0.2+)

- `agent-kit update` — pull new primitives in already-initialized repos.
- `agent-kit list` — show what's installed in cwd.
- `agent-kit add <primitive>` — quick add without re-running the full wizard.
- MCP server primitives + the wizard step to pick them.
- Hooks primitives (lifecycle scripts).
- Windsurf / Gemini / OpenCode targets.
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

### Reduced matrix (X×Y, each test covers all valid primitive types for that agent×scope)

| # | Agent | Scope | Primitives covered | Asserts |
|---|---|---|---|---|
| 1 | Claude | repo | instructions, prompts, skills | files at `.claude/rules/`, `.claude/commands/`, `.claude/skills/`; content matches source (sha256) |
| 2 | Claude | global | instructions, prompts, skills | same paths under `~/.claude/` |
| 3 | Copilot | repo | instructions, prompts | `.github/copilot-instructions.md` exists + non-empty; `.github/prompts/*.prompt.md` present |
| 4 | Codex | repo | instructions (concat into AGENTS.md) | `./AGENTS.md` exists + has source-comment markers; size < 32 KiB |
| 5 | Codex | global | instructions concat | `~/.codex/AGENTS.md` exists (after wizard's copy step from `~/.apm/AGENTS.md`); content matches `~/.apm/AGENTS.md` |
| 6 | Cursor | repo | instructions only | `.cursor/rules/*.mdc` exist with proper frontmatter |

**Plus 2 negative tests:**

| # | Scenario | Expected |
|---|---|---|
| 7 | `--agents copilot --scope global` | Wizard exits non-zero with message containing "Global scope is not supported by Copilot" |
| 8 | `--agents cursor --scope global` | Wizard exits non-zero with similar message |

**8 test cases total.**

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
  Results: 8 passed, 0 failed
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
2. **Content sanity:** non-empty; for compiled outputs (`AGENTS.md`, `copilot-instructions.md`), verify the build-ID HTML comment is present.
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
| `applyTo` semantics differ across agents (VS Code Copilot uses it dynamically; Codex effectively ignores it post-concat) | Document per-agent semantics in `CLAUDE.md`; treat `applyTo` as advisory; rely on Codex's 32 KiB cap for runtime behavior. |
| Personal-agent-kit primitives lack `description` + `applyTo` frontmatter | First implementation task: add frontmatter to every primitive before tests can pass. |
| Private repo means bootstrap requires GitHub auth on every machine | Document SSH-key prerequisite in README; `bootstrap.sh` prints clear error if auth fails. |
| Copilot CLI's `.github/prompts/` is workspace-only AND requires VS Code 1.95+ | Document in README; tests assert file presence only, not agent recognition. |
| Hooks and MCP primitive types are placeholders in MVP | Reserve directories now; add primitives + wizard prompts in v0.2. |

## 13. Implementation order (next: writing-plans skill)

Suggested high-level sequencing for the implementation plan:

1. Add `description` + `applyTo` frontmatter to `personal-agent-kit` primitives (preparatory).
2. Create `my-agent-kits` repo skeleton with the directory layout from Section 3.
3. Move `personal-agent-kit` primitives into `my-agent-kits/primitives/`.
4. Author `presets/personal.yaml`, `presets/microsoft.yaml`, `presets/minimal.yaml`, `presets/none.yaml`.
5. Implement `lib/` modules in order: `presets.js` → `primitives.js` → `apm-writer.js` → `agents.js` → `deploy.js` → `verify.js` → `wizard.js`.
6. Implement `bootstrap.sh` and `bin/agent-kit`.
7. Build out `test/Dockerfile.test`, `test/run-tests.sh`, and `cases/*.sh` per Section 9.
8. Run the matrix; iterate until 8/8 green.
9. Archive `personal-agent-kit` on GitHub with redirect README.
10. Document in root `README.md` + `CLAUDE.md`.

## Appendix A — Why these decisions, in one paragraph

We picked a wrapper-on-APM mono-repo because rewriting APM is a year of work for diminishing returns; APM does deploy + lockfile + auth + per-agent format conversion well enough that the only missing pieces are (a) interactive UX, (b) presets, (c) a few specific gap-plugs (Codex global copy, `AGENTS.override.md`). A private mono-repo is the simplest visibility model — public/private split inside the kit creates more friction than it saves. Node + clack is the polish-vs-effort sweet spot for personal tooling. Strict refusal of unsupported scope/agent combos is the pragmatic choice when reliability is non-negotiable; "auto-fallback" sounds friendly but hides what actually got installed.
