import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { listAllCapabilities, parseFrontmatter } from "../../lib/capabilities.js";
import { loadPreset } from "../../lib/presets.js";

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MATT_ROOT = join(KIT_ROOT, "capabilities", "skills", "@matt-pocock");
const PINNED_COMMIT = "6654f6b60cd9d5be8b54c6fafe44346dabeb3b76";
const UPSTREAM_VERSION = "2026-08-24 (6654f6b)";

const engineering = [
  "code-review",
  "codebase-design",
  "diagnosing-bugs",
  "domain-modeling",
  "grill-with-docs",
  "implement",
  "improve-codebase-architecture",
  "prototype",
  "research",
  "resolving-merge-conflicts",
  "tdd",
  "to-spec",
  "triage",
  "wayfinder",
  "wizard",
];

const productivity = [
  "grill-me",
  "grilling",
  "handoff",
  "teach",
  "to-questionnaire",
  "wait-what",
  "writing-for-agents",
];

const selected = [...engineering, ...productivity].sort();
const loopClosure = [
  "codebase-design",
  "diagnosing-bugs",
  "domain-modeling",
  "grill-with-docs",
  "grilling",
  "improve-codebase-architecture",
].sort();

const excluded = [
  "ask-matt",
  "setup-matt-pocock-skills",
  "to-tickets",
  "to-issues",
  "diagnose",
  "to-prd",
  "write-a-skill",
  "caveman",
  "zoom-out",
];

const descriptions = {
  "code-review": "Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\".",
  "codebase-design": "Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunities, decide where a seam goes, make code more testable or AI-navigable, or when another skill needs the deep-module vocabulary.",
  "diagnosing-bugs": "Diagnosis loop for hard bugs and performance regressions. Use when the user says \"diagnose\"/\"debug this\", or reports something broken/throwing/failing/slow.",
  "domain-modeling": "Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a CONTEXT.md, or recording or editing an ADR.",
  "grill-me": "A relentless interview to sharpen a plan or design.",
  "grill-with-docs": "A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.",
  "grilling": "Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.",
  "handoff": "Compact the current conversation into a handoff document for another agent to pick up.",
  "implement": "Implement a piece of work based on a spec or set of tickets.",
  "improve-codebase-architecture": "Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.",
  "prototype": "Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like.",
  "research": "Investigate a question against high-trust primary sources and capture the findings as a Markdown file. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.",
  "resolving-merge-conflicts": "Use when you need to resolve an in-progress git merge/rebase conflict.",
  "tdd": "Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions \"red-green-refactor\", or wants integration tests.",
  "teach": "Teach the user a new skill or concept, within this workspace.",
  "to-questionnaire": "Turn a decision you can't fully answer into a questionnaire for someone else to fill in.",
  "to-spec": "Turn the current conversation into a spec and publish it to the project issue tracker: no interview, just synthesis of what you've already discussed.",
  "triage": "Move issues and external PRs through a state machine of triage roles, categorise, verify, grill if needed, and write agent-ready briefs.",
  "wait-what": "Stop. That last message did not land: re-pitch it.",
  "wayfinder": "Plan a huge chunk of work (more than one agent session can hold) as a shared map of decision tickets on your issue tracker, and resolve them one at a time until the way to the destination is clear.",
  "wizard": "Generate an interactive bash wizard that walks a human through steps only they can perform. Use when provisioning infrastructure, setting up credentials or CI secrets, walking an unfamiliar third-party dashboard, or running a one-off migration or cutover. Don't invoke this for steps the agent can perform itself.",
  "writing-for-agents": "Writing documents for agents. Use when creating or editing skills, or modifying AGENTS.md or CLAUDE.md.",
};

const manualOnly = new Set([
  "grill-me",
  "grill-with-docs",
  "handoff",
  "implement",
  "improve-codebase-architecture",
  "teach",
  "to-questionnaire",
  "to-spec",
  "triage",
  "wait-what",
  "wayfinder",
]);

const argumentHints = {
  handoff: "What will the next session be used for?",
  teach: "What would you like to learn about?",
};

