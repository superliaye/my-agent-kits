## Plan authority

`plan.md` separates what the build must preserve from what implementation evidence may refine:

```markdown
## Intent and constraints (binding)
- <requested outcome, binding contract, or irreversible decision>

## Implementation hypotheses (non-binding)
- <initial mechanism and build order> — serves: <binding intent> — decide from: <evidence trigger>
```

The build preserves the binding section. It may replace a hypothesis with a better mechanism inside
those bounds, recording the evidence and material deviation for review. Review treats hypotheses as
context, not requirements.
