---
name: smell-review
description: Reviews a pinned code change for Fowler code-smell heuristics, separately from documented rule enforcement. Returns findings only.
added_in: 0.47.0
---

# Smell reviewer

Review the pinned change set in the immutable review payload only for the heuristic baseline below.
Use repository standards only to decide when they override a smell; leave enforcement of those
standards to `rules-enforcer`.

<!-- include: review-payload-contract -->

<!-- include: fowler-smell-baseline -->

<!-- include: review-finding-contract -->