const retainedAddedIn = {
  "grill-me": "0.7.0",
  "grill-with-docs": "0.4.0",
  handoff: "0.12.0",
  "improve-codebase-architecture": "0.4.0",
  prototype: "0.12.0",
  tdd: "0.16.0",
  teach: "0.20.0",
};

const runtimeFiles = {
  "code-review": ["SKILL.md"],
  "codebase-design": ["DEEPENING.md", "DESIGN-IT-TWICE.md", "SKILL.md"],
  "diagnosing-bugs": ["SKILL.md", "scripts/hitl-loop.template.sh"],
  "domain-modeling": ["ADR-FORMAT.md", "CONTEXT-FORMAT.md", "SKILL.md"],
  "grill-me": ["SKILL.md"],
  "grill-with-docs": ["SKILL.md"],
  grilling: ["SKILL.md"],
  handoff: ["SKILL.md"],
  implement: ["SKILL.md"],
  "improve-codebase-architecture": ["HTML-REPORT.md", "SKILL.md"],
  prototype: ["LOGIC.md", "SKILL.md", "UI.md"],
  research: ["SKILL.md"],
  "resolving-merge-conflicts": ["SKILL.md"],
  tdd: ["SKILL.md", "mocking.md", "tests.md"],
  teach: ["GLOSSARY-FORMAT.md", "LEARNING-RECORD-FORMAT.md", "MISSION-FORMAT.md", "RESOURCES-FORMAT.md", "SKILL.md"],
  "to-questionnaire": ["SKILL.md"],
  "to-spec": ["SKILL.md"],
  triage: ["AGENT-BRIEF.md", "OUT-OF-SCOPE.md", "SKILL.md"],
  "wait-what": ["SKILL.md"],
  wayfinder: ["SKILL.md"],
  wizard: ["SKILL.md", "template.sh"],
  "writing-for-agents": ["SKILL-MECHANICS.md", "SKILL.md"],
};

const dependencies = {
  "grill-me": ["grilling"],
  "grill-with-docs": ["grilling", "domain-modeling"],
  implement: ["tdd", "code-review"],
  "improve-codebase-architecture": ["codebase-design", "grilling", "domain-modeling"],
  tdd: ["codebase-design"],
  triage: ["grilling", "domain-modeling"],
  wayfinder: ["research", "prototype", "grilling", "domain-modeling"],
};

const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function equalSet(actual, expected, label) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  check(JSON.stringify(a) === JSON.stringify(e), `${label}: expected [${e.join(", ")}], got [${a.join(", ")}]`);
}

function filesBelow(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...filesBelow(path, base));
    } else {
      out.push(relative(base, path));
    }
  }
  return out;
}

function sourceSkill(name) {
  return join(MATT_ROOT, name);
}

function readSkill(name) {
  return readFileSync(join(sourceSkill(name), "SKILL.md"), "utf8");
}

