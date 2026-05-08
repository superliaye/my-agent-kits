# agent-kit-installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `my-agent-kits` interactive wizard that bootstraps and updates personal AI agent artifacts (instructions, prompts, skills) for Claude Code and Codex CLI in any repo, via APM.

**Architecture:** Wrapper on top of APM CLI. Node 20 + `@clack/prompts` TUI. Mono-repo containing primitives + presets + wizard + Docker test matrix. Wizard generates per-repo `apm.yml`, runs `apm install` + `apm compile`, plus post-steps for Codex global copy and `AGENTS.override.md`.

**Tech Stack:** Node 20+, `@clack/prompts`, `yaml`, APM CLI v0.12.4+, Docker, Bash 5+.

**Spec:** See [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](../specs/2026-05-08-agent-kit-installer-design.md). Sign-of-completion: code complete, 6/6 test matrix green, multi-agent code review incorporated.

---

## File Structure

```
my-agent-kits/
├── apm.yml                                    # APM manifest declaring this package
├── package.json                               # Node deps: @clack/prompts, yaml
├── README.md                                  # User-facing docs
├── CLAUDE.md                                  # Maintenance guide
├── CHANGELOG.md
├── .gitignore                                 # node_modules/, *.lock, etc.
├── bootstrap.sh                               # one-time install: npm i + symlink to ~/.local/bin
├── bin/agent-kit                              # tiny shell shim → execs lib/wizard.js
├── presets/personal.yaml                      # generic preset
├── presets/microsoft.yaml                     # personal + MS-internal
├── presets/minimal.yaml                       # core only
├── presets/none.yaml                          # empty starting point
├── primitives/instructions/core.instructions.md       # frontmatter incl. added_in: 0.1.0
├── primitives/instructions/typescript.instructions.md
├── primitives/prompts/my-commit.prompt.md
├── primitives/prompts/my-commit-and-push.prompt.md
├── primitives/prompts/my-create-pr.prompt.md
├── primitives/prompts/my-explain.prompt.md
├── primitives/prompts/my-fix-build.prompt.md
├── primitives/prompts/my-clean-code.prompt.md
├── primitives/skills/                         # placeholder dir
├── primitives/mcp/                            # placeholder dir
├── primitives/hooks/                          # placeholder dir
├── lib/wizard.js                              # entrypoint dispatcher
├── lib/cli.js                                 # arg parsing
├── lib/presets.js                             # load/validate presets/*.yaml
├── lib/primitives.js                          # discover primitives/
├── lib/state.js                               # read/write .agent-kit.yaml
├── lib/agents.js                              # per-agent capability table
├── lib/apm-writer.js                          # generate per-repo apm.yml
├── lib/deploy.js                              # orchestrates apm install + compile + post-steps
├── lib/verify.js                              # post-install file checks + summary
├── lib/init.js                                # init flow (5 steps)
├── lib/update.js                              # update flow (3 steps)
└── test/Dockerfile.test                       # apm + node + git base image
    test/run-tests.sh                          # iterates test/cases/*.sh
    test/lib/assertions.sh                     # assert_file_exists, assert_content_contains, etc.
    test/cases/claude-repo.sh                  # case 1
    test/cases/claude-global.sh                # case 2
    test/cases/codex-repo.sh                   # case 3
    test/cases/codex-global.sh                 # case 4
    test/cases/update-content-only.sh          # case 5
    test/cases/update-adopt-defaults.sh        # case 6
```

**Module responsibility boundaries:**
- `presets.js`, `primitives.js`, `state.js` — pure I/O over YAML/MD. No subprocesses.
- `agents.js` — pure data: capability table for Claude/Codex. No I/O.
- `apm-writer.js` — pure: takes `{preset, agents, scope, primitives}`, returns the `apm.yml` content as a string.
- `deploy.js` — orchestrates subprocess calls (`apm install`, `apm compile`, file copies).
- `verify.js` — file-existence + content-hash + summary printer. Read-only over the deployed files.
- `init.js`, `update.js` — wizard flow logic, each calls `deploy.js` + `verify.js`.
- `wizard.js` — argv-only dispatcher; routes to `init.js` or `update.js`.

---

## Phase A: Preparation in superliaye/personal-agent-kit

### Task 1: Add APM-required frontmatter to existing primitives

**Why:** APM warns about missing `description` and `applyTo` during compile. Required before tests can pass. Setting `added_in: 0.1.0` satisfies the update-flow delta detection (Section 5 of spec).

**Files:**
- Modify: `D:/GitRepos/personal-agent-kit/.apm/instructions/core.instructions.md`
- Modify: `D:/GitRepos/personal-agent-kit/.apm/instructions/typescript.instructions.md`
- Modify: `D:/GitRepos/personal-agent-kit/my-commit.prompt.md`
- Modify: `D:/GitRepos/personal-agent-kit/my-commit-and-push.prompt.md`
- Modify: `D:/GitRepos/personal-agent-kit/my-create-pr.prompt.md`
- Modify: `D:/GitRepos/personal-agent-kit/my-explain.prompt.md`
- Modify: `D:/GitRepos/personal-agent-kit/my-fix-build.prompt.md`
- Modify: `D:/GitRepos/personal-agent-kit/my-clean-code.prompt.md`

- [ ] **Step 1: Update `core.instructions.md` frontmatter**

Insert at the top of the file (replace any existing frontmatter):

```markdown
---
description: Core repo-agnostic conduct rules — no emojis, evergreen docs, ask before git mutations
applyTo: "**"
added_in: 0.1.0
---

```

(The `---` opening fence goes at line 1; existing body content follows after the second `---` and the blank line.)

- [ ] **Step 2: Update `typescript.instructions.md` frontmatter**

```markdown
---
description: TypeScript conduct — no `any`, no `as any`, no `as unknown as`
applyTo: "**/*.{ts,tsx}"
added_in: 0.1.0
---

```

- [ ] **Step 3: Update each `*.prompt.md` file's frontmatter to add `added_in`**

Each existing prompt already has `description:` and `allowed-tools:`. Add `added_in: 0.1.0` as a new key:

```yaml
---
description: ...existing description...
allowed-tools: ...existing tools...
added_in: 0.1.0
---
```

Apply to all 6 `*.prompt.md` files. Do NOT modify the prompt body.

- [ ] **Step 4: Smoke check — APM compile no longer warns about frontmatter**

```bash
cd /tmp/apm-codex-test && rm -rf apm_modules apm.yml apm.lock.yaml AGENTS.md .codex 2>/dev/null
git init -q .
apm install ../personal-agent-kit --target codex 2>&1 | tail -5
apm compile -t codex 2>&1 | grep -E "warning|Missing|applyTo" | head -5
```

Expected: 0 lines from grep (no warnings about `description` or `applyTo`).

- [ ] **Step 5: Commit (in personal-agent-kit)**

```bash
cd D:/GitRepos/personal-agent-kit
git add -A
git commit -m "feat: add description, applyTo, added_in frontmatter to primitives

Required by APM compile (was warning) and by my-agent-kits update-flow
delta detection (added_in for kit-version tracking).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main
```

---

## Phase B: Create my-agent-kits skeleton

The local `my-agent-kits` repo already exists at `D:/GitRepos/my-agent-kits` with the spec committed. We add scaffolding next.

### Task 2: Author root config files

**Files:**
- Create: `D:/GitRepos/my-agent-kits/package.json`
- Create: `D:/GitRepos/my-agent-kits/apm.yml`
- Modify: `D:/GitRepos/my-agent-kits/.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "my-agent-kits",
  "version": "0.1.0",
  "description": "Personal AI agent artifact wizard for Claude Code and Codex CLI",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "bash test/run-tests.sh"
  },
  "dependencies": {
    "@clack/prompts": "^0.7.0",
    "yaml": "^2.4.0"
  }
}
```

- [ ] **Step 2: Write `apm.yml`** (so the kit itself is an APM-installable package, useful for the matrix)

```yaml
name: my-agent-kits
version: 0.1.0
description: Personal AI agent artifact wizard for Claude Code and Codex CLI
author: Leon YE

dependencies:
  apm: []
  mcp: []
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
apm.lock.yaml
apm_modules/
.DS_Store
Thumbs.db
.vscode/
.idea/
```

- [ ] **Step 4: Commit**

```bash
cd D:/GitRepos/my-agent-kits
git add package.json apm.yml .gitignore
git commit -m "scaffold: package.json, apm.yml, .gitignore

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 3: Create primitive directories and migrate from personal-agent-kit

**Files:**
- Create dirs: `primitives/{instructions,prompts,skills,mcp,hooks}/`
- Copy: 8 primitive files from personal-agent-kit (the ones we updated in Task 1)

- [ ] **Step 1: Create directory structure**

```bash
cd D:/GitRepos/my-agent-kits
mkdir -p primitives/instructions primitives/prompts primitives/skills primitives/mcp primitives/hooks
touch primitives/skills/.gitkeep primitives/mcp/.gitkeep primitives/hooks/.gitkeep
```

- [ ] **Step 2: Copy instructions from personal-agent-kit**

```bash
cp D:/GitRepos/personal-agent-kit/.apm/instructions/core.instructions.md \
   D:/GitRepos/my-agent-kits/primitives/instructions/
