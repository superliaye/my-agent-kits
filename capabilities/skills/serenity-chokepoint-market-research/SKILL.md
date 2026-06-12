---
name: serenity-chokepoint-market-research
description: Source-grounded research operating system for analyzing markets, value chains, and companies by finding durable supply-chain chokepoints. Distilled from the public posts of Serenity (@aleabitoreddit). Use when researching an industry, supply chain, or potential investment theme to locate where physical/technical/regulatory bottlenecks create asymmetric, mispriced exposure. NOT a trading signal.
added_in: 0.21.0
---

# Serenity-Derived Chokepoint Market Research Skill

## 1. Purpose

A repeatable procedure for answering: *"Within a real demand trend, which layer of the supply chain is the binding constraint, does it capture durable economic value, and is that value already priced in?"* It turns a fuzzy theme ("AI is big") into a ranked, evidence-backed research queue of specific chokepoints and the public/private names exposed to them. It generalizes far beyond semiconductors.

This skill is distilled from ~5,800 public posts (2025-07 to 2026-06) of Serenity (`@aleabitoreddit`). It is a **research framework, not financial advice and not a trading signal.** The full evidence behind every principle (`serenity_methodology_report.md`) and the cited-post corpus (`serenity_corpus_manifest.csv`) live in this skill's `_unshipped/` directory in the kit repo — they are reproducibility/provenance assets and are intentionally NOT bundled into deployed installs of this skill.

## 2. When to Use This Skill

**Good fit**
- Mapping an unfamiliar industry/value chain to find where the profit pool and pricing power actually sit.
- Stress-testing whether a "hot theme" has a *real* bottleneck or is just a narrative.
- Finding small, under-covered suppliers with asymmetric exposure to a large demand trend.
- Deciding which *layer* of a chain (material vs component vs equipment vs integrator) offers the best risk-adjusted exposure.
- Re-evaluating a position after a large price move.

**Poor fit / do not use for**
- Generating buy/sell signals or position sizing for real money (it is research, not advice).
- Pure-macro or index timing; single-quarter trading; meme/momentum plays.
- Any situation where you cannot obtain current primary sources - the method is only as good as the live evidence behind it.

## 3. Core Principles

Twelve Serenity-derived rules (each **Explicit** in the corpus: stated at least once and demonstrated repeatedly - see report for citations and tensions), plus conventional extensions clearly labeled.

**Serenity-derived (Explicit):**
1. **Start with physical demand, not narratives.** Begin from a concrete physical/behavioral driver (watts, TWh/GW, bits, units, observed hoarding, forward ramp), then trace where capex *must* flow. *"Look at forward demand ramp, not previous revenue recognition."*
2. **Reverse-map the supply chain.** Work backward from end demand through system -> subsystem -> component -> material -> equipment -> test/qual -> capacity constraint.
3. **Hunt hidden chokepoints.** Prioritize layers that are technically indispensable, supply-concentrated, hard to qualify/switch, slow to expand, and small in market cap relative to the downstream value they enable.
4. **Real bottleneck vs fashionable theme.** Require measurable, leading evidence - lead times, utilization, qualification cycles, backlog, pricing, capex, contracts, specs, filings, trade data - before believing a constraint is real.
5. **Picks-and-shovels with asymmetric exposure.** Prefer the smallest pure-play supplier whose earnings swing hard on a giant customer's volume, where that input is a tiny share of the customer's bill-of-materials but existential to it.
6. **Map substitute / displacement risk.** Explicitly check alternative materials, competing architectures, redesign risk, vertical integration, new entrants, Chinese/international supply, customer bargaining power, and capacity overshoot.
7. **Catalyst + market-awareness gap.** Separate a true advantage from what's already priced in; enter where a real near-term catalyst exists but the market hasn't recognized or correctly priced it.
8. **Re-underwrite after price appreciation.** After a big move, re-ask: is the bottleneck still real, did the catalyst occur, is supply responding faster, has risk/reward compressed, is it now consensus? Be willing to trim, exit, or flip.
9. **Study second-order constraints.** When the obvious bottleneck eases, move to the next limiting layer (GPU -> networking -> optics -> substrate -> test equipment -> power -> grid interconnect -> cooling -> financing).
10. **Technical understanding as edge.** Translate engineering reality (specs, thermal limits, process nodes, BOM composition) into under-modeled financial implications the sell-side misses.
11. **Good company vs good stock.** Separate business quality from entry price, expectations, dilution, balance-sheet risk, and valuation - a great company can be a bad stock and vice versa.
12. **Compare value capture across layers.** For each layer estimate BOM share, substitutability (monopoly > duopoly > fragmented), margins, and pricing power; invest where criticality-to-BOM-share and durable pricing power are highest - and flag where the chokepoint may migrate.

