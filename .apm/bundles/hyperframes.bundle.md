---
description: hyperframes — HTML-native video rendering for AI agents. Installs `/hyperframes`, `/hyperframes-cli`, `/hyperframes-media`, `/hyperframes-registry`, plus animation runtime skills (gsap, animejs, lottie, three, waapi, css-animations). Requires Node ≥ 22 and FFmpeg on PATH (FFmpeg is needed only at render time, not install).
added_in: 0.8.0
scope: global
installer:
  kind: npx-skills
  package: heygen-com/hyperframes
requires:
  - node
  - npx
  - ffmpeg
verify_paths:
  claude: "~/.claude/skills/hyperframes"
  codex: "~/.codex/skills/hyperframes"
license: Apache-2.0
---

# hyperframes bundle

Wraps [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) — an open-source, HTML-native video rendering framework built for AI agents. Write HTML compositions, render to MP4 deterministically.

The kit invokes `npx skills add heygen-com/hyperframes --global --agent <claude-code|codex> --yes` once per selected agent. The upstream CLI is host-aware: passing `--agent claude-code` writes directly to `~/.claude/skills/`, `--agent codex` to `~/.codex/skills/`. (Without `--agent`, the CLI defaults to `~/.agents/skills/` — a host-agnostic scratch dir that no host actually reads.)

What lands in `~/.claude/skills/`:

- **Composition / CLI**: `/hyperframes`, `/hyperframes-cli`
- **Media preprocessing**: `/hyperframes-media` — text-to-speech, transcription, background removal
- **Block registry**: `/hyperframes-registry` — 50+ ready-to-use transitions, overlays, data visualizations
- **Animation runtimes**: `/gsap`, `/animejs`, `/css-animations`, `/lottie`, `/three`, `/waapi`

## How updates work

Unlike `setup-script` bundles (e.g. gstack) which pin to a 40-char git SHA, `npx-skills` bundles pin via the npm package spec in `installer.package`. To upgrade hyperframes across consumer repos:

1. Pick a new release of [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes). Use a tagged version (e.g. `heygen-com/hyperframes@1.2.3`) to make the pin reproducible.
2. Update `installer.package:` above.
3. Bump my-agent-kits version + CHANGELOG.
4. Consumer repos run `agent-kit update <repo>` to pick up the new pin.

See [docs/maintaining-bundles.md](../../docs/maintaining-bundles.md) for the full procedure.

## Runtime requirements

- **Node.js ≥ 22** — bundled with `npx`, used by the `skills` CLI and at render time.
- **FFmpeg** on PATH — required for rendering, not for install. The kit does not auto-install FFmpeg; consult [ffmpeg.org/download](https://ffmpeg.org/download.html) or use Homebrew / `winget install Gyan.FFmpeg`.

The wizard's pre-flight checks `npx` is on PATH and aborts the bundle install if not. FFmpeg absence is not checked at install time — you'll find out the first time you try to render.