cp D:/GitRepos/personal-agent-kit/.apm/instructions/typescript.instructions.md \
   D:/GitRepos/my-agent-kits/primitives/instructions/
```

- [ ] **Step 3: Copy prompts from personal-agent-kit**

```bash
cp D:/GitRepos/personal-agent-kit/my-commit.prompt.md \
   D:/GitRepos/personal-agent-kit/my-commit-and-push.prompt.md \
   D:/GitRepos/personal-agent-kit/my-create-pr.prompt.md \
   D:/GitRepos/personal-agent-kit/my-explain.prompt.md \
   D:/GitRepos/personal-agent-kit/my-fix-build.prompt.md \
   D:/GitRepos/personal-agent-kit/my-clean-code.prompt.md \
   D:/GitRepos/my-agent-kits/primitives/prompts/
```

- [ ] **Step 4: Smoke check — count files**

```bash
ls D:/GitRepos/my-agent-kits/primitives/instructions/*.md | wc -l
ls D:/GitRepos/my-agent-kits/primitives/prompts/*.md | wc -l
```

Expected: `2` and `6`.

- [ ] **Step 5: Commit**

```bash
cd D:/GitRepos/my-agent-kits
git add primitives/
git commit -m "feat: migrate primitives from personal-agent-kit

2 instructions + 6 prompts. Sources retain APM frontmatter
(description, applyTo, added_in: 0.1.0).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 4: Author the four presets

**Files:**
- Create: `presets/personal.yaml`
- Create: `presets/microsoft.yaml`
- Create: `presets/minimal.yaml`
- Create: `presets/none.yaml`

- [ ] **Step 1: Create `presets/personal.yaml`**

```yaml
name: personal
description: Generic AI coding kit — language-agnostic rules + universal slash commands
default_agents: [claude, codex]

primitives:
  instructions:
    - core
    - typescript
  prompts:
    - my-commit
    - my-commit-and-push
    - my-create-pr
    - my-fix-build
    - my-explain
    - my-clean-code
  skills: []
  mcp: []
  hooks: []

apm_dependencies: []
```

- [ ] **Step 2: Create `presets/microsoft.yaml`**

```yaml
name: microsoft
description: Personal kit + Microsoft-specific (ODSP/Rush/SharePoint placeholder for v0.1)
extends: personal
default_agents: [claude, codex]

primitives:
  instructions: []
  prompts: []
  skills: []
  mcp: []
  hooks: []

apm_dependencies: []
```

(MS-specific primitives don't exist yet — this preset is intentionally a no-op extension of `personal` until they're authored. Documented in CLAUDE.md.)

- [ ] **Step 3: Create `presets/minimal.yaml`**

```yaml
name: minimal
description: Just the core conduct rules — no slash commands, no language rules
default_agents: [claude, codex]

primitives:
  instructions:
    - core
  prompts: []
  skills: []
  mcp: []
  hooks: []

apm_dependencies: []
```

- [ ] **Step 4: Create `presets/none.yaml`**

```yaml
name: none
description: Empty starting point — pick everything in the customize step
default_agents: [claude, codex]

primitives:
  instructions: []
  prompts: []
  skills: []
  mcp: []
  hooks: []

apm_dependencies: []
```

- [ ] **Step 5: Smoke check — YAML parses**

```bash
cd D:/GitRepos/my-agent-kits
node -e "const yaml=require('yaml');const fs=require('fs');for(const f of ['personal','microsoft','minimal','none']){const p=yaml.parse(fs.readFileSync('presets/'+f+'.yaml','utf8'));console.log(f, '✓', 'primitives:', Object.keys(p.primitives).length)}"
```

Expected: 4 lines, each ending `primitives: 5`.

- [ ] **Step 6: Commit**

```bash
git add presets/
git commit -m "feat: author 4 presets (personal, microsoft, minimal, none)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase C: Wizard library implementation

Each task creates one focused module. Sequence chosen so each task's dependencies are already implemented.

### Task 5: lib/agents.js — per-agent capability table

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/agents.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/agents.js
// Per-agent capability table. Pure data + small helpers. No I/O, no subprocesses.

export const AGENTS = {
  claude: {
    label: "Claude Code",
    aliases: ["claude", "claude-code"],
    apmTarget: "claude",
    supports: {
      repo: true,
      global: true,
      primitiveTypes: ["instructions", "prompts", "skills"],
    },
    paths: {
      repo: {
        instructions: ".claude/rules",
        prompts: ".claude/commands",
        skills: ".claude/skills",
      },
      global: {
        instructions: "~/.claude/rules",
        prompts: "~/.claude/commands",
        skills: "~/.claude/skills",
      },
    },
    needsCompile: false,
    testHint: "/my-commit (in Claude Code)",
  },
  codex: {
    label: "Codex CLI",
    aliases: ["codex", "codex-cli"],
    apmTarget: "codex",
    supports: {
      repo: true,
      global: true,
      primitiveTypes: ["instructions"],
    },
    paths: {
      repo: {
        instructions: "AGENTS.md",         // single concatenated file at repo root
        instructionsOverride: "AGENTS.override.md",
      },
      global: {
        instructions: "~/.codex/AGENTS.md",
      },
    },
    needsCompile: true,                    // requires `apm compile -t codex`
    testHint: "codex (interactive prompt)",
  },
};

export function resolveAgent(input) {
  const lc = String(input).toLowerCase();
  for (const [key, def] of Object.entries(AGENTS)) {
    if (key === lc || def.aliases.includes(lc)) return { key, ...def };
  }
  throw new Error(`Unknown agent: ${input}. Supported: ${Object.keys(AGENTS).join(", ")}`);
}

export function listAgentKeys() {
  return Object.keys(AGENTS);
}

export function supportsScope(agentKey, scope) {
  return Boolean(AGENTS[agentKey]?.supports?.[scope]);
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {AGENTS, resolveAgent, supportsScope} from './lib/agents.js'; console.log(Object.keys(AGENTS)); console.log(resolveAgent('claude').label); console.log(supportsScope('codex','global'));"
```

Expected:
```
[ 'claude', 'codex' ]
Claude Code
true
```

- [ ] **Step 3: Commit**

```bash
git add lib/agents.js
git commit -m "feat: lib/agents.js per-agent capability table

Pure data: paths, scope support, primitive types. No I/O.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 6: lib/presets.js — load and validate presets

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/presets.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/presets.js
// Load and validate presets/*.yaml. Pure I/O over YAML.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = join(HERE, "..", "presets");

const PRIMITIVE_TYPES = ["instructions", "prompts", "skills", "mcp", "hooks"];

export function listPresetNames() {
  return readdirSync(PRESETS_DIR)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.replace(/\.yaml$/, ""));
}

export function loadPreset(name) {
  const path = join(PRESETS_DIR, `${name}.yaml`);
  const raw = yamlParse(readFileSync(path, "utf8"));
  if (!raw || typeof raw !== "object") {
    throw new Error(`Preset ${name}: file is empty or not an object`);
  }
  validatePresetShape(name, raw);

  // Resolve `extends` by literal-copy (MVP semantics; per spec)
  if (raw.extends) {
    const parent = loadPreset(raw.extends);
    raw.primitives = mergePrimitives(parent.primitives, raw.primitives);
    raw.apm_dependencies = [...(parent.apm_dependencies ?? []), ...(raw.apm_dependencies ?? [])];
  }

  return raw;
}

function validatePresetShape(name, p) {
  if (!p.name) throw new Error(`Preset ${name}: missing 'name'`);
  if (!Array.isArray(p.default_agents)) {
    throw new Error(`Preset ${name}: 'default_agents' must be an array`);
  }
  if (!p.primitives || typeof p.primitives !== "object") {
    throw new Error(`Preset ${name}: 'primitives' missing or not an object`);
  }
  for (const t of PRIMITIVE_TYPES) {
    if (!Array.isArray(p.primitives[t])) {
      throw new Error(`Preset ${name}: 'primitives.${t}' must be an array`);
    }
  }
}

function mergePrimitives(parent, child) {
  const out = {};
  for (const t of PRIMITIVE_TYPES) {
    out[t] = uniq([...(parent[t] ?? []), ...(child[t] ?? [])]);
  }
  return out;
}

function uniq(arr) {
  return Array.from(new Set(arr));
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {listPresetNames, loadPreset} from './lib/presets.js'; console.log(listPresetNames()); const p=loadPreset('microsoft'); console.log('microsoft has', p.primitives.instructions.length+p.primitives.prompts.length, 'primitives via extends');"
```

Expected:
```
[ 'microsoft', 'minimal', 'none', 'personal' ]
microsoft has 8 primitives via extends
```

- [ ] **Step 3: Commit**

```bash
git add lib/presets.js
git commit -m "feat: lib/presets.js loader with extends resolution

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 7: lib/primitives.js — discover primitives from disk

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/primitives.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/primitives.js
// Walk primitives/ and parse frontmatter. Provides the union of all available
// primitive options for the wizard's customize step + update delta detection.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as yamlParse } from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const PRIMITIVES_DIR = join(HERE, "..", "primitives");

const TYPE_SUBDIRS = {
  instructions: { ext: ".instructions.md", isDir: false },
  prompts:      { ext: ".prompt.md",       isDir: false },
  skills:       { ext: "/SKILL.md",        isDir: true  },  // each skill is a folder
  mcp:          { ext: ".yaml",            isDir: false },
  hooks:        { ext: ".sh",              isDir: false },
};

export function listAllPrimitives() {
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
  for (const [type, cfg] of Object.entries(TYPE_SUBDIRS)) {
    const dir = join(PRIMITIVES_DIR, type);
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      let name, frontmatter;

      if (cfg.isDir) {
        if (!statSync(full).isDirectory()) continue;
        const skillFile = join(full, "SKILL.md");
        try {
          frontmatter = parseFrontmatter(readFileSync(skillFile, "utf8"));
          name = entry;
        } catch { continue; }
      } else {
        if (!entry.endsWith(cfg.ext.replace(/^\//, ""))) continue;
        if (statSync(full).isDirectory()) continue;
        frontmatter = parseFrontmatter(readFileSync(full, "utf8"));
        name = entry.replace(new RegExp(cfg.ext.replace(".", "\\.") + "$"), "");
      }

      out[type].push({
        name,
        type,
        path: full,
        description: frontmatter.description ?? "",
        applyTo: frontmatter.applyTo ?? "**",
        addedIn: frontmatter.added_in ?? "0.0.0",
      });
    }
  }
  return out;
}

export function parseFrontmatter(content) {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end < 0) return {};
  const yamlSrc = content.slice(3, end).trim();
  return yamlParse(yamlSrc) ?? {};
}

export function findPrimitive(type, name) {
  const all = listAllPrimitives();
  return all[type]?.find((p) => p.name === name);
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {listAllPrimitives, findPrimitive} from './lib/primitives.js'; const all=listAllPrimitives(); console.log('instructions:',all.instructions.length,'prompts:',all.prompts.length); console.log(findPrimitive('instructions','core'));"
```

Expected: `instructions: 2 prompts: 6` plus an object showing `core` with `addedIn: '0.1.0'`.

- [ ] **Step 3: Commit**

```bash
git add lib/primitives.js
git commit -m "feat: lib/primitives.js discovery + frontmatter parsing

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 8: lib/state.js — read/write `.agent-kit.yaml`

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/state.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/state.js
// Manage the per-repo .agent-kit.yaml state file (Section 4b of spec).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

const STATE_FILE = ".agent-kit.yaml";

export function readState(repoDir) {
  const path = join(repoDir, STATE_FILE);
  if (!existsSync(path)) return null;
  return yamlParse(readFileSync(path, "utf8"));
}

export function writeState(repoDir, state) {
  const path = join(repoDir, STATE_FILE);
  const out = {
    preset: state.preset,
    kit_version_at_last_run: state.kitVersion,
    last_run: new Date().toISOString(),
    selected_agents: state.agents,
    scope: state.scope,
    codex_personal_layer: Boolean(state.codexPersonalLayer),
    primitives_at_last_run: state.primitives, // shape: { instructions: [...], prompts: [...], ... }
  };
  writeFileSync(path, yamlStringify(out));
  return out;
}

export function readKitVersion(kitRoot) {
  const pkg = JSON.parse(readFileSync(join(kitRoot, "package.json"), "utf8"));
  return pkg.version;
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {readKitVersion} from './lib/state.js'; console.log(readKitVersion('.'));"
```

Expected: `0.1.0`

- [ ] **Step 3: Commit**

```bash
git add lib/state.js
git commit -m "feat: lib/state.js for .agent-kit.yaml read/write

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 9: lib/apm-writer.js — generate per-repo apm.yml

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/apm-writer.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/apm-writer.js
// Generate the per-repo apm.yml that lists my-agent-kits as a dep and sets targets.
// Pure: takes config object, returns YAML string.

import { stringify as yamlStringify } from "yaml";
import { resolveAgent } from "./agents.js";

export function generateApmYml({ repoName, agents, kitRef = "superliaye/my-agent-kits" }) {
  const targets = agents.map((a) => resolveAgent(a).apmTarget);

  return yamlStringify({
    name: repoName,
    version: "1.0.0",
    description: `Agent kit configuration for ${repoName}`,
    dependencies: {
      apm: [kitRef],
      mcp: [],
    },
    targets,
  });
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {generateApmYml} from './lib/apm-writer.js'; console.log(generateApmYml({repoName:'demo', agents:['claude','codex']}));"
```

Expected output contains `name: demo`, `apm:` list with `superliaye/my-agent-kits`, `targets:` with `[claude, codex]`.

- [ ] **Step 3: Commit**

```bash
git add lib/apm-writer.js
git commit -m "feat: lib/apm-writer.js generates per-repo apm.yml

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 10: lib/deploy.js — orchestrate apm install + compile + post-steps

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/deploy.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/deploy.js
// Orchestrates the actual deployment: write apm.yml, run apm install, run apm compile,
// perform post-steps (Codex global copy, AGENTS.override.md), and write .agent-kit.yaml.

import { writeFileSync, mkdirSync, copyFileSync, appendFileSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";
import { generateApmYml } from "./apm-writer.js";
import { writeState, readKitVersion } from "./state.js";

const APM_HOME = join(homedir(), ".apm");

export function deploy({ repoDir, kitRoot, preset, agents, scope, primitives, codexPersonalLayer = false, isUpdate = false, kitRef = "superliaye/my-agent-kits" }) {
  const log = (line) => process.stdout.write(line + "\n");

  // 1. Write apm.yml at the deploy target dir
  //    For repo scope: <repoDir>/apm.yml
  //    For global scope: ~/.apm/apm.yml
  const apmCwd = scope === "global" ? APM_HOME : repoDir;
  const apmYmlPath = join(apmCwd, "apm.yml");
  const repoName = scope === "global" ? "user-global" : (basename(repoDir) || "repo");
  ensureDir(apmCwd);
  writeFileSync(apmYmlPath, generateApmYml({ repoName, agents, kitRef }));
  log(`✓ Wrote ${apmYmlPath}`);

  // 2. Run apm install (with --force always, --update on update path)
  const installArgs = ["install", "--force"];
  if (scope === "global") installArgs.push("-g");
  if (isUpdate) installArgs.push("--update");
  runApm(installArgs, apmCwd, log);

  // 3. Run apm compile -t claude,codex (idempotent for Claude; required for Codex)
  const targets = agents.map((a) => resolveAgent(a).apmTarget).join(",");
  runApm(["compile", "-t", targets], apmCwd, log);

  // 4. Codex global copy step
  if (scope === "global" && agents.includes("codex")) {
    const src = join(APM_HOME, "AGENTS.md");
    const dst = join(homedir(), ".codex", "AGENTS.md");
    if (!existsSync(src)) {
      throw new Error(`Codex global copy: source missing at ${src} (apm compile may have failed)`);
    }
    ensureDir(dirname(dst));
    copyFileSync(src, dst);
    log(`✓ Codex global: copied ${src} → ${dst}`);
  }

  // 5. Codex personal layer (repo scope only, opt-in)
  if (scope === "repo" && agents.includes("codex") && codexPersonalLayer) {
    const overridePath = join(repoDir, "AGENTS.override.md");
    const concat = concatInstructionsForOverride(kitRoot, primitives.instructions ?? []);
    writeFileSync(overridePath, concat);
    log(`✓ Wrote ${overridePath} (personal layer)`);
    appendToGitignore(repoDir, "AGENTS.override.md");
    log(`✓ Added AGENTS.override.md to .gitignore`);
  }

  // 6. Write/refresh .agent-kit.yaml in repoDir
  if (scope === "repo") {
    writeState(repoDir, {
      preset: preset.name,
      kitVersion: readKitVersion(kitRoot),
      agents,
      scope,
      codexPersonalLayer,
      primitives,
    });
    log(`✓ Wrote ${repoDir}/.agent-kit.yaml`);
  }
}

function runApm(args, cwd, log) {
  log(`> apm ${args.join(" ")}  (cwd: ${cwd})`);
  const r = spawnSync("apm", args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    throw new Error(`apm ${args.join(" ")} exited ${r.status}`);
  }
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function basename(p) {
  return p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "";
}

function concatInstructionsForOverride(kitRoot, instructionNames) {
  const parts = ["# AGENTS.override.md", "<!-- Personal layer, gitignored. Generated by agent-kit. -->", ""];
  for (const name of instructionNames) {
    const p = join(kitRoot, "primitives", "instructions", `${name}.instructions.md`);
    if (!existsSync(p)) continue;
    parts.push(stripFrontmatter(readFileSync(p, "utf8")));
    parts.push("");
  }
  return parts.join("\n");
}

function stripFrontmatter(s) {
  if (!s.startsWith("---")) return s;
  const end = s.indexOf("\n---", 3);
  if (end < 0) return s;
  return s.slice(end + 4).replace(/^\n+/, "");
}

function appendToGitignore(repoDir, line) {
  const gi = join(repoDir, ".gitignore");
  let cur = "";
  if (existsSync(gi)) cur = readFileSync(gi, "utf8");
  if (cur.split(/\r?\n/).includes(line)) return;
  if (cur.length && !cur.endsWith("\n")) cur += "\n";
  writeFileSync(gi, cur + line + "\n");
}
```

- [ ] **Step 2: Smoke check (dry run via Node — no actual apm install)**

We can't fully smoke-test deploy.js without invoking apm. Validate that imports resolve:

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {deploy} from './lib/deploy.js'; console.log(typeof deploy);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add lib/deploy.js
git commit -m "feat: lib/deploy.js orchestrates apm install + compile + post-steps

Codex global copy and AGENTS.override.md handling included.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 11: lib/verify.js — post-install file checks + summary

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/verify.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/verify.js
// After deploy, check expected files exist and print a summary table.

import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { resolveAgent } from "./agents.js";

const CODEX_CAP_BYTES = 32 * 1024;

export function verify({ repoDir, agents, scope, primitives, codexPersonalLayer }) {
  const log = (line) => process.stdout.write(line + "\n");
  log("");
  log("Verification:");

  let ok = true;
  const home = homedir();

  for (const aKey of agents) {
    const a = resolveAgent(aKey);
    const paths = a.paths[scope];
    log(`  ${a.label.padEnd(20)}`);

    for (const ptype of a.supports.primitiveTypes) {
      const target = expandTarget(paths[ptype], home, repoDir);
      if (!target) continue;

      let result;
      if (target.endsWith(".md") || target.endsWith(".override.md")) {
        // single file
        if (existsSync(target)) {
          const size = statSync(target).size;
          const cap = aKey === "codex" ? CODEX_CAP_BYTES : null;
          const pct = cap ? ` (${((size / cap) * 100).toFixed(0)}% of 32 KiB cap)` : "";
          result = `OK (${size} bytes${pct})`;
        } else {
          result = `MISSING (${target})`;
          ok = false;
        }
      } else {
        // directory
        if (existsSync(target) && statSync(target).isDirectory()) {
          const count = readdirSync(target).filter((f) => !f.startsWith(".")).length;
          result = count > 0 ? `${count} file(s) OK` : `MISSING (empty dir at ${target})`;
          if (count === 0) ok = false;
        } else {
          result = `MISSING (${target})`;
          ok = false;
        }
      }
      log(`    ${ptype.padEnd(20)} ${target.replace(home, "~")}  ${result}`);
    }

    // Codex personal layer (only relevant for repo scope)
    if (aKey === "codex" && scope === "repo" && codexPersonalLayer) {
      const ovr = join(repoDir, "AGENTS.override.md");
      const status = existsSync(ovr) ? "OK, gitignored" : "MISSING";
      log(`    ${"override".padEnd(20)} ${ovr}  ${status}`);
      if (!existsSync(ovr)) ok = false;
    }

    log(`    test hint: ${a.testHint}`);
  }

  log("");
  if (ok) {
    log("All deployments verified.");
    return 0;
  } else {
    log("Verification FAILED — see MISSING entries above.");
    return 1;
  }
}

function expandTarget(p, home, repoDir) {
  if (!p) return null;
  if (p.startsWith("~/")) return join(home, p.slice(2));
  if (p.startsWith("/")) return p;
  return join(repoDir, p);
}
```

- [ ] **Step 2: Smoke check imports**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {verify} from './lib/verify.js'; console.log(typeof verify);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add lib/verify.js
git commit -m "feat: lib/verify.js post-install file checks + summary

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 12: lib/cli.js — argument parsing

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/cli.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/cli.js
// Tiny argv parser. Supports: agent-kit <command> [--flag value] [--bool]

export function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { command: args[0] ?? null, flags: {}, positional: [] };
  let i = 1;
  while (i < args.length) {
    const tok = args[i];
    if (tok.startsWith("--")) {
      const key = tok.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out.flags[key] = true;
        i += 1;
      } else {
        out.flags[key] = next;
        i += 2;
      }
    } else {
      out.positional.push(tok);
      i += 1;
    }
  }
  return out;
}

export function helpText() {
  return [
    "agent-kit — wizard for AI agent artifact deployment",
    "",
    "Usage:",
    "  agent-kit init [--preset NAME] [--agents claude,codex] [--scope repo|global] [--primitives '+x,-y'] [--codex-personal-layer] [--yes]",
    "  agent-kit update [--content-only|--adopt-preset-defaults|--dry-run]",
    "  agent-kit test     # delegates to bash test/run-tests.sh",
    "  agent-kit help",
    "",
  ].join("\n");
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {parseArgs} from './lib/cli.js'; console.log(parseArgs(['node','agent-kit','init','--preset','personal','--yes']));"
```

Expected: `{ command: 'init', flags: { preset: 'personal', yes: true }, positional: [] }`

- [ ] **Step 3: Commit**

```bash
git add lib/cli.js
git commit -m "feat: lib/cli.js minimal argv parser

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 13: lib/init.js — interactive 5-step init flow

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/init.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/init.js
// 5-step init wizard: preset → primitives → agents → scope → apply.
// Supports both interactive (clack prompts) and non-interactive (flags) modes.

import { intro, outro, select, multiselect, confirm, isCancel, log as clackLog } from "@clack/prompts";
import { listPresetNames, loadPreset } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { AGENTS, listAgentKeys } from "./agents.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export async function runInit({ flags, repoDir, kitRoot }) {
  const interactive = !flags.yes;
  if (interactive) intro("agent-kit init");

  // Step 1: preset
  const preset = await pickPreset(flags, interactive);

  // Step 2: customize primitives (delta from preset)
  const primitives = await pickPrimitives(flags, preset, interactive);

  // Step 3: agents
  const agents = await pickAgents(flags, preset, interactive);

  // Step 4: scope
  const scope = await pickScope(flags, interactive);

  // Step 4b: codex personal layer (conditional)
  let codexPersonalLayer = false;
  if (scope === "repo" && agents.includes("codex")) {
    codexPersonalLayer = await pickCodexPersonalLayer(flags, interactive);
  }

  // Step 5: apply
  if (interactive) {
    const ok = await confirm({ message: "Apply changes?" });
    if (!ok || isCancel(ok)) {
      outro("Cancelled. No changes made.");
      return 1;
    }
  }

  deploy({
    repoDir,
    kitRoot,
    preset,
    agents,
    scope,
    primitives,
    codexPersonalLayer,
  });

  const code = verify({ repoDir, agents, scope, primitives, codexPersonalLayer });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

async function pickPreset(flags, interactive) {
  if (flags.preset) {
    return loadPreset(String(flags.preset));
  }
  const choice = await select({
    message: "Pick a preset",
    options: listPresetNames().sort().map((n) => ({ value: n, label: n })),
  });
  if (isCancel(choice)) throw new Error("cancelled");
  return loadPreset(choice);
}

async function pickPrimitives(flags, preset, interactive) {
  // Start from preset's primitives; apply +/- deltas if --primitives flag provided.
  const result = JSON.parse(JSON.stringify(preset.primitives));
  if (flags.primitives) {
    applyPrimitiveDelta(result, String(flags.primitives));
  }

  if (!interactive) return result;

  const all = listAllPrimitives();
  for (const ptype of ["instructions", "prompts", "skills", "mcp", "hooks"]) {
    if (all[ptype].length === 0) continue;
    const opts = all[ptype].map((p) => ({
      value: p.name,
      label: `${p.name} — ${p.description}`,
    }));
    const initial = result[ptype] ?? [];
    const picked = await multiselect({
      message: `${ptype} (space toggle, enter confirm)`,
      options: opts,
      initialValues: initial,
      required: false,
    });
    if (isCancel(picked)) throw new Error("cancelled");
    result[ptype] = picked;
  }
  return result;
}

function applyPrimitiveDelta(primitives, spec) {
  // Format: "+name1,-name2,+name3" (type inferred from existing; we add to instructions if unknown)
  for (const tok of spec.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const op = t[0];
    const name = t.slice(1);
    if (op === "+") {
      // Add to whichever type owns this primitive in disk
      const types = ["instructions", "prompts", "skills", "mcp", "hooks"];
      for (const ptype of types) {
        if (!primitives[ptype].includes(name)) {
          primitives[ptype].push(name);
          break;
        }
      }
    } else if (op === "-") {
      for (const ptype of Object.keys(primitives)) {
        primitives[ptype] = primitives[ptype].filter((x) => x !== name);
      }
    }
  }
}

async function pickAgents(flags, preset, interactive) {
  if (flags.agents) {
    return String(flags.agents).split(",").map((s) => s.trim());
  }
  if (!interactive) return preset.default_agents;

  const initial = preset.default_agents;
  const picked = await multiselect({
    message: "Which agents in this repo?",
    options: listAgentKeys().map((k) => ({ value: k, label: AGENTS[k].label })),
    initialValues: initial,
    required: true,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

async function pickScope(flags, interactive) {
  if (flags.scope) return String(flags.scope);
  if (!interactive) return "repo";
  const picked = await select({
    message: "Where should these primitives live?",
    options: [
      { value: "repo", label: "Repo-scoped (committed by default; per-repo)" },
      { value: "global", label: "Global (~/.claude/, ~/.codex/AGENTS.md; available everywhere)" },
    ],
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

async function pickCodexPersonalLayer(flags, interactive) {
  if (flags["codex-personal-layer"] !== undefined) {
    return Boolean(flags["codex-personal-layer"]);
  }
  if (!interactive) return false;
  const picked = await select({
    message: "Codex personal layer (AGENTS.override.md, gitignored)?",
    options: [
      { value: false, label: "No (commit to AGENTS.md)" },
      { value: true,  label: "Yes (write AGENTS.override.md, gitignored)" },
    ],
  });
  if (isCancel(picked)) return false;
  return picked;
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {runInit} from './lib/init.js'; console.log(typeof runInit);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add lib/init.js
git commit -m "feat: lib/init.js 5-step interactive wizard

Supports interactive (clack) and non-interactive (flags) modes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 14: lib/update.js — update flow with delta detection

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/update.js`

- [ ] **Step 1: Write the module**

```javascript
// lib/update.js
// 3-step update flow: refresh content, optionally adopt new primitives, handle removed.

import { intro, outro, multiselect, isCancel, log as clackLog } from "@clack/prompts";
import { loadPreset } from "./presets.js";
import { listAllPrimitives } from "./primitives.js";
import { readState, readKitVersion } from "./state.js";
import { deploy } from "./deploy.js";
import { verify } from "./verify.js";

export async function runUpdate({ flags, repoDir, kitRoot }) {
  const interactive = !flags["content-only"] && !flags["adopt-preset-defaults"] && !flags["dry-run"];
  const dryRun = Boolean(flags["dry-run"]);
  const contentOnly = Boolean(flags["content-only"]);
  const adoptDefaults = Boolean(flags["adopt-preset-defaults"]);

  const state = readState(repoDir);
  if (!state) {
    process.stderr.write(`No .agent-kit.yaml found in ${repoDir}. Run \`agent-kit init\` first.\n`);
    return 2;
  }
  const newKitVersion = readKitVersion(kitRoot);

  if (interactive) intro(`agent-kit update — ${state.kit_version_at_last_run} → ${newKitVersion}`);

  const preset = loadPreset(state.preset);
  const all = listAllPrimitives();

  // Step 1: refresh content (always — apm install --update --force re-runs)
  const refreshLog = `Step 1/3  Refresh existing primitives`;
  if (interactive) clackLog.info(refreshLog);

  // Step 2: detect new primitives
  const newInPreset = computeNewInPreset(preset, all, state);
  const newOther = computeNewElsewhere(all, preset, state);

  let adopted = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };

  if (contentOnly) {
    // Skip step 2
  } else if (adoptDefaults) {
    adopted = mergePrimitiveLists(adopted, newInPreset);
  } else if (interactive) {
    const sel = await promptAdopt(newInPreset, newOther);
    adopted = sel;
  }

  // Step 3: removed primitives
  const removed = computeRemoved(preset, all, state);
  // For MVP, just warn — don't remove from apm.yml automatically
  if (removed.length > 0 && interactive) {
    clackLog.warn(`Removed/renamed primitives detected: ${removed.join(", ")} — will be dropped from apm.yml`);
  }

  // Compose final primitives = state's primitives + adopted - removed
  const finalPrimitives = applyPrimitiveOps(state.primitives_at_last_run, adopted, removed);

  if (dryRun) {
    process.stdout.write(`Dry run — would adopt:\n${JSON.stringify(adopted, null, 2)}\nRemoved:\n${JSON.stringify(removed, null, 2)}\n`);
    return 0;
  }

  deploy({
    repoDir,
    kitRoot,
    preset,
    agents: state.selected_agents,
    scope: state.scope,
    primitives: finalPrimitives,
    codexPersonalLayer: state.codex_personal_layer,
    isUpdate: true,
  });

  const code = verify({
    repoDir,
    agents: state.selected_agents,
    scope: state.scope,
    primitives: finalPrimitives,
    codexPersonalLayer: state.codex_personal_layer,
  });

  if (interactive) outro(code === 0 ? "Done." : "Verification failed.");
  return code;
}

function computeNewInPreset(preset, all, state) {
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
  for (const ptype of Object.keys(out)) {
    const have = new Set(state.primitives_at_last_run?.[ptype] ?? []);
    for (const name of preset.primitives[ptype] ?? []) {
      if (have.has(name)) continue;
      const meta = (all[ptype] ?? []).find((p) => p.name === name);
      if (meta && versionGT(meta.addedIn, state.kit_version_at_last_run)) {
        out[ptype].push(name);
      } else if (!have.has(name)) {
        // primitive in preset not in user's apm.yml (regardless of added_in) — probably a delta
        out[ptype].push(name);
      }
    }
  }
  return out;
}

function computeNewElsewhere(all, preset, state) {
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
  for (const ptype of Object.keys(out)) {
    const inPreset = new Set(preset.primitives[ptype] ?? []);
    const have = new Set(state.primitives_at_last_run?.[ptype] ?? []);
    for (const p of all[ptype] ?? []) {
      if (inPreset.has(p.name) || have.has(p.name)) continue;
      if (versionGT(p.addedIn, state.kit_version_at_last_run)) {
        out[ptype].push(p.name);
      }
    }
  }
  return out;
}

function computeRemoved(preset, all, state) {
  // A primitive in state but no longer findable on disk
  const removed = [];
  for (const ptype of Object.keys(state.primitives_at_last_run ?? {})) {
    for (const name of state.primitives_at_last_run[ptype] ?? []) {
      const found = (all[ptype] ?? []).some((p) => p.name === name);
      if (!found) removed.push(`${ptype}/${name}`);
    }
  }
  return removed;
}

function mergePrimitiveLists(a, b) {
  const out = JSON.parse(JSON.stringify(a));
  for (const k of Object.keys(b)) {
    out[k] = uniq([...(out[k] ?? []), ...b[k]]);
  }
  return out;
}

function applyPrimitiveOps(base, adopted, removedQualified) {
  const out = JSON.parse(JSON.stringify(base ?? { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] }));
  for (const k of Object.keys(adopted)) {
    out[k] = uniq([...(out[k] ?? []), ...adopted[k]]);
  }
  for (const r of removedQualified) {
    const [ptype, name] = r.split("/");
    if (out[ptype]) out[ptype] = out[ptype].filter((x) => x !== name);
  }
  return out;
}

function uniq(arr) { return Array.from(new Set(arr)); }

function versionGT(a, b) {
  const pa = String(a ?? "0.0.0").split(".").map(Number);
  const pb = String(b ?? "0.0.0").split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function promptAdopt(newInPreset, newOther) {
  const out = { instructions: [], prompts: [], skills: [], mcp: [], hooks: [] };
  for (const ptype of Object.keys(out)) {
    const candidates = [...newInPreset[ptype], ...newOther[ptype]];
    if (candidates.length === 0) continue;
    const picked = await multiselect({
      message: `Adopt ${ptype}? (space toggle, enter skip)`,
      options: candidates.map((n) => ({ value: n, label: n })),
      required: false,
    });
    if (isCancel(picked)) continue;
    out[ptype] = picked;
  }
  return out;
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
node --input-type=module -e "import {runUpdate} from './lib/update.js'; console.log(typeof runUpdate);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add lib/update.js
git commit -m "feat: lib/update.js 3-step update flow with delta detection

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 15: lib/wizard.js — entrypoint dispatcher

**Files:**
- Create: `D:/GitRepos/my-agent-kits/lib/wizard.js`

- [ ] **Step 1: Write the module**

```javascript
#!/usr/bin/env node
// lib/wizard.js — entrypoint. Dispatches to init/update/test/help.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, helpText } from "./cli.js";
import { runInit } from "./init.js";
import { runUpdate } from "./update.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = dirname(HERE);
const CWD = process.cwd();

const { command, flags } = parseArgs(process.argv);

(async function main() {
  try {
    switch (command) {
      case "init": {
        const code = await runInit({ flags, repoDir: CWD, kitRoot: KIT_ROOT });
        process.exit(code);
      }
      case "update": {
        const code = await runUpdate({ flags, repoDir: CWD, kitRoot: KIT_ROOT });
        process.exit(code);
      }
      case "test": {
        const r = spawnSync("bash", [`${KIT_ROOT}/test/run-tests.sh`], { stdio: "inherit", shell: process.platform === "win32" });
        process.exit(r.status ?? 1);
      }
      case "help":
      case undefined:
      case null:
        process.stdout.write(helpText());
        process.exit(0);
      default:
        process.stderr.write(`Unknown command: ${command}\n\n${helpText()}`);
        process.exit(2);
    }
  } catch (e) {
    process.stderr.write(`Error: ${e.message}\n`);
    if (process.env.AGENT_KIT_DEBUG) process.stderr.write(`${e.stack}\n`);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Smoke check (help)**

```bash
cd D:/GitRepos/my-agent-kits
npm install --no-audit --no-fund --silent
node lib/wizard.js help | head -10
```

Expected: prints help text starting with "agent-kit — wizard for AI agent artifact deployment".

- [ ] **Step 3: Commit**

```bash
git add lib/wizard.js package-lock.json
git commit -m "feat: lib/wizard.js entrypoint dispatcher

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase D: Distribution

### Task 16: bin/agent-kit shell shim

**Files:**
- Create: `D:/GitRepos/my-agent-kits/bin/agent-kit`

- [ ] **Step 1: Write the shim**

```bash
#!/usr/bin/env bash
# Tiny launcher: resolve our install dir, exec the Node entrypoint.

set -e

# Resolve the symlink target to find the real install dir
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
DIR="$( cd -P "$( dirname "$SOURCE" )/.." && pwd )"

exec node "$DIR/lib/wizard.js" "$@"
```

- [ ] **Step 2: Make executable, smoke test**

```bash
cd D:/GitRepos/my-agent-kits
chmod +x bin/agent-kit
bin/agent-kit help | head -5
```

Expected: same help output.

- [ ] **Step 3: Commit**

```bash
git add bin/agent-kit
git commit -m "feat: bin/agent-kit shell launcher

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 17: bootstrap.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/bootstrap.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# One-time setup: install deps + add agent-kit to PATH.
# Idempotent: safe to re-run.

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Bootstrap from $DIR"

# 1. Verify Node and apm
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node 20+ is required. Install from https://nodejs.org" >&2
  exit 1
fi
if ! command -v apm >/dev/null 2>&1; then
  echo "Error: APM CLI is required. Install via 'scoop install apm' or see https://github.com/microsoft/apm" >&2
  exit 1
fi

# 2. Install Node deps
echo "[1/2] npm install"
( cd "$DIR" && npm install --no-audit --no-fund --silent )

# 3. PATH setup — symlink to ~/.local/bin if available, else write a profile line
LINK_TARGET="$HOME/.local/bin/agent-kit"
SOURCE_BIN="$DIR/bin/agent-kit"

mkdir -p "$HOME/.local/bin"

if [ -L "$LINK_TARGET" ] || [ -f "$LINK_TARGET" ]; then
  rm -f "$LINK_TARGET"
fi
ln -s "$SOURCE_BIN" "$LINK_TARGET" 2>/dev/null || cp "$SOURCE_BIN" "$LINK_TARGET"
chmod +x "$LINK_TARGET"
echo "[2/2] Linked $LINK_TARGET -> $SOURCE_BIN"

# 4. PATH check
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *)
    echo ""
    echo "Note: \$HOME/.local/bin is not on your PATH. Add this to ~/.bashrc:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    ;;
esac

echo ""
echo "Done. Try: agent-kit help"
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
chmod +x bootstrap.sh
bash bootstrap.sh 2>&1 | tail -10
which agent-kit && agent-kit help | head -3
```

Expected: bootstrap completes; `agent-kit` is on PATH; `agent-kit help` works.

- [ ] **Step 3: Commit**

```bash
git add bootstrap.sh
git commit -m "feat: bootstrap.sh one-time install + PATH setup

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase E: Test infrastructure

### Task 18: test/lib/assertions.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/lib/assertions.sh`

- [ ] **Step 1: Write the helpers**

```bash
#!/usr/bin/env bash
# Shared assertion helpers for test cases.

PASS=${PASS:-0}
FAIL=${FAIL:-0}

ok()   { echo "  [pass] $1"; PASS=$((PASS+1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

assert_file_exists() {
  local path="$1"; local label="${2:-$path}"
  if [ -f "$path" ]; then ok "$label exists"; else fail "$label missing ($path)"; fi
}

assert_dir_exists() {
  local path="$1"; local label="${2:-$path}"
  if [ -d "$path" ]; then ok "$label exists"; else fail "$label missing ($path)"; fi
}

assert_dir_nonempty() {
  local path="$1"; local label="${2:-$path}"
  if [ -d "$path" ] && [ -n "$(ls -A "$path" 2>/dev/null)" ]; then
    ok "$label non-empty"
  else
    fail "$label empty or missing ($path)"
  fi
}

assert_content_contains() {
  local path="$1"; local needle="$2"; local label="${3:-content match}"
  if [ -f "$path" ] && grep -q -F "$needle" "$path"; then
    ok "$label"
  else
    fail "$label (path=$path needle=$needle)"
  fi
}

assert_size_under() {
  local path="$1"; local max="$2"; local label="${3:-size}"
  if [ -f "$path" ]; then
    local sz; sz=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path")
    if [ "$sz" -le "$max" ]; then ok "$label ($sz <= $max)"; else fail "$label too large ($sz > $max)"; fi
  else
    fail "$label: file missing ($path)"
  fi
}

assert_exit_nonzero() {
  local cmd="$1"; local label="${2:-cmd should fail}"
  if eval "$cmd" >/dev/null 2>&1; then
    fail "$label — but it succeeded"
  else
    ok "$label"
  fi
}

# Compare sha256 of two files (or alt: just file contents)
assert_files_equal() {
  local a="$1"; local b="$2"; local label="${3:-files equal}"
  if cmp -s "$a" "$b"; then ok "$label"; else fail "$label ($a != $b)"; fi
}
```

- [ ] **Step 2: Smoke check**

```bash
cd D:/GitRepos/my-agent-kits
bash -n test/lib/assertions.sh && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add test/lib/assertions.sh
git commit -m "test: assertion helpers for case scripts

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 19: test/run-tests.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/run-tests.sh`

- [ ] **Step 1: Write the runner**

```bash
#!/usr/bin/env bash
# Iterate test/cases/*.sh, aggregate pass/fail.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="$( cd "$HERE/.." && pwd )"
export KIT_ROOT
TOTAL_PASS=0
TOTAL_FAIL=0
CASES_PASSED=()
CASES_FAILED=()

# Verify deps
command -v node >/dev/null || { echo "Error: node not found"; exit 1; }
command -v apm  >/dev/null || { echo "Error: apm not found";  exit 1; }
command -v git  >/dev/null || { echo "Error: git not found";  exit 1; }

# Ensure deps installed
[ ! -d "$KIT_ROOT/node_modules" ] && ( cd "$KIT_ROOT" && npm install --no-audit --no-fund --silent )

for case_script in "$HERE"/cases/*.sh; do
  case_name="$(basename "$case_script" .sh)"
  echo ""
  echo "[$case_name]"
  PASS=0
  FAIL=0
  if bash "$case_script"; then
    if [ "$FAIL" -eq 0 ]; then
      CASES_PASSED+=("$case_name")
    else
      CASES_FAILED+=("$case_name")
    fi
  else
    CASES_FAILED+=("$case_name")
  fi
  TOTAL_PASS=$((TOTAL_PASS + PASS))
  TOTAL_FAIL=$((TOTAL_FAIL + FAIL))
done

echo ""
echo "================================================================"
echo "Results: ${#CASES_PASSED[@]} cases passed, ${#CASES_FAILED[@]} cases failed"
echo "Asserts: $TOTAL_PASS passed, $TOTAL_FAIL failed"
[ ${#CASES_FAILED[@]} -gt 0 ] && {
  echo "Failed: ${CASES_FAILED[*]}"
  exit 1
}
exit 0
```

- [ ] **Step 2: Make executable, syntax check**

```bash
cd D:/GitRepos/my-agent-kits
chmod +x test/run-tests.sh
bash -n test/run-tests.sh && echo "syntax OK"
```

Expected: `syntax OK`

- [ ] **Step 3: Commit**

```bash
git add test/run-tests.sh
git commit -m "test: matrix runner aggregates cases/*.sh results

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 20: test/Dockerfile.test

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/Dockerfile.test`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# Test image: node, apm, git, bash. Each container run starts with a fresh $HOME.
FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates curl bash python3 \
    && rm -rf /var/lib/apt/lists/*

# Install APM CLI from the official Microsoft installer (Linux)
RUN curl -sSL https://aka.ms/apm-unix | sh \
    && (mv /root/.local/bin/apm /usr/local/bin/apm 2>/dev/null \
        || mv ~/.apm/bin/apm /usr/local/bin/apm 2>/dev/null \
        || true) \
    && which apm && apm --version

# Copy the kit
WORKDIR /kit
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .

# Bootstrap (link agent-kit into /usr/local/bin)
RUN ln -s /kit/bin/agent-kit /usr/local/bin/agent-kit && chmod +x /kit/bin/agent-kit

# Default: run the matrix
CMD ["bash", "/kit/test/run-tests.sh"]
```

- [ ] **Step 2: Build the image**

```bash
cd D:/GitRepos/my-agent-kits
docker build -q -f test/Dockerfile.test -t my-agent-kits-test .
```

Expected: image built with a SHA. If `apm install via curl` fails inside the container, fall back to: `npm install -g @microsoft/apm-cli` or pin to a specific apm version. Adjust the Dockerfile if needed.

- [ ] **Step 3: Commit**

```bash
git add test/Dockerfile.test
git commit -m "test: Dockerfile with node, apm, git base for matrix runs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 21: test/cases/claude-repo.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/cases/claude-repo.sh`

- [ ] **Step 1: Write the case**

```bash
#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Fresh sandbox repo
WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

# Run the wizard non-interactively
agent-kit init --preset personal --agents claude --scope repo --yes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Assertions
assert_file_exists "$WORK/apm.yml" "apm.yml"
assert_dir_nonempty "$WORK/.claude/rules" "rules"
assert_dir_nonempty "$WORK/.claude/commands" "commands"
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: personal" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "scope: repo" "scope recorded"
```

- [ ] **Step 2: Make executable, commit**

```bash
chmod +x D:/GitRepos/my-agent-kits/test/cases/claude-repo.sh
cd D:/GitRepos/my-agent-kits
git add test/cases/claude-repo.sh
git commit -m "test: case 1 — claude repo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 22: test/cases/claude-global.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/cases/claude-global.sh`

- [ ] **Step 1: Write the case**

```bash
#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Use the container's $HOME (Dockerfile sets up isolated home)
WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset personal --agents claude --scope global --yes \
  || { fail "agent-kit init --scope global exited non-zero"; exit 1; }

assert_dir_nonempty "$HOME/.claude/rules"    "global rules"
assert_dir_nonempty "$HOME/.claude/commands" "global commands"
```

- [ ] **Step 2: Make executable, commit**

```bash
chmod +x D:/GitRepos/my-agent-kits/test/cases/claude-global.sh
cd D:/GitRepos/my-agent-kits
git add test/cases/claude-global.sh
git commit -m "test: case 2 — claude global

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 23: test/cases/codex-repo.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/cases/codex-repo.sh`

- [ ] **Step 1: Write the case**

```bash
#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset personal --agents codex --scope repo --yes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

assert_file_exists "$WORK/AGENTS.md"     "AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Generated by APM"  "build-id marker"
assert_size_under "$WORK/AGENTS.md" 32768 "AGENTS.md size <= 32 KiB"
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
```

- [ ] **Step 2: Make executable, commit**

```bash
chmod +x D:/GitRepos/my-agent-kits/test/cases/codex-repo.sh
cd D:/GitRepos/my-agent-kits
git add test/cases/codex-repo.sh
git commit -m "test: case 3 — codex repo

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 24: test/cases/codex-global.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/cases/codex-global.sh`

- [ ] **Step 1: Write the case**

```bash
#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset personal --agents codex --scope global --yes \
  || { fail "agent-kit init --scope global exited non-zero"; exit 1; }

assert_file_exists "$HOME/.codex/AGENTS.md"  "global AGENTS.md"
assert_content_contains "$HOME/.codex/AGENTS.md" "Generated by APM"  "build-id marker"
# The wizard's copy step: ~/.apm/AGENTS.md should equal ~/.codex/AGENTS.md
assert_files_equal "$HOME/.apm/AGENTS.md" "$HOME/.codex/AGENTS.md" "global codex copy fidelity"
```

- [ ] **Step 2: Make executable, commit**

```bash
chmod +x D:/GitRepos/my-agent-kits/test/cases/codex-global.sh
cd D:/GitRepos/my-agent-kits
git add test/cases/codex-global.sh
git commit -m "test: case 4 — codex global

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 25: test/cases/update-content-only.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/cases/update-content-only.sh`

- [ ] **Step 1: Write the case**

```bash
#!/usr/bin/env bash
# Init at "v0.1.0", bump kit version + change a primitive's content,
# run agent-kit update --content-only, verify content refreshed AND
# state's kit_version_at_last_run bumps but apm.yml primitives unchanged.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Snapshot kit's package.json version + a primitive's content
ORIG_PKG="$(cat $KIT_ROOT/package.json)"
ORIG_CORE="$(cat $KIT_ROOT/primitives/instructions/core.instructions.md)"

restore() {
  echo "$ORIG_PKG"  > "$KIT_ROOT/package.json"
  echo "$ORIG_CORE" > "$KIT_ROOT/primitives/instructions/core.instructions.md"
}
trap restore EXIT

# Init at v0.1.0
WORK="$(mktemp -d)"; cd "$WORK"; git init -q .
agent-kit init --preset personal --agents claude --scope repo --yes >/dev/null

# Capture initial state
INITIAL_VERSION="$(grep kit_version_at_last_run .agent-kit.yaml | awk '{print $2}')"

# Bump kit version + mutate one primitive
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$KIT_ROOT/package.json'));p.version='0.2.0';fs.writeFileSync('$KIT_ROOT/package.json',JSON.stringify(p,null,2));"
echo "" >> "$KIT_ROOT/primitives/instructions/core.instructions.md"
echo "## Added in v0.2.0" >> "$KIT_ROOT/primitives/instructions/core.instructions.md"

# Run update --content-only
agent-kit update --content-only --yes >/dev/null \
  || { fail "agent-kit update exited non-zero"; exit 1; }

# Assertions
NEW_VERSION="$(grep kit_version_at_last_run .agent-kit.yaml | awk '{print $2}')"
[ "$NEW_VERSION" = "0.2.0" ] && ok "kit_version bumped to 0.2.0" || fail "kit_version not bumped (got $NEW_VERSION)"
assert_content_contains "$WORK/.claude/rules/core.md" "Added in v0.2.0" "v0.2.0 content visible after update"
```

- [ ] **Step 2: Make executable, commit**

```bash
chmod +x D:/GitRepos/my-agent-kits/test/cases/update-content-only.sh
cd D:/GitRepos/my-agent-kits
git add test/cases/update-content-only.sh
git commit -m "test: case 5 — update content-only

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 26: test/cases/update-adopt-defaults.sh

**Files:**
- Create: `D:/GitRepos/my-agent-kits/test/cases/update-adopt-defaults.sh`

- [ ] **Step 1: Write the case**

```bash
#!/usr/bin/env bash
# Init with `minimal` preset (just core instruction).
# Bump kit version, add a new primitive (react.instructions.md) AND extend
# minimal preset to include it. Run update --adopt-preset-defaults.
# Verify react was auto-adopted into apm.yml.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

ORIG_PKG="$(cat $KIT_ROOT/package.json)"
ORIG_PRESET="$(cat $KIT_ROOT/presets/minimal.yaml)"

cleanup() {
  echo "$ORIG_PKG" > "$KIT_ROOT/package.json"
  echo "$ORIG_PRESET" > "$KIT_ROOT/presets/minimal.yaml"
  rm -f "$KIT_ROOT/primitives/instructions/react.instructions.md"
}
trap cleanup EXIT

WORK="$(mktemp -d)"; cd "$WORK"; git init -q .
agent-kit init --preset minimal --agents claude --scope repo --yes >/dev/null

# Bump version, add primitive, extend preset
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$KIT_ROOT/package.json'));p.version='0.2.0';fs.writeFileSync('$KIT_ROOT/package.json',JSON.stringify(p,null,2));"

cat > "$KIT_ROOT/primitives/instructions/react.instructions.md" <<'EOF'
---
description: React conventions (test fixture)
applyTo: "**/*.{tsx,jsx}"
added_in: 0.2.0
---