**Strongly inferred from corpus (cross-cutting behavior):**
13. **Trade your edge and judge by milestones.** Operate in domains where you hold a structural information advantage; treat mechanical flows (option hedging, lockups/dilution, sector co-movement) as mispricing sources; judge a thesis by whether its *milestone* hit, not by short-term price.

**Conventional analytical extensions (NOT attributable to Serenity - added for rigor):**
- The 0-5 chokepoint scorecard mechanics (§5).
- The formal evidence hierarchy (§6).
- Explicit balance-sheet/dilution survival checks as a gating step (Serenity references dilution often, but the disciplined checklist form is conventional).
- The falsification checklist (§9) as a required gate.

Do not blur these categories. When applying the skill, state which rules drove a conclusion.

## 4. Research Workflow

### Step 1 - Define the downstream demand driver
Quantify the physical/behavioral driver (units, watts, TWh/GW, tons, bandwidth, observed order-flow), its growth rate, timeframe, and affected workloads/customers. If the thesis rests only on narrative or trailing revenue, stop and find the physical driver first.

### Step 2 - Build the complete value-chain map
Decompose end demand backward into system, subsystem, component, material, equipment, testing/qualification, logistics, energy, and financing layers. Note who supplies each layer and rough concentration.

### Step 3 - Locate candidate chokepoints
For each layer assess indispensability, supply concentration, expansion latency, and switching friction. Score with the §5 scorecard.

### Step 4 - Verify the constraint
Require **primary** evidence before concluding a bottleneck exists: lead-time expansion, utilization, qualification cycles, backlog, pricing changes, shipment data, supplier commentary, capex plans, contracts, technical specs, filings, import/export data. A constraint asserted without leading evidence is a hypothesis, not a finding.

### Step 5 - Identify public-market exposure
Map suppliers, customers, competitors, and substitutes. Separate **pure plays** (earnings swing hard on the theme) from **diversified** names (theme is a rounding error). Note market cap vs downstream value enabled.

### Step 6 - Translate the operational constraint into financial impact
Estimate revenue sensitivity, incremental margins, capacity ceilings, capex, lead times, and valuation implications. Build an explicit bridge from the physical constraint to revenue/EBIT to a valuation range.

### Step 7 - Check market awareness
Classify the idea as undiscovered / emerging / consensus / over-owned. State what is already priced in vs the realistic case.

### Step 8 - Search for falsifiers
Actively try to break the thesis (§9). Default to skepticism: assume the shortage is temporary until evidence says otherwise.

### Step 9 - Define catalysts and monitoring signals
Specify the developments that would confirm, weaken, or invalidate the thesis, with the source and cadence for each, and pre-set kill/downgrade triggers.

### Step 10 - Produce a ranked research queue
Rank ideas by evidence quality and expected asymmetry, **not** excitement. Re-underwrite (Step 4-7) after any large price move.

## 5. Chokepoint Scorecard

Score each candidate layer 0-5 (0 = not a constraint / weak, 5 = severe / strong). *Conventional extension - mechanics not attributable to Serenity.*

| Dimension | Question | 0 = | 5 = |
|---|---|---|---|
| Indispensability | Does the downstream system require this input? | optional | system stops without it |
| Supply concentration | How few qualified suppliers? | many | monopoly |
| Expansion latency | How long to add capacity? | weeks | many years |
| Qualification friction | How hard for customers to switch? | drop-in | full re-qualification/re-spin |
| Pricing power | Can suppliers raise price / improve mix? | price-taker | sets price |
| Demand visibility | Is downstream growth measurable? | opaque | hard contracted data |
| Earnings sensitivity | Would higher demand materially move financials? | negligible | transformational |
| Valuation gap | Is the market underestimating the effect? | priced in | clearly mispriced |
| Catalyst clarity | What forces recognition? | none | dated, near-term |
| Substitute risk (inverse) | How protected from displacement? | easily displaced | no viable substitute |
| Balance-sheet quality | Can it survive execution delays? | fragile/dilutive | self-funding |
| Crowding risk (inverse) | How un-owned/un-promoted? | consensus/hyped | obscure |

