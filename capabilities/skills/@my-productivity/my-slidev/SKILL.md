---
name: my-slidev
description: Author or fix a Slidev slide deck with an autonomous export-and-verify loop. First it shapes the talk — a narrative arc and a slide-by-slide breakdown of what each slide proves — then delegates the drawing to my-slidev-agent, which drafts Slidev markdown, exports each slide to PNG, reads the images back to catch code spilling off the slide, clipped or overlapping text, an overfull slide, or a blank render, and gates on a two-axis acceptance (truth vs the source, projected-slide readability) before returning. Use when building or improving a slide deck, turning a talk outline or repo code into slides, or when a deck has slides that overflow, clip, or render blank.
allowed-tools: Agent
added_in: 0.44.0
---

# my-slidev

Deck work is image-heavy — exporting slides and *reading the PNGs back* — which would flood
this conversation's context. So the export-and-verify loop runs in `my-slidev-agent`, in its
own context. You stay here for the one upstream job the agent shouldn't do: **shape the talk
into a slide breakdown.** Do that, confirm the deck project exists, then spawn the agent.

## Shape the talk

Skip this only when the caller already handed you a slide-by-slide outline.

A deck is a narrative, not a dump of facts. Before any markdown exists, decide the arc:

1. **Name the through-line.** What is this talk *for* — what does the audience believe or be
   able to do by the last slide that they couldn't at the first? That goal orders everything.
2. **Break it into slides.** One idea per slide. For each slide, write a single line: what it
   *proves* or moves forward (the claim, the demo, the diagram, the turn). A slide that doesn't
   advance the through-line is a cut, not a slide.
3. **Mark what each slide is grounded in.** If a slide presents repo code, name the
   `file:line`; if it states a fact from the prose spec, point at it. The agent pins each
   technical claim to this — it must not invent code or numbers.
4. **Confirm the deck project and tooling exist.** The agent exports through Slidev, so a deck
   project (or at least a `slides.md` path to write) must be in place, and export needs
   project-scoped playwright-chromium (`npm i -D playwright-chromium`). If neither the project
   nor the tooling is set up and you can't tell whether to scaffold it, ask before spawning.

**Fixing an existing deck?** Read its current `slides.md` first and keep its arc unless the
source clearly calls for a restructure — if you do change the structure, say so and why before
spawning.

## Spawn the agent

`my-slidev-agent` owns the export mechanics, Slidev authoring rules, and the overflow
detect-and-fix loop — don't re-derive them. Resolve its inputs (ask only for what's genuinely
missing; **never spawn without a DELIVERABLE path** — it has nowhere to write otherwise), then
spawn foreground:

```
Agent({
  subagent_type: "my-slidev-agent",
  description: "deck <subject>",
  prompt: `
    TARGET: <new deck | fix existing slides.md at path>
    OUTLINE: <the slide-by-slide breakdown you shaped above>
    GROUND TRUTH: <repo code at paths, or the prose spec the talk presents>
    DELIVERABLE: <path/to/slides.md>
  `
})
```

Then **relay its result** — the deck path, the truth mapping, the fixes it applied, and any
open questions. If it returns an open truth gap, get the user's answer and re-spawn with it.

If `my-slidev-agent` isn't installed, say so — don't run the loop inline (its export images are
exactly what this skill exists to keep out of the caller's context).