Use functional components.
EOF

# Add 'react' to minimal preset
node -e "
const fs=require('fs'); const yaml=require('yaml');
const p=yaml.parse(fs.readFileSync('$KIT_ROOT/presets/minimal.yaml','utf8'));
p.primitives.instructions.push('react');
fs.writeFileSync('$KIT_ROOT/presets/minimal.yaml', yaml.stringify(p));
"

# Update with auto-adopt
agent-kit update --adopt-preset-defaults --yes >/dev/null \
  || { fail "agent-kit update exited non-zero"; exit 1; }

# Assertions
assert_content_contains "$WORK/.agent-kit.yaml" "react" "react primitive in state"
assert_file_exists "$WORK/.claude/rules/react.md" "react rule deployed"
```

- [ ] **Step 2: Make executable, commit**

```bash
chmod +x D:/GitRepos/my-agent-kits/test/cases/update-adopt-defaults.sh
cd D:/GitRepos/my-agent-kits
git add test/cases/update-adopt-defaults.sh
git commit -m "test: case 6 — update adopt-preset-defaults

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase F: Run the matrix

### Task 27: Run the full matrix in Docker, iterate until 6/6 green

**Files:** none (verification step)

- [ ] **Step 1: Build the test image**

```bash
cd D:/GitRepos/my-agent-kits
docker build -q -f test/Dockerfile.test -t my-agent-kits-test .
```

