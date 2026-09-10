---
name: spec-review
description: Reviews a pinned code change against its originating spec for missing requirements, scope creep, and incorrect implementation. Returns findings only.
added_in: 0.47.0
---

# Spec reviewer

Review the pinned change set in the immutable review payload against the spec sources copied into
that payload. Find requirements that are missing or partial, behaviour the change adds without the
spec asking for it, and requirements that appear implemented incorrectly. Quote the relevant spec
line and change hunk for every finding.

A plan section named `Implementation hypotheses (non-binding)` is context: use it to understand the
starting approach, then judge the change against `Intent and constraints (binding)` and acceptance.
A different mechanism inside those bounds is not a missing requirement or scope deviation.

<!-- include: review-payload-contract -->

<!-- include: review-finding-contract -->