**Interpretation.** The total (max 60) is a **triage aid, not a buy signal.** Read the *profile*: a true chokepoint scores high on indispensability + concentration + expansion latency + qualification friction. High demand-side scores with low valuation-gap/crowding scores means "real bottleneck, already priced." A single low score on Substitute risk or Balance-sheet quality can invalidate an otherwise high total. Never act on the number alone; act on the evidence behind it.

## 6. Evidence Hierarchy

Prioritize sources in this order; require citations for all material claims.
1. Regulatory filings and audited company reports.
2. Earnings calls and investor materials.
3. Customer and supplier commentary.
4. Government, regulator, and grid-operator data.
5. Technical papers, standards, and credible industry research.
6. Trade publications and reputable journalism.
7. Social-media posts (including Serenity's) - **leads requiring verification, never sole proof.**

## 7. Research Output Template

For each theme or company, produce (use `templates/theme_analysis.md`):
- thesis in one paragraph;
- downstream demand driver (quantified);
- value-chain position;
- chokepoint explanation;
- primary evidence (cited);
- competitor and substitute map;
- capacity and expansion timeline;
- earnings sensitivity;
- valuation snapshot;
- catalyst timeline;
- key falsifiers;
- monitoring dashboard;
- confidence level;
- open questions;
- source list;
- explicit separation of fact, inference, and speculation.

## 8. Anti-Patterns (prohibited)

- Copying tickers without reproducing the reasoning.
- Treating social-media popularity (or Serenity's mention) as validation.
- Assuming every shortage is durable.
- Ignoring valuation after a large rally.
- Confusing total addressable market with supplier revenue.
- Using downstream capex announcements without checking conversion into actual orders.
- Ignoring customer concentration.
- Ignoring dilution, debt, cash burn, or financing risk.
- Treating technical indispensability as permanent.
- Relying only on management claims.
- Using a single post as proof of a general methodology rule.
- Presenting hindsight-selected winners as a complete record.
- Hiding inaccessible or deleted posts.
- Turning the skill into personalized financial advice.

## 9. Falsification Checklist (required gate)

The agent must answer all before raising confidence:
- What evidence would prove this is NOT a bottleneck?
- How quickly can competitors add capacity?
- Could customers redesign around the component?
- Could pricing normalize before earnings materialize?
- Is demand double-counted across customer announcements?
- Is the market already pricing in the optimistic case?
- Are margins sustainable?
- Could geopolitical, regulatory, or financing constraints reverse the thesis?
- Which assumptions depend on management guidance rather than independent evidence?
- What would cause you to stop researching or downgrade the idea?

## 10. Update Procedure

- Append newly retrieved Serenity posts to `_unshipped/serenity_corpus_manifest.csv`, preserving original timestamps and canonical URLs.
- Update a principle only when new evidence materially changes it; record the change in a changelog with date and the posts that drove it.
- Never silently rewrite prior conclusions - revisions are additive and dated.
- Distinguish newly *explicit* statements from stronger *inferences* when upgrading classification.
- Re-check source accessibility (e.g. whether X re-fetch becomes possible to upgrade attribution from `probable` to `verified`).
- Run periodic contradiction searches (look for posts that complicate existing principles).
- Keep this SKILL.md concise; retain full evidence in `_unshipped/serenity_methodology_report.md`.

## 11. Safety and Epistemic Standards

- This is a **research framework, not a trading signal.**
- Historical successes do not validate every future application; the corpus covers one ~11-month regime (2025-26 AI/photonics super-cycle) and over-represents highlighted calls.
- An anonymous author's **claimed performance is not independently verified** and must not be treated as audited.
- Every investment thesis must be re-validated with **current primary sources** at the time of use - the method is worthless on stale data.
- Always disclose uncertainty, missing data, inaccessible sources, and competing interpretations.
- The skill exists to improve analytical rigor, **not** to amplify conviction without evidence.
