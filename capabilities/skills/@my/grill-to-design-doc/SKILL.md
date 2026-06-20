---
name: grill-to-design-doc
description: "Grills a feature or architecture design by delegating the interrogation to /grill-with-docs, then writes a design-doc deliverable modeled on a full feature-design template. Use when the user says \"grill my design\", \"write a design doc\", \"design doc for <feature>\", or wants to stress-test a feature/architecture in the design phase before building."
added_in: 0.40.0
---

# /grill-to-design-doc

Stress-test a feature or architecture design, then capture the resolved design as a
document. Delegate the interrogation to `/grill-with-docs`; layer a design agenda and the
deliverable on top.

## 1. Frame the feature and destination

- **feature-slug** — dash-case a short canonical name for the feature (e.g.
  `event-sourced-orders`). Confirm it with the user before the first write; on a re-grill of
  the same feature, echo the slug you're updating.
- **repo-key** — the basename of `git rev-parse --show-toplevel`; when not in a git repo,
  the cwd basename. Sanitize to one filesystem-safe segment — never embed a raw remote URL.
- **destination** — default `~/.design-doc/<repo-key>/<feature-slug>.md`. **Overridable**:
  if the user names a path (e.g. the repo's `docs/design/`), write there instead.
- If a file already exists at the resolved path, don't blind-overwrite: same feature → update
  it in place (step 3); a slug that collides with a *different* feature → confirm with the
  user or disambiguate the slug.

Tell the user where the doc will be written.

## 2. Grill

Invoke `/grill-with-docs`, seeding it with a design-focused agenda drawn from the template
sections: requirements (functional + non-functional); architecture, key design decisions and
their rationale; data models; interfaces; workflow sequences; integration points;
alternatives considered; risks and open questions.

It runs in your own context, so let it keep sharpening terminology into `CONTEXT.md` — but
**decline its ADR offers here**. The design doc's "Key Design Decisions" and "Alternatives
Considered" sections are this feature's decision record; route those decisions into the doc,
keeping `CONTEXT.md` a glossary only.

If `/grill-with-docs` is not installed, stop and tell the user to install it.

## 3. Write the design doc

Using [DESIGN-DOC-FORMAT.md](./DESIGN-DOC-FORMAT.md) as the structure, fill it from the
resolved grill outcomes — terminology is settled in the grill (and `CONTEXT.md`) first, then
the doc is filled from those outcomes.

- **Fresh write** — set Status and seed the Version History table.
- **Update to an existing doc** — read it first, then append a new Version History row rather
  than discarding history.

Write to the resolved destination.

## 4. Stop

Print the exact path written. No handoff.
