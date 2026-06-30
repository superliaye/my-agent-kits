---
name: my-demo-video
description: Record a demo video of a reachable web, Electron, or desktop surface. Resolves the target, demo goal, optional script/source, output root, and run key; gates that the app is reachable, drivable, and populated through the matching visual loop; then delegates capture, local narration, synchronization, and MP4 production to my-demo-video-agent.
allowed-tools: Agent
added_in: 0.45.0
---

# my-demo-video

You are the resident orchestrator for one recorded demo. Stay thin: resolve inputs, prove the
surface is ready through the correct visual loop, then spawn `my-demo-video-agent`.

## Resolve inputs

Collect or infer only what the worker needs:

- **TARGET_ENV** — `web`, `electron`, or `desktop`.
- **TARGET** — the URL, launch command, app/window title, route/state, or other exact surface to
  record.
- **DEMO_GOAL** — the user-visible story the MP4 should demonstrate.
- **SCRIPT_OR_SOURCE** — optional user-provided narration script, outline, PRD, docs, or app notes.
- **OUTPUT_ROOT** — optional durable output root. Default to
  `~/.my-demo-video/<repo-key>/<run-key>/`, where `<repo-key>` is a filesystem-safe repo or folder
  name.
- **RUN_KEY** — accept a user-provided key or mint a short filesystem-safe slug with enough entropy
  for concurrent runs.

If the caller asks for a synthetic explainer instead of recording the app, use `faceless-explainer`
directly; if that capability is unavailable, stop and tell the user to install it rather than
improvising a synthetic-video flow. Otherwise this skill records real app pixels only.

## Gate readiness before spawning

Pick the routed loop by invocable name, then invoke that skill to prove the target is reachable,
drivable, and showing real populated app state. Do not treat a login wall, 401, empty shell, or
undrivable surface as ready.

<!-- include: visual-env-routing -->

Use the included table as the single routing source. Remember the chosen invocable name as
**ROUTED_LOOP** for the worker handoff.

Ask the routed loop for concrete evidence: the target launches or is reachable, at least one
meaningful drive action succeeds, and the state to be recorded contains populated app data. Mention
`loop-check-readiness` only when the user wants a deeper audit of the loop setup; it proposes gaps
and is not a branchable verdict for this recording.

For web readiness, make the routed loop use `RUN_KEY` as its `agent-browser --session` name; the
worker will record that same run-scoped session. If readiness needs a saved auth state, profile, or
setup artifact to preserve populated state, include that explicit handoff in `TARGET` or
`SCRIPT_OR_SOURCE` so the worker can re-verify the same state before capture.

If v1 cannot capture or drive the requested app, **stop**. Tell the user which readiness condition
failed and point them to `faceless-explainer` for a synthetic video. Do not auto-invoke that
fallback.

## Spawn the worker

When readiness is green, spawn foreground:

```
Agent({
  subagent_type: "my-demo-video-agent",
  description: "record demo <subject>",
  prompt: `
    TARGET_ENV: <web | electron | desktop>
    ROUTED_LOOP: <invocable name selected from the included routing table>
    TARGET: <url | launch command | app/window target | route/state>
    DEMO_GOAL: <what the demo must show>
    SCRIPT_OR_SOURCE: <optional script, outline, docs, or 'none'>
    OUTPUT_ROOT: <~/.my-demo-video/<repo-key>/<run-key>/ or explicit output root>
    RUN_KEY: <run key>
  `
})
```

Require the worker's final return to include the exact final MP4 path under `OUTPUT_ROOT`/`RUN_KEY`
(or under the already run-scoped `OUTPUT_ROOT`). Relay that path plainly to the user.
