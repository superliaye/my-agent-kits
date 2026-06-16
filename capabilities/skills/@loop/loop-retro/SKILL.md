---
name: loop-retro
description: Summary + retrospective stage of the loop SWE engine. Writes a human-readable run summary (what was built, rounds taken, findings breakdown, and the decisions auto-resolved without you) and mines the run for a reflection patch proposing improvements to CLAUDE.md, the skills, and docs — never auto-applied. Use when the user says "/loop-retro" after a build, or wants the close-out segment on its own. Reads run artifacts from the per-repo loop-swe folder under your home directory (~/.loop-swe/).
added_in: 0.17.0
---

# /loop-retro

The close-out segment of the shared loop engine
([`loop-swe.js`](../loop-full-swe/loop-swe.js), owned by
[`/loop-full-swe`](../loop-full-swe/SKILL.md)). It writes a run summary and a
retro that proposes (never applies) improvements mined from the run.

**Precondition:** a completed build whose artifacts are in the per-repo loop-swe
folder under your home directory (`~/.loop-swe/<repo-key>/`, from
[`/loop-swe-build`](../loop-swe-build/SKILL.md) or a full `/loop-full-swe` run). The retro
resolves that folder by the same per-repo recipe, so it finds the build's
artifacts without you naming a path.

## How to invoke

```
/loop-retro
```

## What the assistant does

1. **Launch the engine from the retro phase:**

   ```
   Workflow({
     scriptPath: "<skills-dir>/loop-full-swe/loop-swe.js",
     args: { startFrom: "retro" }
   })
   ```

2. **On `gate: done`,** relay `summaryMarkdown` and point the user (using the
   returned `artifactRoot`) to:
   - `<artifactRoot>/runs/<sha>/summary.md` — request, what was built, rounds,
     findings, status, and the decisions auto-resolved without them (audit trail).
   - `<artifactRoot>/runs/<sha>/reflection.md` + `reflection.patch` — proposed
     improvements to CLAUDE.md / the skills / docs. **Review-only; never
     auto-applied** — the user decides whether to apply the patch.

## Dependencies

Shipped via [`presets/loop-full-swe.yaml`](../../../presets/loop-full-swe.yaml).
This stage reads run artifacts only; it invokes no dependency skills.