Expected: image SHA printed.

- [ ] **Step 2: Run the matrix**

```bash
docker run --rm my-agent-kits-test 2>&1 | tail -25
```

Expected (eventually):
```
================================================================
Results: 6 cases passed, 0 cases failed
Asserts: N passed, 0 failed
```

- [ ] **Step 3: For each failing case, debug and fix**

Common failure modes and fixes:
- **APM install fails inside container:** Try alternative install path in Dockerfile (e.g., `pip install apm-cli` if Microsoft confirms that name; or `RUN curl -sSL https://aka.ms/apm-unix | sh -s -- --version 0.12.4`).
- **APM compile produces wrong file path:** Check that `~/.apm/AGENTS.md` exists post-compile in global mode; adjust `lib/deploy.js` if APM behavior differs from what we observed in the spike.
- **Primitive frontmatter rejected:** Check warnings — APM may require additional fields. Update primitives + revise frontmatter spec.
- **Path issues on Linux vs Windows:** All scripts run inside Linux container; Windows-only path handling in `lib/` should be guarded by `path.join` + `os.homedir()` (already are).

- [ ] **Step 4: Commit any fixes**

```bash
cd D:/GitRepos/my-agent-kits
git add -A
git commit -m "fix: resolve test matrix failures

[Describe specific fixes here]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Re-run matrix; do not proceed past Phase F until all 6 green**

```bash
docker run --rm my-agent-kits-test 2>&1 | tail -5
```

Expected: `Results: 6 cases passed, 0 cases failed`.

---

## Phase G: Documentation

### Task 28: README.md

**Files:**
- Modify: `D:/GitRepos/my-agent-kits/README.md` (replace the placeholder pointing-at-spec content)

- [ ] **Step 1: Rewrite README.md**

```markdown
# my-agent-kits

