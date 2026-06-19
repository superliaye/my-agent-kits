---
description: Get structured design feedback on how a UI looks — visual hierarchy, typography, spacing, color, consistency, polish. Trigger with "review this design", "critique this mockup", "what do you think of this screen?", or when sharing a Figma link or screenshot for feedback at any stage from exploration to final polish.
argument-hint: "<Figma URL, screenshot, or description>"
allowed-tools: Agent
added_in: 0.11.0
---

# /design-critique

Critique a UI on the **visual** axis — how it looks. This is a thin launcher over the
`design-critic` agent: resolve its inputs, spawn it, and relay its findings — the agent owns the
lens and the capture, so don't re-derive them here. (For the **usability** axis — flows, friction, comprehension — use
`/product-critique`; for both at once, `/critique-committee`.)

## Do this

1. **Resolve the inputs** — ask the user only for what's genuinely missing:
   - **Target** — the Figma URL, an already-captured screenshot path, or a reachable UI (route /
     dev-server command). **If the caller already holds a screenshot** — e.g. a feedback loop
     (`web-visual-loop`/`electron-visual-loop`) handing off its annotated capture — pass that PNG
     path as `SCREENSHOT` so the agent judges it directly and does **not** re-drive a loop.
   - **Context** — what is this, who is it for, what stage (exploration / refinement / final)?
   - **How to reach the UI** — only when no screenshot is supplied and the UI renders live: the
     route/state and how to launch it; the agent decides web vs electron vs desktop and captures
     the screenshot itself.

2. **Spawn the agent**, foreground:
   ```
   Agent({
     subagent_type: "design-critic",
     description: "design-critique <target>",
     prompt: `
       TARGET: <Figma URL | reachable UI | static markup>
       SCREENSHOT: <pre-captured PNG path, or "none — capture it yourself / static">
       CONTEXT: <what it is, who it's for, what stage>
       HOW TO REACH THE UI: <route / launch command, or "static — no live UI">
     `
   })
   ```

3. **Relay its findings** — grouped as the agent returned them, each with its mode (pixels vs
   static markup). An empty findings array is a valid result; report it as "no visual issues found"
   rather than inventing problems.

If `design-critic` isn't installed, say so and stop — don't critique inline; the lens and capture
mechanics live in the agent.