function hasInvocation(content, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[\\s\\x60'\"(])\\/${escaped}\\b|Skill tool[^\\n]{0,100}[\"'\\x60]${escaped}[\"'\\x60]`, "im").test(content);
}

function validatePresets() {
  const selectedSet = new Set(selected);
  const presetMattSkills = (name) => loadPreset(name).capabilities.skills.filter((skill) => selectedSet.has(skill));

  equalSet(presetMattSkills("engineering"), selected, "engineering Matt catalog");
  equalSet(presetMattSkills("productivity"), productivity, "productivity Matt catalog");
  equalSet(presetMattSkills("loop"), loopClosure, "loop Matt dependency closure");

  for (const presetName of ["engineering", "productivity", "loop", "experimenting-engineering"]) {
    const skills = loadPreset(presetName).capabilities.skills;
    for (const name of excluded) {
      check(!skills.includes(name), `${presetName} still selects excluded skill ${name}`);
    }
  }
}

function validateSourceCatalog() {
  const mattCapabilities = listAllCapabilities().skills
    .filter((skill) => skill.path.startsWith(`${MATT_ROOT}${sep}`))
    .map((skill) => skill.name);
  equalSet(mattCapabilities, selected, "vendored Matt skill leaves");

  for (const name of selected) {
    const dir = sourceSkill(name);
    const skillPath = join(dir, "SKILL.md");
    const sourcePath = join(dir, "SOURCE.md");
    check(existsSync(skillPath), `${name}: SKILL.md missing`);
    check(existsSync(sourcePath), `${name}: SOURCE.md missing`);
    if (!existsSync(skillPath) || !existsSync(sourcePath)) continue;

    const body = readFileSync(skillPath, "utf8");
    const frontmatter = parseFrontmatter(body);
    const expectedKeys = ["added_in", "description", "name", "upstream", "upstream_version"];
    if (manualOnly.has(name)) expectedKeys.push("disable-model-invocation");
    if (argumentHints[name]) expectedKeys.push("argument-hint");

    equalSet(Object.keys(frontmatter), expectedKeys, `${name} frontmatter keys`);
    check(frontmatter.name === name, `${name}: frontmatter name is ${String(frontmatter.name)}`);
    check(frontmatter.description === descriptions[name], `${name}: upstream description drifted`);
    check(frontmatter["disable-model-invocation"] === (manualOnly.has(name) ? true : undefined), `${name}: invocation flag drifted`);
    check(frontmatter["argument-hint"] === argumentHints[name], `${name}: argument hint drifted`);
    check(frontmatter.added_in === (retainedAddedIn[name] ?? "0.47.0"), `${name}: added_in is ${String(frontmatter.added_in)}`);
    check(frontmatter.upstream === "https://github.com/mattpocock/skills", `${name}: upstream URL drifted`);
    check(frontmatter.upstream_version === UPSTREAM_VERSION, `${name}: upstream_version is ${String(frontmatter.upstream_version)}`);

    const expectedSourceFiles = [...runtimeFiles[name], "SOURCE.md"].sort();
    equalSet(filesBelow(dir), expectedSourceFiles, `${name} vendored files`);

    const source = readFileSync(sourcePath, "utf8");
    const category = productivity.includes(name) ? "productivity" : "engineering";
    check(source.includes(PINNED_COMMIT), `${name}: SOURCE.md does not pin the full upstream commit`);
    check(source.includes(`skills/${category}/${name}/`), `${name}: SOURCE.md has the wrong upstream path`);
    check(/^## Re-?sync/im.test(source), `${name}: SOURCE.md lacks a re-sync procedure`);
    check(/^## Local (?:modifications|deviations)/im.test(source), `${name}: SOURCE.md lacks local deviations`);
    for (const file of runtimeFiles[name]) {
      check(source.includes(file), `${name}: SOURCE.md does not list ${file}`);
    }
  }

  for (const [name, required] of Object.entries(dependencies)) {
    const body = readSkill(name);
    for (const dependency of required) {
      check(body.includes(dependency), `${name}: missing composition reference to ${dependency}`);
    }
  }
}

function validateOverlays() {
  for (const name of ["code-review", "to-spec", "triage", "wayfinder"]) {
    const body = readSkill(name);
    check(/discover/i.test(body) && /(?:tracker|configuration)/i.test(body), `${name}: does not discover tracker configuration first`);
    check(/ask\s+(?:the user|them)/i.test(body), `${name}: does not ask the user directly when discovery is ambiguous`);
  }
  check(/local[- ]markdown/i.test(readSkill("wayfinder")), "wayfinder: local-markdown fallback is missing");

  for (const name of ["implement", "prototype", "resolving-merge-conflicts", "wizard"]) {
    const body = readSkill(name);
    check(/git/i.test(body) && /explicit/i.test(body) && /authori[sz]|permission|confirm/i.test(body), `${name}: explicit git-mutation authorization gate is missing`);
  }

  const codeReview = readSkill("code-review");
  check(/worktree/i.test(codeReview) && /git ls-files --others --exclude-standard/.test(codeReview), "code-review: worktree review does not include untracked files");
  check(/`worktree` mode/i.test(readSkill("implement")) && /review fixed point/i.test(readSkill("implement")), "implement: does not review its complete pre-commit worktree");

  for (const name of ["handoff", "research", "to-questionnaire", "wizard"]) {
    const body = readSkill(name);
    check(/per-run|run-scoped|unique/i.test(body), `${name}: output location is not isolated per run`);
    check(/absolute path/i.test(body), `${name}: does not require reporting the exact absolute path`);
  }
  const research = readSkill("research");
  check(/operating\s+system's temporary-directory facility/.test(research), "research: default output does not use an OS temporary directory");
  check(!research.includes(".scratch/research"), "research: default output still writes into the repository");

  const domainModeling = readSkill("domain-modeling");
  check(/read-only/.test(domainModeling) && /obtain confirmation/.test(domainModeling), "domain-modeling: discussion can mutate durable docs without confirmation");

  const triage = readSkill("triage");
  check(/inspect the diff read-only first/.test(triage) && /approval before checking it out/.test(triage), "triage: PR verification can switch worktrees without approval");

  const wayfinder = readSkill("wayfinder");
  check(wayfinder.includes(".scratch/wayfinder/<effort>/<run-key>/map.md"), "wayfinder: local map is not isolated per run");
  check(/absolute path/.test(wayfinder) && /local map path/.test(wayfinder), "wayfinder: local map locator is not handed off for continuation");
  check(/only one session/.test(wayfinder) && /no atomic claim operation/.test(wayfinder), "wayfinder: local fallback does not enforce its single-session limit");
  check(!/research\/<name>[^\n]{0,80}branch/i.test(wayfinder), "wayfinder still switches to shared-worktree research branches");
  check(/Let `research` own its\s+background agent/.test(wayfinder), "wayfinder: pass-through research subagent remains");
}

function validateCustomizedWiring() {
  const e2e = readFileSync(join(KIT_ROOT, "capabilities", "skills", "e2e-validate", "SKILL.md"), "utf8");
  check(hasInvocation(e2e, "diagnosing-bugs"), "e2e-validate does not invoke diagnosing-bugs");
  check(!hasInvocation(e2e, "diagnose"), "e2e-validate still invokes diagnose");

  const committee = readFileSync(join(KIT_ROOT, "capabilities", "skills", "@loop", "grill-with-committee", "SKILL.md"), "utf8");
  check(committee.includes("grilling"), "grill-with-committee does not compose grilling");
  check(committee.includes("domain-modeling"), "grill-with-committee does not compose domain-modeling");
  check(!hasInvocation(committee, "grill-with-docs"), "grill-with-committee still invokes grill-with-docs");

  const architectureReview = readFileSync(join(KIT_ROOT, "capabilities", "agents", "@reviews", "architecture-review", "AGENT.md"), "utf8");
  check(architectureReview.includes("codebase-design"), "architecture-review does not use codebase-design vocabulary");
  check(!hasInvocation(architectureReview, "improve-codebase-architecture"), "architecture-review treats improve-codebase-architecture as a review leaf");

  for (const path of [
    join(KIT_ROOT, "capabilities", "skills", "@loop", "loop-plan-manual", "SKILL.md"),
    join(KIT_ROOT, "capabilities", "skills", "@my", "grill-to-design-doc", "SKILL.md"),
  ]) {
    check(hasInvocation(readFileSync(path, "utf8"), "grill-with-docs"), `${relative(KIT_ROOT, path)} does not retain grill-with-docs composition`);
  }

  const activeFiles = [];
  for (const root of [join(KIT_ROOT, "capabilities", "skills"), join(KIT_ROOT, "capabilities", "agents")]) {
    for (const file of walkFiles(root)) {
      if (["SKILL.md", "AGENT.md"].includes(file.split(sep).at(-1))) activeFiles.push(file);
    }
  }
  for (const file of readdirSync(join(KIT_ROOT, "presets"))) {
    if (file.endsWith(".yaml")) activeFiles.push(join(KIT_ROOT, "presets", file));
  }
  for (const file of activeFiles) {
    const content = readFileSync(file, "utf8");
    for (const name of excluded) {
      check(!hasInvocation(content, name), `${relative(KIT_ROOT, file)} actively invokes excluded skill ${name}`);
    }
  }
}

function walkFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

function validateDeployed(home, presetName, hosts) {
  const selectedSet = new Set(selected);
  const expectedMatt = loadPreset(presetName).capabilities.skills.filter((name) => selectedSet.has(name)).sort();
  const manifest = JSON.parse(readFileSync(join(home, ".agent-kit", "manifest.json"), "utf8"));
  equalSet(manifest.skills.map(({ name }) => name).filter((name) => selectedSet.has(name)), expectedMatt, `${presetName} manifest Matt selection`);

  const roots = {
    claude: join(home, ".claude", "skills"),
    codex: join(home, ".agents", "skills"),
  };
  for (const host of hosts) {
    const root = roots[host];
    check(root, `unknown host ${host}`);
    if (!root) continue;

    for (const name of selected) {
      const skillDir = join(root, name);
      const shouldExist = expectedMatt.includes(name);
      check(existsSync(skillDir) === shouldExist, `${presetName}/${host}: ${name} deployment presence is ${existsSync(skillDir)}`);
      if (!shouldExist || !existsSync(skillDir)) continue;

      const expectedFiles = [...runtimeFiles[name]];
      if (host === "codex" && manualOnly.has(name)) expectedFiles.push("agents/openai.yaml");
      equalSet(filesBelow(skillDir), expectedFiles, `${presetName}/${host}/${name} runtime files`);

      const frontmatter = parseFrontmatter(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
      check(frontmatter.name === name, `${presetName}/${host}/${name}: deployed name drifted`);
      if (host === "codex" && manualOnly.has(name)) {
        const sidecar = readFileSync(join(skillDir, "agents", "openai.yaml"), "utf8");
        check(sidecar === "policy:\n  allow_implicit_invocation: false\n", `${presetName}/${host}/${name}: generated sidecar policy drifted`);
      }
    }

    for (const name of excluded) {
      check(!existsSync(join(root, name)), `${presetName}/${host}: excluded skill ${name} deployed`);
    }

    if (presetName === "loop") {
      const e2e = readFileSync(join(root, "e2e-validate", "SKILL.md"), "utf8");
      const committee = readFileSync(join(root, "grill-with-committee", "SKILL.md"), "utf8");
      const manualPlan = readFileSync(join(root, "loop-plan-manual", "SKILL.md"), "utf8");
      check(hasInvocation(e2e, "diagnosing-bugs"), `${presetName}/${host}: e2e-validate does not invoke diagnosing-bugs`);
      check(!hasInvocation(e2e, "diagnose"), `${presetName}/${host}: e2e-validate still invokes diagnose`);
      check(committee.includes("grilling") && committee.includes("domain-modeling"), `${presetName}/${host}: committee grill dependencies are missing`);
      check(hasInvocation(manualPlan, "grill-with-docs"), `${presetName}/${host}: loop-plan-manual lost grill-with-docs composition`);

      const agentPath = host === "codex"
        ? join(home, ".codex", "agents", "architecture-review.toml")
        : join(home, ".claude", "agents", "architecture-review.md");
      const architectureReview = readFileSync(agentPath, "utf8");
      check(architectureReview.includes("codebase-design"), `${presetName}/${host}: architecture-review lacks codebase-design vocabulary`);
      check(!hasInvocation(architectureReview, "improve-codebase-architecture"), `${presetName}/${host}: architecture-review invokes the interactive improvement flow`);
    }
  }
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "source") {
  validatePresets();
  validateSourceCatalog();
  validateOverlays();
  validateCustomizedWiring();
} else if (mode === "deployed") {
  const [home, presetName, hostsCsv] = args;
  validateDeployed(home, presetName, hostsCsv.split(","));
} else {
  errors.push(`unknown mode ${String(mode)}`);
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`  - ${error}\n`);
  process.exit(1);
}