Personal AI agent artifact wizard for Claude Code and Codex CLI. Bootstrap or update any repo's agent setup with one command.

## Install (one time per machine)

```bash
git clone git@github.com:superliaye/my-agent-kits.git ~/my-agent-kits
cd ~/my-agent-kits && bash bootstrap.sh
```

Requires Node 20+, APM CLI (`scoop install apm` on Windows, `curl -sSL https://aka.ms/apm-unix | sh` on macOS/Linux), and Git.

## Usage

```bash
cd ~/work/some-repo
agent-kit init        # interactive 5-step wizard
agent-kit update      # catch up to latest kit
agent-kit help
```

Non-interactive (CI / scripting):

```bash
agent-kit init --preset personal --agents claude,codex --scope repo --yes
agent-kit update --content-only
agent-kit update --adopt-preset-defaults
```

## What's in here

| Path | Purpose |
|---|---|
| `presets/*.yaml` | Bundled artifact selections (`personal`, `microsoft`, `minimal`, `none`) |
| `primitives/instructions/*.instructions.md` | Always-loaded rules |
| `primitives/prompts/*.prompt.md` | Slash-command prompts |
| `primitives/skills/`, `primitives/mcp/`, `primitives/hooks/` | Reserved for v0.2 |
| `bin/agent-kit` | Launcher (symlinked to `~/.local/bin/`) |
| `lib/wizard.js` + `lib/*.js` | Wizard implementation (Node 20+) |
| `test/` | Docker-based test matrix |

