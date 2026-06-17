// Unit-checks for the snippet include inliner in lib/deploy.js. Emits one
// `PASS|<label>` or `FAIL|<label>` line per check and always exits 0; the wrapping
// case (test/cases/snippet-includes.sh) maps those lines to ok/fail. Pure functions,
// temp-dir fixtures — no wizard deploy, no $HOME writes.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { expandIncludes, expandFolderIncludes, loadSnippets } from "../../lib/deploy.js";

const KIT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const results = [];
const check = (label, fn) => {
  try { fn(); results.push(`PASS|${label}`); }
  catch (e) { results.push(`FAIL|${label}: ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || "assertion failed"); };

const snippets = new Map([["greeting", "HELLO-EXPANDED"]]);

check("known snippet expands", () => {
  const out = expandIncludes("a\n<!-- include: greeting -->\nb", snippets, { strict: true, label: "x" });
  assert(out.includes("HELLO-EXPANDED"), "snippet body missing");
  assert(!out.includes("<!-- include"), "marker left behind");
});

check("strict mode: unknown snippet throws", () => {
  let threw = false;
  try { expandIncludes("<!-- include: nope -->", snippets, { strict: true, label: "x" }); }
  catch { threw = true; }
  assert(threw, "expected throw on unknown snippet in strict mode");
});

check("lenient mode: unknown snippet left verbatim", () => {
  const src = "a doc shows <!-- include: nope -->";
  const out = expandIncludes(src, snippets, { strict: false, label: "x" });
  assert(out === src, `expected verbatim, got: ${out}`);
});

check("folder sweep: SKILL.md strict-expands, bundled .md is lenient", () => {
  const dir = mkdtempSync(join(tmpdir(), "inc-"));
  try {
    writeFileSync(join(dir, "SKILL.md"), "# s\n<!-- include: greeting -->\n");
    mkdirSync(join(dir, "references"));
    writeFileSync(
      join(dir, "references", "doc.md"),
      "ref\n<!-- include: greeting -->\nexample syntax: <!-- include: not-a-real-snippet -->\n",
    );
    expandFolderIncludes(dir, snippets, "Skill 'fixture'");
    const skill = readFileSync(join(dir, "SKILL.md"), "utf8");
    const doc = readFileSync(join(dir, "references", "doc.md"), "utf8");
    assert(skill.includes("HELLO-EXPANDED"), "SKILL.md not expanded");
    assert(doc.includes("HELLO-EXPANDED"), "bundled known snippet not expanded");
    assert(doc.includes("<!-- include: not-a-real-snippet -->"), "bundled unknown marker not left verbatim");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

check("folder sweep: unknown marker in SKILL.md fails the deploy", () => {
  const dir = mkdtempSync(join(tmpdir(), "inc-"));
  try {
    writeFileSync(join(dir, "SKILL.md"), "<!-- include: nope -->");
    let threw = false;
    try { expandFolderIncludes(dir, snippets, "Skill 'fixture'"); } catch { threw = true; }
    assert(threw, "expected throw on unknown marker in SKILL.md");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Real-kit guard: every `<!-- include: NAME -->` marker in a shipped SKILL.md /
// AGENT.md must resolve to an actual snippet in capabilities/snippets/. A strict
// expand over the live tree catches a dangling include before deploy does (the
// loop-plan plan skills + the @reviews agents both lean on this). The snippet map
// comes from deploy's own `loadSnippets`, so the guard can't drift from what
// deploy actually loads.
function walkMd(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkMd(full, out);
    else if (ent.name === "SKILL.md" || ent.name === "AGENT.md") out.push(full);
  }
  return out;
}

check("kit: every SKILL.md/AGENT.md include resolves to a real snippet", () => {
  const kitSnippets = loadSnippets(KIT_ROOT);
  const roots = [join(KIT_ROOT, "capabilities", "skills"), join(KIT_ROOT, "capabilities", "agents")];
  for (const root of roots) {
    if (!statSync(root).isDirectory()) continue;
    for (const file of walkMd(root)) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("<!-- include:")) continue;
      // strict — throws on any unknown marker, exactly as deploy would
      expandIncludes(src, kitSnippets, { strict: true, label: `${basename(dirname(file))}/${basename(file)}` });
    }
  }
});

check("kit: the four loop-plan snippets exist", () => {
  const kitSnippets = loadSnippets(KIT_ROOT);
  for (const n of ["committee-answer-contract", "research-fan-out", "draft-to-loop-build-format", "artifact-review"]) {
    assert(kitSnippets.has(n), `snippet '${n}' missing from capabilities/snippets/`);
  }
});

check("kit: both plan skills include all three shared-phase snippets", () => {
  for (const skill of ["loop-plan-manual", "loop-plan-semiauto"]) {
    const src = readFileSync(join(KIT_ROOT, "capabilities", "skills", "@loop", skill, "SKILL.md"), "utf8");
    for (const n of ["research-fan-out", "draft-to-loop-build-format", "artifact-review"]) {
      assert(new RegExp(`<!--\\s*include:\\s*${n}\\s*-->`).test(src), `${skill} missing include ${n}`);
    }
  }
});

for (const r of results) console.log(r);
