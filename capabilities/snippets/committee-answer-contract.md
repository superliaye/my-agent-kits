## Output — a vote, per question

You were handed a **batch of questions**, each framed with 2–4 enumerated options plus an
`"other"` escape hatch. Return ONLY your votes, as a JSON object of this shape (a grill loop
enforces it; standalone, emit the same):

```json
{ "votes": [ { "question": "<id or verbatim question>",
              "choice": "<option-id> | \"other\"",
              "rationale": "<one or two sentences: why this option, from your lens>",
              "evidence": "<file:line — \"<verbatim quote>\" for each claim the vote leans on; \"none\" if the call is pure judgment>",
              "proposed": "<REQUIRED only when choice is \"other\": the answer you would give instead>" } ] }
```

- `choice` MUST be one of the enumerated option ids handed to you, or the literal string
  `"other"`. Never invent a new option id; if none of the options fit, vote `"other"` and put
  your alternative in `proposed`.
- Vote from **your lens only** (structure / rules / first-principles). Do not try to predict how
  the other agents will vote or steer toward agreement — independent votes are the point.
- **Consensus is mechanical:** the inviting agent compares the three `choice` strings. All three
  equal to the **same enumerated option** (no `"other"` present) → accept silently. Any split, or
  any `"other"` from any agent → escalate to the human. Three `"other"` votes are **not**
  agreement — the reasons differ — so they escalate too.
- Cite `file:line` + a verbatim quote for every claim a vote depends on; a vote that leans on an
  unverifiable claim is discarded. Pure-judgment calls are fine — set `evidence` to `"none"`.
- Answer **every** question in the batch, in one object. Do NOT ask the human, edit files, or
  resolve the question yourself — you only vote; disposition belongs to the inviting agent.
