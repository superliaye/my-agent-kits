---
name: my-dissolve-doc
description: "Dissolve a finished one-time doc — an ADR, PRD, plan, spec, design note, or handoff whose work has already shipped — by relocating the durable knowledge it still holds (decisions, rationale, gotchas, domain terms) into permanent homes next to the code, dropping what the code already records or was only build scaffolding, then removing the stale husk so it can't mislead a later agent. The caller names the target doc; this is the careful teardown. Use when a planning or spec doc has served its purpose and now risks going stale or stealing focus, or when asked to dissolve, retire, or fold away a one-time doc."
added_in: 0.34.0
---

# my-dissolve-doc

A finished planning doc is scaffolding. It held the intent while the work happened; now the
work has shipped and the doc only goes stale and misleads. **Dissolving** it is not archiving
(that hides the staleness) and not deleting (that loses real knowledge): you disperse its
still-true content into the places it stays true, then remove the husk.

You're handed **one target doc**. If none was named, ask which.

## Dissolve it

1. **Read the doc, then confirm its work actually shipped.** Check the doc's claims against
   the current code and git history. If the work is still in flight — unmet plans, open
   tasks, code that doesn't match — stop and say so: a live doc is not stale, and dissolving
   it would delete a working plan. The caller may have mis-targeted.

2. **Sort every claim into three piles, judged against the current code:**
   - **Redundant** — already true and visible in the code or an existing durable doc. The
     code is the source of truth now. Drop it.
   - **Durable** — knowledge a reader could *not* recover from the code: *why* a choice was
     made, an alternative that was rejected, a non-obvious constraint or gotcha, a domain
     term. Relocate it.
   - **Scaffolding** — task lists, checkboxes, status, sequencing, "next steps." It served
     the build and is dead now. Drop it.

   The line between the first two: *if I delete this, does a future reader lose something they
   couldn't recover by reading the code?* Rationale and the roads not taken are almost always
   durable — code records what is, seldom why.

3. **Relocate each durable piece to its nearest permanent home** — as close to what it
   constrains as possible, so it can't silently rot. A gotcha about one function belongs in a
   comment on that function; a decision and its rationale in the repo's `docs/adr/` if it
   keeps one, else `CONTEXT.md`; a domain term in `CONTEXT.md`; a user-facing capability in
   the README. Use the durable homes the repo already has — invent a new file only when the
   knowledge clearly warrants one, and ask first. Rewrite each piece as present-tense current
   state and merge it into the existing section: drop the dates and the "we will / we now
   also" narrative.

4. **Remove the husk.** With the durable pieces relocated — and confirmed reading correctly in
   their new homes — delete the doc. First find anything that links to it and repoint those
   references; if one genuinely must keep a breadcrumb, leave a one-line stub pointing at the
   new home instead of the whole doc.

5. **Stop for review.** Leave every change uncommitted so the user sees the teardown in their
   diff before it's permanent. Report, for the doc: what moved where, what you dropped and
   why, and whether the husk is deleted or stubbed.
