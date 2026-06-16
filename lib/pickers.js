// lib/pickers.js
// Interactive capability/agent/bundle multiselects seeded from caller-supplied
// initial values. `update`'s interactive flow uses these to pre-check the user's
// current manifest selection so they only toggle the delta. (init.js keeps its
// own preset-driven pickers; these are the manifest-seeded variants.)

import { multiselect, isCancel } from "@clack/prompts";
import { listAllCapabilities } from "./capabilities.js";
import { AGENTS, listAgentKeys } from "./agents.js";

// Capability types offered in the wizard. Bundles get their own focused step
// (pickBundlesFrom); mcp/hooks are offered but typically empty.
const PICKABLE_TYPES = ["instructions", "skills", "agents", "plugins", "mcp", "hooks"];

// One multiselect per capability type, each pre-checked from initialByType.
// Unknown initial names (e.g. a manifest entry the kit no longer ships) are
// filtered out so clack never gets an initialValue with no matching option.
export async function pickCapabilitiesFrom(initialByType) {
  const all = listAllCapabilities();
  const result = { instructions: [], skills: [], agents: [], plugins: [], mcp: [], hooks: [], bundles: [] };
  for (const ptype of PICKABLE_TYPES) {
    if (all[ptype].length === 0) continue;
    const available = new Set(all[ptype].map((p) => p.name));
    const initial = (initialByType[ptype] ?? []).filter((n) => available.has(n));
    const picked = await multiselect({
      message: `${ptype} (space toggle, enter confirm)`,
      options: all[ptype].map((p) => ({ value: p.name, label: `${p.name} — ${shortenForLabel(p.description)}` })),
      initialValues: initial,
      required: false,
    });
    if (isCancel(picked)) throw new Error("cancelled");
    result[ptype] = picked;
  }
  return result;
}

export async function pickAgentsFrom(initial) {
  const picked = await multiselect({
    message: "Which agents?",
    options: listAgentKeys().map((k) => ({ value: k, label: AGENTS[k].label })),
    initialValues: initial,
    required: true,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

export async function pickBundlesFrom(initial) {
  const available = listAllCapabilities().bundles ?? [];
  if (available.length === 0) return [];
  const avail = new Set(available.map((b) => b.name));
  const picked = await multiselect({
    message: "Install bundles (always installs globally; space toggle, enter confirm)",
    options: available.map((b) => ({ value: b.name, label: `${b.name} — ${shortenForLabel(b.description)}` })),
    initialValues: (initial ?? []).filter((n) => avail.has(n)),
    required: false,
  });
  if (isCancel(picked)) throw new Error("cancelled");
  return picked;
}

// Keep multiselect option labels to one terminal line. Long descriptions wrap
// and leave duplicated-looking scrollback on some terminals; the full text
// stays in the SKILL.md frontmatter.
function shortenForLabel(d, cap = 80) {
  if (!d) return "";
  const firstSentence = /^.+?\.(\s|$)/.exec(d);
  if (firstSentence) {
    const s = firstSentence[0].trim();
    if (s.length <= cap) return s;
  }
  if (d.length <= cap) return d;
  const cut = d.slice(0, cap - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
