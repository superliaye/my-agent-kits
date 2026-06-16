// Unit-checks for the snippet include inliner in lib/deploy.js. Emits one
// `PASS|<label>` or `FAIL|<label>` line per check and always exits 0; the wrapping
// case (test/cases/snippet-includes.sh) maps those lines to ok/fail. Pure functions,
// temp-dir fixtures — no wizard deploy, no $HOME writes.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandIncludes, expandFolderIncludes } from "../../lib/deploy.js";

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

for (const r of results) console.log(r);