## Spec

Full design in [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md).
```

- [ ] **Step 2: Commit**

```bash
cd D:/GitRepos/my-agent-kits
git add README.md
git commit -m "docs: README with install + usage

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 29: CLAUDE.md (maintenance guide for agents)

**Files:**
- Create: `D:/GitRepos/my-agent-kits/CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

```markdown
# my-agent-kits — Agent Context

Wizard repo: deploys personal AI agent artifacts to Claude Code and Codex CLI via APM.

## File Map

| File | Purpose | When to modify |
|---|---|---|
| `presets/*.yaml` | Curated primitive bundles | Adding a new preset or editing membership |
| `primitives/instructions/*.instructions.md` | Always-loaded rules; need YAML frontmatter (`description`, `applyTo`, `added_in`) | Adding a rule |
| `primitives/prompts/*.prompt.md` | Slash commands; same frontmatter requirements | Adding a slash command |
| `lib/wizard.js` | Entrypoint; argv dispatcher | Adding a new top-level command |
| `lib/init.js`, `lib/update.js` | Wizard flows | Changing wizard UX |
| `lib/agents.js` | Per-agent capability table | Adding/changing an agent target |
| `lib/deploy.js` | APM orchestration + post-steps | Changing how APM is invoked |
| `test/cases/*.sh` | One per matrix cell | Adding a new agent×scope or bug repro |

