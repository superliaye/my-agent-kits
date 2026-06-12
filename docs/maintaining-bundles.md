# Maintaining bundles

A **bundle** wraps an external installer (e.g. [gstack](https://github.com/garrytan/gstack)) as a single capability that the wizard can deploy alongside instructions, skills, and plugins. Unlike skills (which the kit deploys by copying Markdown), bundles delegate to a third-party setup script — the kit's job is to clone the source at a pinned commit, ensure runtime deps, and run the installer with consistent flags.

## File layout

Each bundle is one file: `capabilities/bundles/<name>.bundle.md`. There are two installer kinds, distinguished by `installer.kind`. Pick the one that matches how upstream packages itself.

### `installer.kind: setup-script` (default — clone + run)

For upstream projects that ship a setup script in their repo (e.g. [gstack](https://github.com/garrytan/gstack)). The kit clones at a pinned SHA, runs the script once per selected agent.

```yaml
---
description: One-line summary shown in the wizard prompt
added_in: 0.7.0
source: https://github.com/<owner>/<repo>.git
pinned_commit: <40-char sha>
scope: global                       # informational; bundles always install globally
installer:
  kind: setup-script                # optional; this is the default
  command: ./setup                  # path inside the cloned repo
  flags: ["--prefix", "--quiet"]    # fixed flags applied every run
  host_flag_map:
    claude: ["--host", "claude"]    # per-agent flags appended per invocation
    codex:  ["--host", "codex"]
requires:                            # checked before invoking installer
  - bun
  - git
verify_paths:                        # checked by verify.js after install
  claude: "~/.claude/skills/<name>"
  codex:  "~/.agents/skills/<name>"   # Codex's user-skill dir, NOT ~/.codex/skills
license: MIT
---
```

### `installer.kind: npx-skills` (registry-based)

For skill bundles already packaged for the [`skills`](https://www.npmjs.com/package/skills) CLI (e.g. [hyperframes](https://github.com/heygen-com/hyperframes)). The kit runs `npx -y skills add <package>` once — the CLI is host-aware and writes to each detected agent's skills dir itself, so `host_flag_map` is not used.

```yaml
---
description: One-line summary shown in the wizard prompt
added_in: 0.8.0
scope: global
installer:
  kind: npx-skills
  package: heygen-com/hyperframes   # may include @version (e.g. ...@1.2.3)
requires:
  - node
  - npx
verify_paths:
  claude: "~/.claude/skills/<name>"
  codex:  "~/.agents/skills/<name>"   # Codex's user-skill dir, NOT ~/.codex/skills
license: Apache-2.0
---
```

`source` and `pinned_commit` are not used for `npx-skills` bundles; the "pin" is the package spec in `installer.package`, recorded verbatim into `bundle_commits.<name>` so `agent-kit update` re-runs the installer when the maintainer bumps it.

### Body

```markdown
# Bundle: <name>

Free-form Markdown body — shown to humans, not parsed by the kit. Use it to
list the slash commands the bundle adds, link to upstream docs, etc.
```

The kit reads only the frontmatter. Field reference is in [lib/capabilities.js](../lib/capabilities.js) (search for `type === "bundles"`).

## Updating gstack (or any bundle) to a newer upstream

1. **Pick the new commit.** Use a commit SHA from the upstream repo, not a tag or branch — the wizard's source-URL safety check requires a 40-char hex pin.
2. **Edit the bundle file.** Bump `pinned_commit:` in [capabilities/bundles/gstack.bundle.md](../capabilities/bundles/gstack.bundle.md). If upstream changed its installer flags or runtime deps, update those too.
3. **Bump the kit version.** Update [package.json](../package.json) and add a [CHANGELOG.md](../CHANGELOG.md) entry under the new version. Bump the bundle's `added_in:` to match so the frontmatter records which kit version the change shipped in. (`added_in:` is metadata only — `agent-kit update` is a stateless global re-deploy with no per-repo delta detection, so it does not read this field to surface "new in preset.")
4. **Test locally.** Run `npm test` (Docker, isolated) to catch regressions in the preset/state plumbing. `npm run test:host` is the opt-in inner-loop alternative — it writes to your real `~/.claude/`. The bundle install itself is skipped under `AGENT_KIT_SKIP_BUNDLE_INSTALL=1`.
5. **Commit, tag, push.**
6. **Consumer-side pickup.** Users run `agent-kit update`. The wizard reads the new `pinned_commit:`, fetches it into the bundle cache (`~/.cache/agent-kit/bundles/<name>/`), and re-runs the installer. Upstream installers are expected to be idempotent — gstack's is, per its README.

## Adding a new bundle

1. Create `capabilities/bundles/<name>.bundle.md` with the frontmatter schema above.
2. Verify the installer accepts non-interactive flags. The wizard runs it with `stdio: "inherit"` so prompts WILL block; if upstream has no `--yes` / `--quiet` mode, file an issue upstream first.
3. Decide which agents the bundle supports via `host_flag_map`. Omit agents that aren't supported — the wizard will warn and skip those.
4. List runtime deps in `requires:`. Currently the kit only special-cases `bun` (auto-installs via `bun.sh/install`). Other deps must be on PATH already; the kit's pre-flight will fail with an actionable message if missing.
5. Add the bundle to a preset's `bundles:` array if it should be selected by default. Otherwise users can opt in via `--bundles <name>` or the interactive prompt.
6. Add a test case under `test/cases/`. Mirror `test/cases/gstack-bundle.sh` — set `AGENT_KIT_SKIP_BUNDLE_INSTALL=1` and assert on the state file + scaffolding.

## Why bundles exist (and what NOT to use them for)

Use a bundle when the upstream maintainer has invested in:
- a stateful installer (symlink graph, native binary builds, cache priming)
- per-platform install logic the kit shouldn't duplicate
- a runtime that needs more than file copies (Playwright Chromium, Bun, etc.)

If you can express the workflow as **just Markdown files** that an agent reads, prefer a regular skill (`capabilities/skills/<name>/SKILL.md`) — it's lighter, doesn't require network at deploy time, and survives upstream disappearing.

## Security notes

The wizard validates `source:` (must be `https://.../*.git`) and `pinned_commit:` (must be hex SHA) before invoking `git clone`. This is a defense-in-depth check against a hostile fork of the kit pointing at `file:///` or a non-git URL. Don't relax these patterns without considering the cumulative trust this grants: bundles always install globally, so the wizard ends up trusting every bundle in every preset a user installs.
