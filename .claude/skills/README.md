# Kit-maintainer skills

Skills in this directory are for working **on** this kit. Distinct from the
consumer-facing capability skills in `capabilities/skills/`, which `agent-kit init`
deploys to your global agent directories (`~/.claude/skills/`, …); kit-maintainer
skills never leave this repo. The wizard never reads from or writes to here.

`agent-kit` is global-only — it never installs into a repo — so the only skills
that belong here are hand-written maintainer tools. Give them a name not present
in `capabilities/skills/` (e.g. `onboard-*`, `kit-*`) to keep them clearly separate.
