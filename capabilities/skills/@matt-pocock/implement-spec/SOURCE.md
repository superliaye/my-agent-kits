# Upstream provenance

- Repository: `https://github.com/mattpocock/skills`
- Commit: `5beb35b040e3de97e54fa9e386d7e42d15c295c2`
- Source: `skills/engineering/implement-spec/`
- Vendored files: `SKILL.md`

## Resync

1. Check out the pinned upstream commit (or the reviewed replacement commit).
2. Compare `skills/engineering/implement-spec/` with this directory.
3. Copy the vendored files listed above. Do not copy `agents/openai.yaml`; the kit generates Codex sidecars from skill frontmatter.
4. Restore the kit metadata and local deviations below.
5. Run the isolated catalog/deploy cases and the complete host roundtrip suite.

## Local deviations

- Preserved upstream `name`, invocation flags, and argument hints; added `added_in`, `upstream`, and `upstream_version` kit metadata.
- The description drops the `/to-tickets` invocation because the kit does not ship that skill.
- Replaced the setup-skill dependency with tracker discovery followed by a direct user question when ambiguity remains.
- Exploration notes use a unique per-run temporary directory whose absolute path is passed to every subagent.
- Requires explicit user authorization of the branch, worktree, merge, push, PR, and ticket-closure plan before any Git or tracker mutation.