## Rules

- **Two supported agents only:** Claude Code and Codex CLI. Don't add others without expanding the spec.
- **Every primitive MUST have frontmatter:** `description`, `applyTo`, `added_in`. APM warns otherwise; tests will fail.
- **Bump `kit version` (`package.json`) when adding a primitive.** Set the new primitive's `added_in` to that version. Update flow's delta detection depends on it.
- **Test before commit:** `docker run --rm my-agent-kits-test` (or `bash test/run-tests.sh` if Docker unavailable).
- **Don't introduce non-MVP scope without spec update.** Hooks, MCP, additional agents: spec first, then code.

## Common Tasks

**Add a new instruction primitive:**
1. Bump `package.json` version (e.g., `0.1.0` → `0.2.0`).
2. Create `primitives/instructions/<name>.instructions.md` with frontmatter (incl. `added_in: 0.2.0`).
3. Optionally add to a preset's `primitives.instructions` list.
4. Run matrix to confirm nothing broke.
5. Commit with message `feat(primitives): add <name> instruction`.

**Add a new preset:**
1. Create `presets/<name>.yaml`.
2. Optionally `extends:` an existing preset.
3. Add a smoke test using it (case script).
4. Run matrix.

**Debug a failing test case:**
1. Run only that case: `KIT_ROOT=$(pwd) bash test/cases/<name>.sh` (outside Docker for fast iteration).
2. If it relies on global state, run inside the container: `docker run --rm -it my-agent-kits-test bash`.
3. Re-run matrix when fixed.

