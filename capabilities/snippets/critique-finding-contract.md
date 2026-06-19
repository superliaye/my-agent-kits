## Output — findings only

Return ONLY findings, as a JSON object of this shape (a committee may group them by lens;
standalone, emit the same):

```json
{ "findings": [ { "title": "...", "severity": "high|medium|low",
                  "evidence": "<file:line or screenshot path> — \"<verbatim quote / what's on screen>\"; cite every location the finding depends on",
                  "user-impact": "<why this matters to the person using the product — the cost they pay>",
                  "expected": "<what 'good' looks like here — the outcome the user should get>" } ] }
```

- Every finding MUST carry a `user-impact` line — the cost to the person using the product. This
  is what makes a critique a critique and not a code review; a finding without it is just an
  observation, so don't emit it.
- `expected` is the **outcome you want to see, not a prescribed fix.** You judged the experience,
  not the implementation — you may not know the root cause or the right code change, so describe
  the target state ("the primary action should read first", "a first-timer reaches value in ≤3
  steps") and leave *how* to whoever implements it. Don't name a code change you didn't analyse.
- Every finding MUST cite concrete evidence — a `file:line` and verbatim quote, or a screenshot
  path and what is on screen. State which mode produced it where the lens is dual-mode.
- Precision over recall. A few sharp, well-evidenced findings beat a long padded list. An **empty
  `findings` array is a valid, good result** — say so plainly when the experience holds up.
- Do NOT edit code, write inline patches, or rank findings against each other — the caller owns
  disposition. Return findings only.
