# my-agent-kits

Personal AI agent artifact wizard for Claude Code and Codex CLI. Bootstrap or update any repo's agent setup with one command.

## Install (one time per machine)

```bash
git clone git@github.com:superliaye/my-agent-kits.git ~/my-agent-kits
cd ~/my-agent-kits && bash bootstrap.sh
```

Requires Node 20+ and Git. No APM CLI dependency.

## Usage

```bash
cd ~/work/some-repo
agent-kit init        # interactive 5-step wizard
agent-kit update      # catch up to latest kit
agent-kit help
```

### One-shot install (each flag is one decision)

Passing `--preset`, `--agents`, and `--scope` together is enough — the wizard treats it as "you've decided" and skips all prompts:

```bash
agent-kit init --preset engineering --agents claude --scope repo --claude-md overwrite
```

That writes `CLAUDE.md` (overwriting any existing one) and `.claude/skills/` in the current repo. No `apm.yml`, no `apm_modules/`.

Common variations — change exactly the flag(s) that differ:

```bash
agent-kit init --preset engineering --agents claude,codex --scope repo --claude-md overwrite  # Codex too
agent-kit init --preset engineering --agents claude --scope global --claude-md overwrite      # install globally to ~/.claude/
agent-kit init --preset engineering --agents claude --scope repo --claude-md concat           # preserve existing CLAUDE.md
agent-kit init --preset minimal --agents claude --scope repo --claude-md overwrite            # just core rules, no skills
```

Flag reference:

- `--preset {engineering|microsoft|minimal|none}` — bundle of primitives
- `--agents claude[,codex]` — which agents to deploy to
- `--scope {repo|global}` — repo-local or `~/.claude/` (and `~/.codex/`)
- `--claude-md {overwrite|concat|skip}` — what to do if a `CLAUDE.md` already exists
- `--codex-personal-layer` — write a gitignored `AGENTS.override.md` (Codex repo scope only)
- `--primitives '+name,-name'` — tweak the preset's primitive set on the fly

Updating:

```bash
agent-kit update                          # interactive — pick which new primitives to adopt
agent-kit update --content-only           # refresh content only (no new primitives)
agent-kit update --adopt-preset-defaults  # auto-adopt new preset members
```

## What's in here

| Path | Purpose |
|---|---|
| `presets/*.yaml` | Bundled artifact selections (`engineering`, `microsoft`, `minimal`, `none`) |
| `.apm/instructions/*.instructions.md` | Always-loaded rules (concatenated into CLAUDE.md / AGENTS.md at deploy) |
| `.apm/skills/<name>/SKILL.md` | Reusable workflows — slash commands and multi-step skills. Authored in Claude format with `disable-model-invocation: true` for manual-only. |
| `.apm/plugins/*.plugin.md` | Claude Code plugin pointers (e.g., superpowers) |
| `bin/agent-kit` | Launcher (symlinked to `~/.local/bin/`) |
| `lib/wizard.js` + `lib/*.js` | Wizard implementation (Node 20+) |
| `test/` | Docker-based test matrix |

## What lands in a consumer repo

After `agent-kit init` in `~/work/some-repo`:

```text
some-repo/
├── CLAUDE.md           # concatenated instructions (Claude Code reads this)
├── AGENTS.md           # concatenated instructions for Codex (if --agents codex)
├── .claude/skills/     # Claude Code reads skills here
├── .agents/skills/     # cross-client skills (Codex sidecar reads here)
└── .agent-kit.yaml     # wizard state — what was deployed, for `agent-kit update`
```

That's it. No `apm.yml`, no `apm_modules/`, no per-rule `.claude/rules/*.md` files. Everything in the repo is something an agent actually reads at runtime.

## Tests

```bash
docker build -q -f test/Dockerfile.test -t my-agent-kits-test .
docker run --rm my-agent-kits-test
```

Expected: `Results: 8 cases passed, 0 cases failed`.

## Spec & Plan

- Design spec: [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-08-agent-kit-installer.md`](docs/superpowers/plans/2026-05-08-agent-kit-installer.md)
