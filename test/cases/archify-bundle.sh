#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so the global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

# Same skip-install pattern as hyperframes-bundle.sh / slidev-bundle.sh:
# AGENT_KIT_SKIP_BUNDLE_INSTALL=1 skips the real `npx skills add` (which would
# fetch the archify skill bundle from npm). This validates the kit-side
# scaffolding only: the archify bundle metadata loads as an npx-skills bundle,
# the bundle list is honored, and the kit-side dispatch writes nothing into the
# consumer repo.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# Bundle dispatch + no-leak: init with --bundles archify exits zero (the
# npx-skills kind is dispatched; skip-install means no real npx runs).
"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude --bundles archify \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: productivity preset's content lands globally.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
assert_dir_nonempty "$HOME/.claude/skills" "skills deployed to global ~/.claude/skills"

# Bundles always install globally (~/.claude/skills/archify/); under skip-install
# the kit-side dispatch must write nothing into the consumer repo.
if [ -d "$WORK/.claude/skills/archify" ]; then
  fail "archify should install globally, not into the consumer repo at .claude/skills/archify/"
else
  ok "no archify/ directory leaked into consumer repo"
fi

# Bundle verification accepts list-valued verify_paths, the explicit form Hive
# uses for managed npx-skills bundles.
mkdir -p "$HOME/.claude/skills/archify" "$HOME/.agents/skills/archify"
touch "$HOME/.claude/skills/archify/SKILL.md" "$HOME/.agents/skills/archify/SKILL.md"
unset AGENT_KIT_SKIP_BUNDLE_INSTALL
node --input-type=module -e '
  const {
    normalizeBundleVerifyPaths,
    verify,
  } = await import(process.argv[1]);
  const {
    buildNpxSkillsArgs,
    isSafeNpxSkillsPackage,
  } = await import(process.argv[2]);
  const { listAllCapabilities } = await import(process.argv[3]);
  const invalidCodexPaths = listAllCapabilities().bundles
    .filter((bundle) => bundle.installerKind === "npx-skills")
    .flatMap((bundle) => normalizeBundleVerifyPaths(bundle.verifyPaths?.codex))
    .filter((path) => !path.startsWith("~/.agents/skills/"));
  if (invalidCodexPaths.length > 0) {
    throw new Error(`npx-skills Codex paths target the wrong home: ${invalidCodexPaths.join(", ")}`);
  }
  const actual = normalizeBundleVerifyPaths(["~/.claude/skills/archify"]);
  if (JSON.stringify(actual) !== JSON.stringify(["~/.claude/skills/archify"])) {
    throw new Error(`unexpected normalized paths: ${JSON.stringify(actual)}`);
  }
  const safe = "https://github.com/example/skill/tree/0123456789abcdef0123456789abcdef01234567";
  if (!isSafeNpxSkillsPackage(safe)) throw new Error("immutable GitHub package rejected");
  if (isSafeNpxSkillsPackage(`${safe};touch /tmp/pwned`)) throw new Error("unsafe package accepted");
  const args = buildNpxSkillsArgs({ packageSpec: safe, cliAgent: "codex", skills: ["archify"] });
  const expected = ["-y", "skills", "add", safe, "--global", "--agent", "codex", "--skill", "archify", "--yes"];
  if (JSON.stringify(args) !== JSON.stringify(expected)) {
    throw new Error(`unexpected installer args: ${JSON.stringify(args)}`);
  }
  if (verify({ agents: ["claude", "codex"], capabilities: { bundles: ["archify"] } }) !== 0) {
    throw new Error("bundle verification failed");
  }
' "$KIT_ROOT/lib/verify.js" "$KIT_ROOT/lib/deploy.js" "$KIT_ROOT/lib/capabilities.js" \
  || { fail "managed npx-skills metadata support failed"; exit 1; }

# Immutable GitHub tree URLs name commits, not branches. The upstream skills
# CLI passes a tree ref to `git clone --branch`, which fails for raw SHAs. The
# kit must fetch the exact commit itself and give npx the local checkout.
FIXTURE="$TMPHOME/immutable-skill-source"
mkdir -p "$FIXTURE"
git -C "$FIXTURE" init -q
git -C "$FIXTURE" config user.name test
git -C "$FIXTURE" config user.email test@example.com
printf '%s\n' '---' 'name: fixture-skill' 'description: fixture' '---' >"$FIXTURE/SKILL.md"
git -C "$FIXTURE" add SKILL.md
git -C "$FIXTURE" commit -qm fixture
FIXTURE_SHA="$(git -C "$FIXTURE" rev-parse HEAD)"
git config --global protocol.file.allow always
git config --global url."file://$FIXTURE".insteadOf https://github.com/example/skill.git

FAKE_BIN="$TMPHOME/fake-bin"
mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/npx" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "--version" ]; then
  printf '10.0.0\n'
  exit 0
fi
test "$1" = "-y"
test "$2" = "skills"
test "$3" = "add"
test "$4" = "."
test -f SKILL.md
test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"
printf '%s\n' "$PWD" >"$NPX_CWD_LOG"
SH
chmod +x "$FAKE_BIN/npx"

EXPECTED_SHA="$FIXTURE_SHA" \
NPX_CWD_LOG="$TMPHOME/npx-cwd" \
PATH="$FAKE_BIN:$PATH" \
node --input-type=module -e '
  const { deployNpxSkillsBundle } = await import(process.argv[1]);
  const sha = process.env.EXPECTED_SHA;
  const pkg = `https://github.com/example/skill/tree/${sha}`;
  const installed = deployNpxSkillsBundle({
    meta: { installer: { package: pkg, skills: ["fixture-skill"] } },
    bundleName: "fixture-skill",
    agents: ["codex"],
    log: () => {},
    priorPin: null,
  });
  if (installed !== pkg) throw new Error(`unexpected installed pin: ${installed}`);
' "$KIT_ROOT/lib/deploy.js" \
  || { fail "immutable npx-skills checkout failed"; exit 1; }

assert_file_exists "$TMPHOME/npx-cwd" "npx ran from immutable checkout"
assert_content_contains "$TMPHOME/npx-cwd" "$FIXTURE_SHA" "immutable checkout cache includes commit"
