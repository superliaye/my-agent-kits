# my-agent-kits

Personal AI agent artifact wizard for Claude Code and Codex CLI. Bootstrap or update any repo's agent setup with one command.

## Install (one time per machine)

```bash
git clone git@github.com:superliaye/my-agent-kits.git ~/my-agent-kits
cd ~/my-agent-kits && bash bootstrap.sh
```

Requires Node 20+, APM CLI (`scoop install apm` on Windows, `pipx install git+https://github.com/microsoft/apm.git` on Linux/macOS), and Git.

## Usage

```bash
cd ~/work/some-repo
agent-kit init        # interactive 5-step wizard
agent-kit update      # catch up to latest kit
agent-kit help
```

Non-interactive (CI / scripting):

```bash
agent-kit init --preset personal --agents claude,codex --scope repo --yes
agent-kit update --content-only --yes
agent-kit update --adopt-preset-defaults --yes
```

## What's in here

| Path | Purpose |
|---|---|
| `presets/*.yaml` | Bundled artifact selections (`personal`, `microsoft`, `minimal`, `none`) |
| `.apm/instructions/*.instructions.md` | Always-loaded rules (APM-package layout) |
| `.apm/prompts/*.prompt.md` | Slash-command prompts (APM-package layout) |
| `.apm/skills/<name>/SKILL.md` | Multi-step skills (folder per skill) |
| `bin/agent-kit` | Launcher (symlinked to `~/.local/bin/`) |
| `lib/wizard.js` + `lib/*.js` | Wizard implementation (Node 20+) |
| `test/` | Docker-based test matrix (6 cases, all green) |

## Tests

```bash
docker build -q -f test/Dockerfile.test -t my-agent-kits-test .
docker run --rm my-agent-kits-test
```

Expected: `Results: 6 cases passed, 0 cases failed`.

## Spec & Plan

- Design spec: [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-05-08-agent-kit-installer.md`](docs/superpowers/plans/2026-05-08-agent-kit-installer.md)
