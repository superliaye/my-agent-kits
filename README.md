# my-agent-kits

Personal AI agent artifact wizard for Claude Code and Codex CLI. Bootstrap or update any repo's agent setup with one command.

## Quick start

```bash
git clone https://github.com/superliaye/my-agent-kits.git ~/my-agent-kits
cd ~/my-agent-kits
npm run init-default
```

`npm run init-default` installs Node deps and then deploys the recommended defaults (the pre-checked presets and the preset's agents) to your global agent directories — no prompts. Requires Node 20+ and Git. It does **not** touch your PATH or shell rc files; nothing lands in any repo.

Want to choose presets and agents yourself? Run `npm run init` for the interactive wizard, or see [Usage](#usage) for the one-shot flag form.

## Usage

Invoke the Node entrypoint from the kit directory — this works identically in PowerShell, cmd, and bash. Every run deploys to your global agent directories, never into a repo:

```text
cd ~/my-agent-kits
node lib/wizard.js init --default   # install recommended defaults, no prompts
node lib/wizard.js init             # interactive 5-step wizard
node lib/wizard.js update           # interactively adjust the installed selection
node lib/wizard.js update --current # replay the installed selection without prompts
node lib/wizard.js help
```

You can also invoke it by absolute path from anywhere:

```text
node ~/my-agent-kits/lib/wizard.js init
```

Bash/macOS/Linux users have a shorter convenience alias for the same thing: `./bin/agent-kit <command>` (e.g. `./bin/agent-kit init`).

To skip every prompt and install the recommended defaults (the pre-checked presets and the preset's agents), pass `--default` — the "enter through everything" path. Explicit flags still override individual defaults:

```bash
node lib/wizard.js init --default                       # zero prompts, all defaults
node lib/wizard.js init --default --preset productivity # defaults, but a different preset
```

### One-shot install (each flag is one decision)

Passing `--preset` and `--agents` together is enough — the wizard treats it as "you've decided" and skips all prompts:

```bash
node lib/wizard.js init --preset engineering --agents claude
```

That concatenates the instructions inline into `~/.claude/CLAUDE.md` and (with `--agents codex`) `~/.codex/AGENTS.md`, and copies skills to `~/.claude/skills/` and `~/.agents/skills/`.

Common variations — change exactly the flag(s) that differ:

```bash
node lib/wizard.js init --preset engineering --agents claude,codex  # Codex too
node lib/wizard.js init --preset productivity --agents claude        # productivity preset
```

Flag reference:

- `--default` — accept every wizard default (pre-checked presets and the preset's agents) and apply without prompting; explicit flags still override individual defaults
- `--preset NAME[,NAME2]` — one or more of `{engineering, experimenting-engineering, productivity, experimenting-productivity, loop, financial}`. Comma-separated names merge capabilities (union, deduped per type); interactive form uses a multiselect prompt
- `--no-preset` — start from an empty base and pick capabilities via `--capabilities` (or the interactive customize step). Cannot be combined with `--preset`. Interactively, selecting zero presets does the same
- `--agents claude[,codex]` — which agents to deploy to
- `--capabilities '+name,-name'` — tweak the preset's capability set on the fly
- `--bundles name1,name2` — external installers (e.g. `gstack`) to run after capabilities deploy. Always install globally. Pass `--bundles ''` to skip all.

Updating:

`agent-kit update` reads the global selection manifest created by `init`, pre-checks the currently selected capabilities and agents, and lets you adjust them interactively. `update --current` replays that selection non-interactively at the current kit version; bare `update` also takes this replay path when no TTY is available. Both paths remove manifest-owned skills that are deselected or no longer ship and migrate renamed Matt skills to their canonical names.

```bash
node lib/wizard.js update           # adjust the current selection
node lib/wizard.js update --current # replay it without prompts
```

## Presets

The current Matt Pocock catalog is pinned to one upstream commit and excludes `ask-matt`, `setup-matt-pocock-skills`, and `to-tickets`.

| Preset | Matt skills | Other contents |
|---|---|---|
| `engineering` | `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `implement`, `improve-codebase-architecture`, `prototype`, `research`, `resolving-merge-conflicts`, `tdd`, `teach`, `to-questionnaire`, `to-spec`, `triage`, `wait-what`, `wayfinder`, `wizard`, `writing-for-agents` | Core engineering instructions and kit-owned delivery/review helpers |
| `productivity` | `grill-me`, `grilling`, `handoff`, `teach`, `to-questionnaire`, `wait-what`, `writing-for-agents` | Visual loops, document/media helpers, worker agents, and the Archify, HyperFrames, and Slidev bundles |
| `loop` | `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grill-with-docs`, `grilling`, `improve-codebase-architecture` | Planning, acceptance-gated build, review, critique, retrospective, and visual feedback capabilities |
| `experimenting-engineering` | Inherits the complete `engineering` set | Adds `calibrate-system-prompt`, `grill-to-design-doc`, and the Superpowers plugin |

## What's in here

| Path | Purpose |
|---|---|
| `presets/*.yaml` | Bundled artifact selections (`engineering`, `experimenting-engineering`, `productivity`, `experimenting-productivity`, `loop`, `financial`). Multi-select via `--preset a,b`; `--no-preset` starts empty |
| `capabilities/instructions/*.instructions.md` | Always-loaded rules, concatenated at deploy into `~/.claude/CLAUDE.md` (inline) and `~/.codex/AGENTS.md` |
| `capabilities/skills/<name>/SKILL.md` | Reusable workflows — slash commands and multi-step skills. Authored in Claude format with `disable-model-invocation: true` for manual-only. Skills may optionally sit under one or more nested `@`-prefixed grouping folders (e.g. `skills/@my/<name>/`, `skills/@loop/@feedback-loops/<name>/`) for source organization; deploy flattens them back to `<skillsRoot>/<name>/`, so consumption is unchanged. |
| `capabilities/agents/<name>/AGENT.md` | Spawnable sub-agents. Authored in Claude format; deployed as `~/.claude/agents/<name>.md` (source) and `~/.codex/agents/<name>.toml` (translated). Same optional `@`-grouping-folder layout as skills, flattened to `<name>` at deploy. |
| `capabilities/snippets/*.md` | Reusable skill snippets. Authored once and inlined into each deployed `SKILL.md` at `<!-- include: <name> -->` markers, so the source stays DRY while deployed skills are self-contained (Claude Code has no runtime skill-to-skill composition). Not a capability type; never deployed standalone. |
| `capabilities/plugins/*.plugin.md` | Claude Code plugin pointers (e.g., superpowers) |
| `capabilities/bundles/*.bundle.md` | External installers wrapped as deployable capabilities (e.g., gstack — 50+ `/gstack-*` skills; hyperframes — HTML video rendering). Two `installer.kind` flavors: `setup-script` (clone + run) and `npx-skills` (`npx skills add <source>`). Always installed globally; common runtime deps auto-installed by the wizard. See [docs/maintaining-bundles.md](docs/maintaining-bundles.md). |
| `bin/agent-kit` | Bash convenience launcher (`./bin/agent-kit …`) that just execs `node lib/wizard.js`; the Node command works the same in any shell |
| `lib/wizard.js` + `lib/*.js` | Wizard implementation (Node 20+) |
| `test/` | Docker-based test matrix |

## What lands where

`agent-kit init` writes the artifacts to your global agent directories — nothing
lands in any repo. There is no repo-local state file:

```text
~/.claude/CLAUDE.md     # instructions concatenated inline (overwritten each run)
~/.claude/skills/       # Claude Code reads skills here
~/.claude/agents/       # Claude Code reads sub-agents here (<name>.md)
~/.codex/AGENTS.md      # instructions concatenated inline (if --agents codex)
~/.codex/agents/        # Codex reads sub-agents here (<name>.toml; if --agents codex)
~/.agents/skills/       # cross-client skills (Codex reads here; if --agents codex).
                        #   Manual-only skills get a generated
                        #   <name>/agents/openai.yaml sidecar.
~/.agent-kit/manifest.json # global selection and ownership record used by update
```

That's it. No per-rule `.claude/rules/*.md` files, no repo-local state file, and no instructions or skills copied into the repo itself.

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
node lib/wizard.js test --host
```

Host mode is gated behind `AGENT_KIT_TEST_HOST=1` so direct `bash test/run-tests.sh` runs refuse without the env var; use the npm script or the `--host` flag.
