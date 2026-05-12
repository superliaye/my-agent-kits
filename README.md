# my-agent-kits

Personal AI agent artifact wizard for Claude Code and Codex CLI. Bootstrap or update any repo's agent setup with one command.

## Install (one time per machine)

```bash
git clone https://github.com/superliaye/my-agent-kits.git ~/my-agent-kits
cd ~/my-agent-kits
bash bootstrap.sh
```

Requires Node 20+ and Git. No APM CLI dependency. `bootstrap.sh` only installs Node deps — it does **not** touch your PATH or shell rc files.

## Usage

Stay in `~/my-agent-kits` and invoke the launcher with the target repo as the first argument:

```bash
cd ~/my-agent-kits
./bin/agent-kit init ~/work/some-repo        # interactive 5-step wizard
./bin/agent-kit update ~/work/some-repo      # catch up to latest kit
./bin/agent-kit help
```

If you omit the target argument, the wizard deploys into the current directory — convenient when invoking via the absolute path from inside the consumer repo:

```bash
cd ~/work/some-repo
~/my-agent-kits/bin/agent-kit init
```

### One-shot install (each flag is one decision)

Passing `--preset`, `--agents`, and `--scope` together is enough — the wizard treats it as "you've decided" and skips all prompts:

```bash
./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude --scope repo --claude-md overwrite
```

That writes `CLAUDE.md` (overwriting any existing one) and `.claude/skills/` in the target repo. No `apm.yml`, no `apm_modules/`.

Common variations — change exactly the flag(s) that differ:

```bash
./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude,codex --scope repo --claude-md overwrite  # Codex too
./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude --scope global --claude-md overwrite      # install globally to ~/.claude/
./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude --scope repo --claude-md concat           # preserve existing CLAUDE.md
./bin/agent-kit init ~/work/some-repo --preset minimal --agents claude --scope repo --claude-md overwrite            # just core rules, no skills
```

Flag reference:

- `--preset {engineering|microsoft|minimal|none}` — bundle of primitives
- `--agents claude[,codex]` — which agents to deploy to
- `--scope {repo|global}` — repo-local or `~/.claude/` (and `~/.codex/`)
- `--claude-md {overwrite|concat|skip}` — what to do if a `CLAUDE.md` already exists
- `--codex-personal-layer` — write a gitignored `AGENTS.override.md` (Codex repo scope only)
- `--primitives '+name,-name'` — tweak the preset's primitive set on the fly
- `--bundles name1,name2` — external installers (e.g. `gstack`) to run after primitives deploy. Always install globally. Pass `--bundles ''` to skip all.

Updating:

```bash
./bin/agent-kit update ~/work/some-repo                          # interactive — pick which new primitives to adopt
./bin/agent-kit update ~/work/some-repo --content-only           # refresh content only (no new primitives)
./bin/agent-kit update ~/work/some-repo --adopt-preset-defaults  # auto-adopt new preset members
```

## What's in here

| Path | Purpose |
|---|---|
| `presets/*.yaml` | Bundled artifact selections (`engineering`, `microsoft`, `minimal`, `none`) |
| `.apm/instructions/*.instructions.md` | Always-loaded rules (concatenated into CLAUDE.md / AGENTS.md at deploy) |
| `.apm/skills/<name>/SKILL.md` | Reusable workflows — slash commands and multi-step skills. Authored in Claude format with `disable-model-invocation: true` for manual-only. |
| `.apm/plugins/*.plugin.md` | Claude Code plugin pointers (e.g., superpowers) |
| `.apm/bundles/*.bundle.md` | External installers wrapped as deployable primitives (e.g., gstack — 30+ `/gstack-*` skills). Always installed globally; runtime deps auto-installed by the wizard. See [docs/maintaining-bundles.md](docs/maintaining-bundles.md). |
| `bin/agent-kit` | Launcher — invoke as `./bin/agent-kit` from the kit dir, or via absolute path from anywhere |
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