## Spec & Plan

- Spec: [`docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md`](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md)
- Plan: [`docs/superpowers/plans/2026-05-08-agent-kit-installer.md`](docs/superpowers/plans/2026-05-08-agent-kit-installer.md)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md maintenance guide

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Task 30: CHANGELOG.md

**Files:**
- Create: `D:/GitRepos/my-agent-kits/CHANGELOG.md`

- [ ] **Step 1: Write CHANGELOG.md**

```markdown
# Changelog

All notable changes to this package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] - 2026-05-08

### Added
- Interactive wizard `agent-kit init` (5-step) and `agent-kit update` (3-step)
- Non-interactive flags for both commands
- 4 presets: `personal`, `microsoft`, `minimal`, `none`
- 2 instruction primitives + 6 prompt primitives migrated from `personal-agent-kit`
- Docker-based test matrix (6 cases: 4 init + 2 update); all green
- Bootstrap script (`bootstrap.sh`) and PATH-installable launcher (`bin/agent-kit`)
- State tracking via `.agent-kit.yaml` per repo
- Codex global copy step (APM gap-plug)
- Codex personal layer (`AGENTS.override.md` + `.gitignore`) for Codex repos

### Changed
- Folded `superliaye/personal-agent-kit` primitives in; that repo will be archived once this is operational.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG for v0.1.0

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase H: Multi-agent code review

The user explicitly requested: "Spawned multi agents to review and incorporate the results."

### Task 31: Spawn parallel reviewer agents

**Files:** none (review step)

- [ ] **Step 1: Dispatch 3 reviewer agents in parallel via Agent tool**

In a single message, launch:
1. `superpowers:code-reviewer` — full repo review against the spec, looking for missing requirements, broken contracts.
2. `general-purpose` — security and reliability review of `lib/deploy.js` (subprocess-spawning, file-write paths, error handling).
3. `general-purpose` — UX review of the wizard prompts in `lib/init.js` and `lib/update.js` (clarity, defaults, edge cases).

Each agent gets:
- Full path to spec, plan, and source files
- The completion criteria (6/6 matrix green)
- Instructions to report `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` findings with file:line references
- A length cap (300-500 words each)

- [ ] **Step 2: Triage findings**

For each reported finding:
- `CRITICAL` / `HIGH`: must fix before sign-off. Open as inline tasks.
- `MEDIUM`: discuss with user; fix if quick.
- `LOW`: log in CHANGELOG or defer.

- [ ] **Step 3: Apply fixes; re-run matrix**

```bash
docker run --rm my-agent-kits-test 2>&1 | tail -3
```

Expected: still 6/6 green after fixes.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: incorporate findings from multi-agent code review

[Summarize per-finding fixes here]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Sign-of-completion checklist

- [ ] All Tasks 1–30 complete and committed
- [ ] `docker run --rm my-agent-kits-test` reports `6 cases passed, 0 cases failed`
- [ ] Multi-agent review (Task 31) findings triaged; CRITICAL/HIGH fixed
- [ ] `agent-kit help` works from any directory after `bash bootstrap.sh`
- [ ] `agent-kit init --preset minimal --agents claude --scope repo --yes` deploys cleanly in a throwaway repo
- [ ] **Follow-up (manual, after sign-off):** Archive `superliaye/personal-agent-kit` on GitHub: `gh repo archive superliaye/personal-agent-kit -y` and update its README to point at `my-agent-kits`. Don't delete — history preserved.

---

## Risks & escalation

| If this happens | Do this |
|---|---|
| APM install fails inside the Docker image | Try `pip install apm-cli` or pin a specific Linux release URL. Update Task 20's Dockerfile. |
| APM `compile` puts AGENTS.md in a different location than `~/.apm/AGENTS.md` for global | Update `lib/deploy.js` Codex global copy step to read the correct source path. Re-test cases 4 and 5. |
| `@clack/prompts` API changed | Pin to `^0.7.x` in `package.json`; if API truly broke, fall back to `node:readline` for the prompts (smaller dependency). |
| The test matrix takes >5 minutes per run | Cache the Docker image; pre-install `npm` deps in the image so per-case run is fast. |
| Primitive frontmatter regression breaks existing personal-agent-kit consumers | Don't break compatibility — Task 1's frontmatter additions are additive. |

If a task can't be completed as written, document why in a follow-up commit and surface to the user before proceeding.
