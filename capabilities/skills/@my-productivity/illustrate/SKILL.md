---
name: illustrate
description: Create a visual explanation that lets a reader grasp something fast — a code change, a system, a concept, a plan, or data. Defaults to low fidelity, such as a one-screen poster, and goes deeper when asked. Use when the user asks to illustrate or visualize something, explain it visually, or show what changed.
argument-hint: "What to illustrate, for whom, and optionally the form or fidelity"
added_in: 0.50.0
---

# illustrate

An illustration exists so one reader grasps one thing in the least time. Judge every choice by
**time-to-grok** for that reader.

## Find the point

Work out who the reader is, what they already know, and what they should walk away with. Infer
these from the request and the material; ask only when you can't.

Read the source itself: the diff and the code it touches, the document, the data. For a change,
compare behavior before and after, not only the lines. Then rank the few facts that matter most.
Everything below the cut is detail for a higher fidelity, or for no one.

Done when you can state the thesis in one sentence and each key fact in one line, each traced to
a source location.

## Simplify without lying

Simplify by leaving detail out, never by stating a looser rule. A compressed phrase must stay true
at its edges: check each claim against the mechanism in the source — the condition, the guard, the
exception — and phrase it at the precision the source supports. "Unread flags update" is false
when the code updates them only when the epoch advances; "unread flags update when their epoch
advances" is short and true.

When an artifact models behavior (a simulator, an animated state machine), implement the source's
real rules, note the file and lines it mirrors, and run its edge cases before shipping. Label
invented sample names and values as examples.

## Choose the form

Choose whatever form makes the point land fastest for this reader, and invent one when nothing
familiar fits. Fidelity is the main dial:

- **Low fidelity** (default) — something a reader grasps at a glance without wanting the
  mechanics, such as a **poster**: one screen that drops into a PR description or a chat thread.
- **High fidelity**, on request — depth for the reader who wants it, such as an **explorable**
  that lets them drive the real mechanism and test cases, or an **explainer** video that grabs
  attention and lands the key facts in motion. Make each one its own piece, giving the reader
  something the other artifacts don't.

Start low unless the user asks for more or names a need that low fidelity can't meet.

## Design it

Give each piece a visual identity drawn from the subject's own world, with a deliberate palette and
type pairing. Make the thesis read first, at a glance; detail sits smaller and later.

Let every visual property carry meaning. A color, shape, or position means one thing in every view,
and the same entity looks the same everywhere, so the reader tracks it as it changes. Add a key
wherever a meaning isn't obvious. Use the source's real names, explained in the reader's words.

Make each artifact self-contained, so it opens anywhere it is sent.

## Render and look

Render each artifact the way the reader will meet it — the page in a headless browser, the poster
as a PNG, the video as frames sampled across its length — and read the images back. Fix clipped or
overlapping text, missing glyphs, overflow, and anything that misleads, then render again.

Done when a fresh look at the rendered output finds nothing to fix and the thesis is the first
thing you read.

## Deliver

Write each run to its own directory, `~/.illustrate/<topic-slug>-<YYYYMMDD-HHMMSS>/`, and leave
the source repository untouched. Print the exact absolute path of each artifact with one line on
what it is for and how long it takes to grasp. Say what you did not check. Offer the next fidelity
level in one line.
