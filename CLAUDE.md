# my-agent-kits — Agent Context

Wizard repo: deploys personal AI agent artifacts to Claude Code and Codex CLI via APM.

## File Map

| File | Purpose | When to modify |
|---|---|---|
| `presets/*.yaml` | Curated primitive bundles | Adding a new preset or editing membership |
| `.apm/instructions/*.instructions.md` | Always-loaded rules; YAML frontmatter required (`description`, `applyTo`, `added_in`) | Adding a rule |
| `*.prompt.md` (root) | Slash commands; same frontmatter requirements | Adding a slash command |
| `lib/wizard.js` | Entrypoint; argv dispatcher | Adding a new top-level command |
| `lib/init.js`, `lib/update.js` | Wizard flows | Changing wizard UX |
| `lib/agents.js` | Per-agent capability table | Adding/changing an agent target |
| `lib/deploy.js` | APM orchestration + post-steps | Changing how APM is invoked |
| `test/cases/*.sh` | One per matrix cell | Adding a new agent×scope or bug repro |

## v0.1 placeholders

- **`presets/microsoft.yaml`** — `extends: personal` with no MS-specific primitives yet. The spec mentions `ms-rush`, `ms-sharepoint`, and `graduate-killswitches` but those primitives are deferred to a follow-up so v0.1 doesn't ship Microsoft-internal content publicly. The preset is a stable name (so `agent-kit init --preset microsoft` works in scripts) that currently behaves identically to `personal`.

## Layout note (APM-package conventions)

Primitives MUST live where APM expects them, otherwise install/compile finds nothing:

- Instructions → `.apm/instructions/<name>.instructions.md`
- Prompts → `<name>.prompt.md` at repo root
- Skills → `<name>/SKILL.md` (folder per skill, at repo root)
- MCP / Hooks → reserved for v0.2

This is the layout from `microsoft/apm`'s `hello-world` template. Don't put primitives in a subdirectory like `primitives/` — APM won't see them.

## Rules

- **Two supported agents only:** Claude Code and Codex CLI. Don't add others without expanding the spec.
- **Every primitive MUST have frontmatter** with `description`, `applyTo`, `added_in`. APM warns otherwise; tests will fail.
- **Bump `package.json` version when adding a primitive** and set the new primitive's `added_in` to that version. Update flow's delta detection depends on it.
- **Test before commit:** `docker run --rm my-agent-kits-test` (build first if needed).
- **Don't introduce non-MVP scope without spec update.** Hooks, MCP, additional agents: spec first, then code.

## Common Tasks

**Add a new instruction primitive:**

1. Bump `package.json` version (e.g., `0.1.0` → `0.2.0`).
2. Create `.apm/instructions/<name>.instructions.md` with frontmatter (incl. `added_in: 0.2.0`).
3. Optionally add to a preset's `primitives.instructions` list.
4. Run matrix to confirm nothing broke.
5. Commit.

**Add a new prompt primitive:**

1. Bump `package.json` version.
2. Create `<name>.prompt.md` at repo root with frontmatter.
3. Optionally add to a preset.
4. Run matrix.

**Add a new preset:**

1. Create `presets/<name>.yaml`.
2. Optionally `extends:` an existing preset.
3. Run matrix.

**Debug a failing test case:**

1. Run only that case: `KIT_ROOT=$(pwd) bash test/cases/<name>.sh` (outside Docker for fast iteration; needs apm + node available locally).
2. If it relies on container state, run inside: `docker run --rm -it my-agent-kits-test bash`.
3. Re-run matrix when fixed.

**Update the kit's behavior in any consumer repo:**

```bash
cd ~/work/repo-using-kit
agent-kit update                        # interactive — see new primitives, pick what to adopt
agent-kit update --content-only --yes   # CI-friendly, refresh content only
agent-kit update --adopt-preset-defaults --yes  # CI-friendly, auto-adopt new preset members
```

## How the wizard plugs APM gaps

1. **APM auto-detects global targets per-machine** based on installed agent CLIs. In a clean container, only Copilot is auto-detected. Wizard passes `--target claude,codex` explicitly so the env doesn't matter.
2. **Codex global deploy** lands at `~/.apm/AGENTS.md`, not `~/.codex/AGENTS.md` where Codex actually reads. Wizard copies the file post-compile.
3. **Codex personal layer** (`AGENTS.override.md` + `.gitignore`) is wizard-managed. APM doesn't know about this convention.
4. **State tracking** (`.agent-kit.yaml`) is wizard-only; APM only tracks its own lockfile.

## Spec & Plan

- Spec: [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md)
- Plan: [`docs/superpowers/plans/2026-05-08-agent-kit-installer.md`](docs/superpowers/plans/2026-05-08-agent-kit-installer.md)
