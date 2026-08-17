---
description: hyperframes — HTML-native video rendering for AI agents. Installs the current 20-skill router, creation workflows, and domain toolkit. Requires Node ≥ 22 and FFmpeg on PATH (FFmpeg is needed only at render time, not install).
added_in: 0.8.0
scope: global
installer:
  kind: npx-skills
  package: https://github.com/heygen-com/hyperframes/tree/67edb01bf4aa2f5931e838e46e14e0f51a5809ee
  skills:
    - embedded-captions
    - faceless-explainer
    - figma
    - general-video
    - hyperframes-animation
    - hyperframes-audio
    - hyperframes-cli
    - hyperframes-core
    - hyperframes-creative
    - hyperframes-keyframes
    - hyperframes-registry
    - hyperframes
    - media-use
    - motion-graphics
    - music-to-video
    - pr-to-video
    - product-launch-video
    - remotion-to-hyperframes
    - slideshow
    - talking-head-recut
requires:
  - node
  - npx
  - ffmpeg
verify_paths:
  claude:
    - "~/.claude/skills/embedded-captions"
    - "~/.claude/skills/faceless-explainer"
    - "~/.claude/skills/figma"
    - "~/.claude/skills/general-video"
    - "~/.claude/skills/hyperframes-animation"
    - "~/.claude/skills/hyperframes-audio"
    - "~/.claude/skills/hyperframes-cli"
    - "~/.claude/skills/hyperframes-core"
    - "~/.claude/skills/hyperframes-creative"
    - "~/.claude/skills/hyperframes-keyframes"
    - "~/.claude/skills/hyperframes-registry"
    - "~/.claude/skills/hyperframes"
    - "~/.claude/skills/media-use"
    - "~/.claude/skills/motion-graphics"
    - "~/.claude/skills/music-to-video"
    - "~/.claude/skills/pr-to-video"
    - "~/.claude/skills/product-launch-video"
    - "~/.claude/skills/remotion-to-hyperframes"
    - "~/.claude/skills/slideshow"
    - "~/.claude/skills/talking-head-recut"
  codex:
    - "~/.agents/skills/embedded-captions"
    - "~/.agents/skills/faceless-explainer"
    - "~/.agents/skills/figma"
    - "~/.agents/skills/general-video"
    - "~/.agents/skills/hyperframes-animation"
    - "~/.agents/skills/hyperframes-audio"
    - "~/.agents/skills/hyperframes-cli"
    - "~/.agents/skills/hyperframes-core"
    - "~/.agents/skills/hyperframes-creative"
    - "~/.agents/skills/hyperframes-keyframes"
    - "~/.agents/skills/hyperframes-registry"
    - "~/.agents/skills/hyperframes"
    - "~/.agents/skills/media-use"
    - "~/.agents/skills/motion-graphics"
    - "~/.agents/skills/music-to-video"
    - "~/.agents/skills/pr-to-video"
    - "~/.agents/skills/product-launch-video"
    - "~/.agents/skills/remotion-to-hyperframes"
    - "~/.agents/skills/slideshow"
    - "~/.agents/skills/talking-head-recut"
license: Apache-2.0
---

# hyperframes bundle

Wraps [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) — an open-source, HTML-native video rendering framework built for AI agents. Write HTML compositions, render to MP4 deterministically.

The kit invokes `npx skills add` with the immutable commit URL and every skill name declared above once per selected agent. The upstream CLI is host-aware: passing `--agent claude-code` writes to `~/.claude/skills/`, while `--agent codex` writes to `~/.agents/skills/`.

What lands in `~/.claude/skills/`:

- **Router**: `/hyperframes`
- **Creation workflows**: `/product-launch-video`, `/faceless-explainer`, `/pr-to-video`, `/embedded-captions`, `/talking-head-recut`, `/motion-graphics`, `/music-to-video`, `/slideshow`, `/general-video`, `/remotion-to-hyperframes`
- **Domain toolkit**: `/hyperframes-core`, `/hyperframes-animation`, `/hyperframes-keyframes`, `/hyperframes-creative`, `/media-use`, `/hyperframes-cli`, `/hyperframes-audio`, `/hyperframes-registry`, `/figma`

## How updates work

Unlike `setup-script` bundles (e.g. gstack) which use `pinned_commit`, `npx-skills` bundles pin via an immutable GitHub commit URL in `installer.package`. To upgrade hyperframes across consumer repos:

1. Pick a new commit of [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes).
2. Update `installer.package:` above.
3. Bump my-agent-kits version + CHANGELOG.
4. Consumer repos run `agent-kit update <repo>` to pick up the new pin.

See [docs/maintaining-bundles.md](../../docs/maintaining-bundles.md) for the full procedure.

## Runtime requirements

- **Node.js ≥ 22** — bundled with `npx`, used by the `skills` CLI and at render time.
- **FFmpeg** on PATH — required for rendering, not for install. The kit does not auto-install FFmpeg; consult [ffmpeg.org/download](https://ffmpeg.org/download.html) or use Homebrew / `winget install Gyan.FFmpeg`.

The wizard's pre-flight checks `npx` is on PATH and aborts the bundle install if not. FFmpeg absence is not checked at install time — you'll find out the first time you try to render.
