---
status: accepted
---

# wf-research is a fully script-controlled, file-based Workflow

wf-research is a capital-W dynamic Workflow that orchestrates depth-1 leaf agents which
hand off **only through files on disk**. A single `research` leaf does codebase research
plus light inline web search and writes the brief (or a `brief-before-fanout.md` draft);
the script fans out heavier web research (moderate / deep) only on the research leaf's
signal; a `continue` leaf folds those results into the final `brief.md`. Every artifact
write is wrapped in an `enforced()` loop (worker → a checker leaf reads it from disk →
pass / cold re-dispatch / degrade).

## Why a Workflow, and file-based

- **The brief is a standalone handoff artifact.** It is designed to be read on its own or
  fed to a downstream grill/plan, so warm in-session continuity between research and the
  grill is not load-bearing — the grill reads `brief.md`.
- **File-based is cost-robust to *when* a web-need surfaces.** Cheap, in-flight web facts
  are searched inline by the research leaf (warm, no restart). Expensive web research is
  fanned out and folded back by a fresh `continue` leaf that re-reads a *condensed*
  artifact — cost-competitive on short pauses and strictly cheaper on long ones: a
  deep-research pause blows past the 5-minute prompt-cache TTL, so a warm resume would
  re-bill the whole context at full price, whereas a cold re-read of the condensed brief
  is small and TTL-immune.
- **The Workflow form buys durability and structure.** A run is killable and resumable
  (cached agent results + write-once artifacts on disk), parameterized/reusable, and
  structurally reliable — every artifact is checker-gated before any later leaf reads it.

## Considered and rejected

- **Resident main-agent skill** (the main agent is the researcher, warm `--resume` of a
  sub-agent via SendMessage): keeps full tacit context across a web pause, but is not a
  reusable/parameterized primitive, makes the main agent babysit, and is cost-sensitive
  to pause timing (re-bills a large context once the pause exceeds the cache TTL). The
  tacit-context advantage is mitigated by artifact discipline — the brief's grounded
  `file:line` map and `Open questions` capture what a re-reader needs.
- **A Workflow whose script touches the filesystem directly**: not possible — the script
  must be deterministic and side-effect-free for journaled replay/resume, so all IO goes
  through leaf agents, and a checker leaf gives the blind script eyes on disk.

## Consequences

- Leaves are stateless/cold across the fan-out pause and reconstruct from disk; mitigated
  by the brief's grounded, self-contained shape.
- The script cannot read or write files — `setup-root-dir` and the checker leaves do all
  IO. Detecting a missing/malformed artifact is agent-mediated (the checker), never a
  direct `fs` call.
- The downstream grill cold-reads `brief.md` — which is exactly the intended handoff.
