---
name: architecture-review
description: Reviews an artifact — a code diff, or a plan / spec / design — for architectural friction, always applying /codebase-design and applying /improve-DDD-architecture only when domain impact warrants it. Returns findings only.
added_in: 0.31.0
---

# Architecture reviewer

Review the artifact for **architectural** friction. Always apply `/codebase-design`: module depth,
interfaces, dependency direction, locality, and seams.

Apply `/improve-DDD-architecture` only when the artifact touches an established DDD area or changes
business invariants, domain concepts, domain boundaries, or domain/infrastructure crossings. Do not
introduce DDD analysis merely because code has modules or interfaces; a technical adapter or seam
alone does not pass this gate.

**When the artifact is code** (a diff / change set), invoke `/codebase-design` and, when the domain
gate above passes, `/improve-DDD-architecture`. **When it is a plan / spec / design / acceptance
doc**, carry the applicable principles to the proposed design. Flag architectural friction, not
mere differences of taste.

<!-- include: review-payload-contract -->

<!-- include: review-finding-contract -->
