---
name: my-mermaid
description: Author or fix a Mermaid diagram (flowchart, stateDiagram, a FLOW.md) with an autonomous render-and-verify loop, delegated to the my-mermaid-agent so it costs the caller almost no context. The agent drafts render-safe Mermaid, renders it headlessly to a PNG (the same engine native VSCode uses), reads the image back to detect and fix clipped or overlapping labels in the diagram itself, and gates on a two-axis acceptance (truth vs the source, human readability) before returning. Use when creating or improving a Mermaid diagram, when a diagram has cut-off text or is hard to read, or when a diagram must be verified for both accuracy and clarity. Deliverable renders in native VSCode.
allowed-tools: Agent
added_in: 0.32.0
---

# my-mermaid

Diagram work is image-heavy — rendering and *reading PNGs back* — which would flood this
conversation's context. So this skill doesn't do it here: it hands the job to the
`my-mermaid-agent`, which runs the whole render-and-verify loop in its own context and returns
just the finished diagram and a short report.

## Do this

1. **Resolve the three inputs the agent's prompt declares** — `my-mermaid-agent` is the authority on
   what each means; don't re-derive them here. Ask the user only for what's genuinely missing, and in
   particular **don't spawn without a DELIVERABLE path** — the agent has nowhere to write otherwise.
   - **TARGET** — new diagram, or which block in which `.md` to fix.
   - **GROUND TRUTH** — repo code (paths) or a prose spec.
   - **DELIVERABLE** — the `.md` the finished block goes in.
2. **Spawn the agent**, foreground:
   ```
   Agent({
     subagent_type: "my-mermaid-agent",
     description: "diagram <subject>",
     prompt: `
       TARGET: <new | fix block N in path/to/file.md>
       GROUND TRUTH: <repo code at paths, or the prose spec>
       DELIVERABLE: <path/to/file.md>
     `
   })
   ```
3. **Relay its result** — the final diagram, the truth mapping, the fixes it applied, and any open
   questions. If it returned an open truth gap, get the user's answer and re-spawn the agent with it.

The render mechanics, authoring rules, and the truncation detect-and-fix ladder all live in the
agent, so this stays a thin launcher. If `my-mermaid-agent` isn't installed, say so — don't try to
run the loop inline (its render images are exactly what this skill exists to keep out of the caller's
context).
