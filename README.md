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
./bin/agent-kit init --default               # install recommended defaults
./bin/agent-kit init ~/work/some-repo        # interactive 5-step wizard
./bin/agent-kit update ~/work/some-repo      # catch up to latest kit
./bin/agent-kit help
```

If you omit the target argument, the wizard deploys into the current directory — convenient when invoking via the absolute path from inside the consumer repo:

```bash
cd ~/work/some-repo
~/my-agent-kits/bin/agent-kit init
```

To skip every prompt and install the recommended defaults (the pre-checked presets and the preset's agents), pass `--default` — the "enter through everything" path. Explicit flags still override individual defaults:

```bash
./bin/agent-kit init ~/work/some-repo --default                       # zero prompts, all defaults
./bin/agent-kit init ~/work/some-repo --default --preset productivity # defaults, but a different preset
```

### One-shot install (each flag is one decision)

Passing `--preset` and `--agents` together is enough — the wizard treats it as "you've decided" and skips all prompts:

```bash
./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude
```

That concatenates the instructions inline into `~/.claude/CLAUDE.md` and (with `--agents codex`) `~/.codex/AGENTS.md`, and copies skills to `~/.claude/skills/` and `~/.agents/skills/`. No `apm.yml`, no `apm_modules/`.

Common variations — change exactly the flag(s) that differ:

```bash
./bin/agent-kit init ~/work/some-repo --preset engineering --agents claude,codex  # Codex too
./bin/agent-kit init ~/work/some-repo --preset productivity --agents claude        # core + grill-me + hyperframes video
```

Flag reference:

- `--default` — accept every wizard default (pre-checked presets and the preset's agents) and apply without prompting; explicit flags still override individual defaults
- `--preset NAME[,NAME2]` — one or more of `{engineering, productivity, financial, none}`. Comma-separated names merge primitives (union, deduped per type); interactive form uses a multiselect prompt
- `--agents claude[,codex]` — which agents to deploy to
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
| `presets/*.yaml` | Bundled artifact selections (`engineering`, `productivity`, `none`). Multi-select via `--preset a,b` |
| `.apm/instructions/*.instructions.md` | Always-loaded rules, concatenated at deploy into `~/.claude/CLAUDE.md` (inline) and `~/.codex/AGENTS.md` |
| `.apm/skills/<name>/SKILL.md` | Reusable workflows — slash commands and multi-step skills. Authored in Claude format with `disable-model-invocation: true` for manual-only. |
| `.apm/plugins/*.plugin.md` | Claude Code plugin pointers (e.g., superpowers) |
| `.apm/bundles/*.bundle.md` | External installers wrapped as deployable primitives (e.g., gstack — 30+ `/gstack-*` skills; hyperframes — HTML video rendering). Two `installer.kind` flavors: `setup-script` (clone + run) and `npx-skills` (`npx skills add <pkg>`). Always installed globally; common runtime deps auto-installed by the wizard. See [docs/maintaining-bundles.md](docs/maintaining-bundles.md). |
| `bin/agent-kit` | Launcher — invoke as `./bin/agent-kit` from the kit dir, or via absolute path from anywhere |
| `lib/wizard.js` + `lib/*.js` | Wizard implementation (Node 20+) |
| `test/` | Docker-based test matrix |

## What lands where

`agent-kit init ~/work/some-repo` writes the artifacts to your global agent
directories — not into the target repo. The only repo-local file is the wizard
state:

```text
~/.claude/CLAUDE.md     # instructions concatenated inline (overwritten each run)
~/.claude/skills/       # Claude Code reads skills here
~/.codex/AGENTS.md      # instructions concatenated inline (if --agents codex)
~/.agents/skills/       # cross-client skills (Codex sidecar reads here; if --agents codex)

some-repo/
└── .agent-kit.yaml     # wizard state — what was deployed, for `agent-kit update`
```

That's it. No `apm.yml`, no `apm_modules/`, no per-rule `.claude/rules/*.md` files, and no instructions or skills copied into the repo itself.

## Tests

Default — isolated Docker run (Unix-only validation, doesn't touch your host's `~/.claude/` or `~/.codex/`):

```bash
npm test
# equivalent to: docker build -q -f test/Dockerfile.test -t my-agent-kits-test . && docker run --rm my-agent-kits-test
```

Opt-in — run the suite on this machine (faster inner loop, but cases overwrite your real `~/.claude/CLAUDE.md` / `~/.codex/AGENTS.md` and may delete `~/.claude/plugins/`):

```bash
npm run test:host
# or via the CLI:
./bin/agent-kit test --host
```

Host mode is gated behind `AGENT_KIT_TEST_HOST=1` so direct `bash test/run-tests.sh` runs refuse without the env var; use the npm script or the `--host` flag.

## Spec & Plan

- Design spec: [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-08-agent-kit-installer.md`](docs/superpowers/plans/2026-05-08-agent-kit-installer.md)
