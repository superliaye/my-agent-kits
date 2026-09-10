## Sparse acceptance contract

Acceptance is the **sparse release contract**: the smallest set of durable outcomes whose
individual failure justifies refusing shipment. Admit a criterion only when all three hold:

- **Authority** — the user stated or confirmed it, every reasonable interpretation of the request
  requires it, or a binding repository delivery, safety, or compliance contract requires it.
- **Durability** — it remains true across valid implementation choices.
- **Consequence** — its failure alone makes the requested increment unshippable.

After admission, compare each pair: when one criterion passing necessarily proves another, keep only
the stronger observable outcome. Fold a prerequisite into that outcome — for example, "the request succeeds and returns
parseable JSON" — and remove the weaker "request is accepted" gate.

Record the authority beside each criterion as `source: user` or
`source: repo-contract <file:line>`:

```markdown
## Non-visual acceptance
- [ ] <observable behavioural outcome> — source: <authority> — verify: <initial deterministic signal>

## Visual acceptance
- [ ] <observable UI outcome> — source: <authority> — env: web|electron|desktop — at: <route/state>
```

The outcome and source are the semantic contract. `verify` is the initial evidence recipe: the
verifier may substitute an equivalent deterministic signal when it records the substitution and
why it proves the same outcome. A change to the outcome or source requires human confirmation.

`source: user` means the user stated or confirmed the outcome as required. A candidate or example in
the prompt, plausible interpretation, best practice, committee vote, or reviewer preference is not
that confirmation. `source: repo-contract` requires a verified live `file:line`; until that fact is
available, it is research to resolve rather than a gate. Conditional or pending authority stays in
release decisions, outside acceptance. When reasonable interpretations produce different observable
outcomes or thresholds, keep the choice there until the user confirms it.
