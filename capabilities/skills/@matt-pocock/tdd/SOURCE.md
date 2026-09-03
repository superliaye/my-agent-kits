# Upstream provenance

- Repository: `https://github.com/mattpocock/skills`
- Commit: `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`
- Source: `skills/engineering/tdd/`
- Vendored files: `SKILL.md`, `mocking.md`, `tests.md`

## Resync

1. Check out the pinned upstream commit (or the reviewed replacement commit).
2. Compare `skills/engineering/tdd/` with this directory.
3. Copy the vendored files listed above. Do not copy `agents/openai.yaml`; the kit generates Codex sidecars from skill frontmatter.
4. Restore the kit metadata and local deviations below.
5. Run the isolated catalog/deploy cases and the complete host roundtrip suite.

## Local deviations

- Preserved upstream `name`, `description`, invocation flags, and argument hints; added `added_in`, `upstream`, and `upstream_version` kit metadata.
- Invokes `codebase-design` with the candidate interface and seam question instead of copying its vocabulary contract.
