---
name: my-mermaid
description: Author or fix a Mermaid diagram with an autonomous render-and-verify loop. First it picks the diagram type that fits the source — it names the shape of the information and chooses from the live Mermaid catalog instead of defaulting to a flowchart — then delegates the drawing to my-mermaid-agent, which drafts render-safe Mermaid, renders headlessly to a PNG (the engine native VSCode uses), reads the image back to fix clipped or overlapping labels, and gates on a two-axis acceptance (truth vs the source, human readability) before returning. Use when creating or improving a Mermaid diagram, deciding which diagram type best fits, or when a diagram has cut-off text or is hard to read.
allowed-tools: Agent, WebFetch
added_in: 0.32.0
---

# my-mermaid

Diagram work is image-heavy — rendering and *reading PNGs back* — which would flood this
conversation's context. So the render-and-verify loop runs in `my-mermaid-agent`, in its own
context. You stay here for one upstream job the agent can't do: **choose the diagram type that
fits the source.** Do that, then spawn the agent.

## Pick the diagram type

Skip this only when the caller already named the type.

Reason from the **source first, not from a list** — that is what keeps the choice objective:

1. **Name the shape of the information.** What is the source actually — a sequence of
   interactions, a hierarchy, magnitudes flowing between nodes, items placed on two axes, a state
   machine, entities and their keys, events over time? Decide the shape before you look at any
   menu, so the data drives the type, not the menu.
2. **Map the shape to a type.** These common shapes have an obvious type — use it directly when
   the source plainly is one of them:
   - `flowchart` — steps, branches, decisions
   - `sequenceDiagram` — interactions/messages over time
   - `stateDiagram-v2` — modes and transitions
   - `classDiagram` — types and their relationships
   - `erDiagram` — data model: entities and keys
   - `gantt` / `timeline` — schedule over dates / events in order
   - `journey` — a user's steps and how each feels
   - `quadrantChart` — items placed on two axes
   - `pie` — parts of a whole
   - `mindmap` — a branching hierarchy from one root

   This list is the **common shorthand, not the catalog.** The catalog is every type Mermaid
   registers today — many specialized ones (Sankey for flow magnitudes, a Wardley map, Cynefin,
   radar, treemap, packet, …) are not above.
3. **Before committing, ask: is there a more specialized type than the obvious one?** Whenever the
   shape is anything past a plain flowchart/sequence — or you are unsure a fitting type exists —
   read the live catalog and scan all of it for a better fit instead of settling for the nearest
   shorthand item:
   `https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/diagram-api/diagram-orchestration.ts`
   lists the registered type ids; for what a less-familiar one is for, read its page at
   `https://mermaid.js.org/syntax/<id>.html`. If a fetch fails, fall back to the shorthand plus
   your own knowledge — don't stall.
4. **Commit.** One clearly-best fit → use it. Two or more that genuinely fit and would change the
   message → present them, one-line why each, and let the user pick; if no one is there to answer
   (an unattended run), choose the best fit and note the alternatives in your handoff.

**Fixing an existing block?** Read its current type first and keep it unless the source clearly
calls for a different one — if you do change it, say so and why before spawning.

## Spawn the agent

`my-mermaid-agent` owns the render mechanics, authoring rules, and the truncation detect-and-fix
ladder — don't re-derive them. Resolve its inputs (ask only for what's genuinely missing; **never
spawn without a DELIVERABLE path** — it has nowhere to write otherwise), then spawn foreground:

```
Agent({
  subagent_type: "my-mermaid-agent",
  description: "diagram <subject>",
  prompt: `
    TYPE: <the type you picked, e.g. sequenceDiagram>
    TARGET: <new | fix block N in path/to/file.md>
    GROUND TRUTH: <repo code at paths, or the prose spec>
    DELIVERABLE: <path/to/file.md>
  `
})
```

Then **relay its result** — the final diagram, the truth mapping, the fixes it applied, and any
open questions. If it returns an open truth gap, get the user's answer and re-spawn with it.

If `my-mermaid-agent` isn't installed, say so — don't run the loop inline (its render images are
exactly what this skill exists to keep out of the caller's context).
