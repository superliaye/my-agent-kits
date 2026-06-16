## Output — findings only

Return ONLY findings, as a JSON object of this shape (a review loop enforces it; standalone,
emit the same):

```json
{ "findings": [ { "title": "...", "severity": "high|medium|low",
                  "evidence": "<file:line> — \"<verbatim quote>\"; cite every location the finding depends on",
                  "fix": "<the concrete change that resolves it>" } ] }
```

- Every finding MUST cite `file:line` and a verbatim quote for each location it depends on. A
  finding without that evidence is discarded by the adversarial verifier — don't emit it.
- Precision over recall. The verifier defaults to skepticism and auto-skips weak/speculative
  findings; padding only adds noise. An **empty `findings` array is a valid, good result**.
- Do NOT edit code, write inline patches, or triage across findings — the orchestrator owns
  disposition. Return findings only.