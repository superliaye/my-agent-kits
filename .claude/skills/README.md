# Kit-maintainer skills

Skills in this directory are for working **on** this kit. Distinct from the
consumer-facing primitive skills in `.apm/skills/` (those ship to consumer
repos via `agent-kit init`); kit-maintainer skills never leave this repo.
The wizard never reads from here.

Most folders here are auto-generated copies of `.apm/skills/<name>/` that
landed when `agent-kit init` was run against this repo (eating its own
dogfood). Those are safe to leave alone.

Kit-maintainer skills you write by hand should use a name not present in
`.apm/skills/` so the deploy step never overwrites them (e.g. `onboard-*`,
`kit-*`).
