---
name: project-tracker-update
description: Creates and maintains project delivery trackers in Google Sheets from project scope, documents, and requested changes. Use when the user wants to create a tracker, add or restructure deliverables and work items, change project classifications, or apply planning decisions to an existing tracker.
argument-hint: "Project scope or tracker URL, and the change to make"
disable-model-invocation: true
added_in: 0.49.0
---

# Project Tracker Update

Turn the user's request into a usable delivery tracker. Apply these rules to both creation and updates; let the prompt determine the operation.

## Establish the project

Read the supplied scope and sources. For an existing tracker, inspect its values, links, notes, validation, layout, and project settings before editing. Prefer Sheets APIs or connected tools; use browser interaction for visual inspection or unsupported operations.

Before browser navigation or editing, confirm the active spreadsheet and the intended control using fresh UI references. Enter cell addresses through the verified name box. Keep supplied example sheets read-only.

Treat supplied tracker examples as visual and interaction references. Inspect their live sheets or screenshots for section structure, column order, table features, chip colors, cell fills, row shading, alignment, and density. Use the main tracker example for core layout and weekly examples for reporting conventions. Carry those conventions into the tracker, adapting fields to the project. Read the examples' project content as reference data; follow the user's request for what to create or change.

Identify deliverables, acceptance criteria, scoped work items, owners, dates, classifications, and dependencies. Resolve consequential ambiguity with the user; make routine layout choices directly. Keep unknown owners and dates visibly unknown. Distinguish proposed scope and commitments from confirmed ones.

For a new tracker, keep a small, readable Project settings tab with shared classification definitions, allowed values, status vocabulary, source ownership, and any supplied timezone and reporting-week convention. For an existing tracker, use its current settings location. Ask only for missing settings needed for the current operation.

## Choose and preserve the structure

Give each column one distinct project-management purpose: a decision, responsibility, classification, commitment, dependency, source reference, or recurring update. Use the smallest useful set for the supplied project. Combine overlapping responsibilities; put shared defaults in settings and lengthy or exceptional detail in notes. A reference illustrates layout, not a mandatory column schema. Explain each selected column's purpose briefly at handoff.

For an existing tracker, preserve its structure until the user approves a specific change. Before adding, removing, renaming, reordering, or repurposing columns or tabs, or reorganizing deliverable sections, show the proposed change, its project-management benefit, and its effect on existing data. Apply only approved changes; a request to update content or sync status does not authorize redesign. A specific change already requested by the user needs no second approval. Continue independent content updates while a structural proposal is pending.

## Structure the work

- A deliverable describes an outcome and its completion condition. Work items describe bounded, independently trackable work. Split an item when owners, statuses, or delivery dates differ materially; preserve the shared deliverable.
- Preserve existing project identifiers when used by the team. Derive deliverable membership from the sheet's labels and section boundaries. Keep automation-only identity in native sheet metadata or tool-owned state rather than adding Item ID or Deliverable ID columns, including hidden columns. Add an identifier column only when the user needs that identifier for project work.
- Start from Deliverable, Work Item, DRI, and Status, then select classifications, target timing, Jira, artifacts, priority, effort, dependencies, and weekly updates only when the supplied project uses them. Place lengthy acceptance criteria and source detail in cell notes or a clearly linked details area.
- Treat Theme, Target, and similar fields as project-defined classifications. Explain their meaning and use native dropdowns for controlled values. Accommodate multiple classifications without presenting a combined label as a single selection unless that is the project's convention.
- A work item has zero or one primary Tracking Jira. Supporting Jira issues belong with artifacts or typed dependencies such as prerequisite, blocker, or partner work. Preserve actual hyperlinks, including links embedded in rich text; keep missing links empty rather than inventing issues or URLs.
- Record dependencies using recognizable work-item names, existing project identifiers, links, or explicit external references. Preserve the distinction between a required prerequisite and related work.
- Choose a target date or window representation that fits the project's commitments. Add separate timing columns only for distinct milestones or planning decisions. Use native dates for definite dates; keep completion state in Status. Retain canceled or descoped work and its explanation when history matters.
- The primary Jira owns execution Status when mapped. The tracker owns project scope, classifications, and commitments unless the project specifies otherwise. Apply explicitly requested planning changes; leave routine source synchronization to a separate invocation.

## Make the sheet usable

Use native spreadsheet features as part of the artifact, not a written promise:

- Start each deliverable with a short section band across the used work columns. Use a strong, saturated background and contrasting bold-white deliverable text. Different deliverables may use different colors; the merged label and its section band use the same color. Vertically merge the label across the band and following work rows, top-align it, and center it horizontally. The band belongs to that deliverable block rather than forming a separate blank spacer. Keep section bands free of work-item controls.
- Use one native Sheets table for the sectioned work columns when compatible with the layout, keeping vertically merged deliverable labels outside the table. Keep column headings in a single header row and section bands empty across the work columns. Match the reference's header style and alternating neutral work-row fills. Keep filtering and sorting within ranges that preserve deliverable sections and work-item relationships; provide collapsible sections when useful.
- Use native dropdown chips with distinct, consistent colors for allowed values. Status is single-select; enable native multi-select only for classifications that actually permit several values. Set chip colors separately from cell backgrounds: classification cells retain neutral row shading; apply a separate column fill only when the reference or user calls for it. A reference's uniform mint Status column, for example, is independent of its green, yellow, gray, and red status chips. Use the spreadsheet UI when the API cannot set chip display, option colors, or multi-select behavior. Extend controls to added work rows while excluding section bands.
- Use native dates and document chips for supported artifact links. For DRI, resolve supplied names against available project or account context and use native people smart chips (`@` mentions) for confirmed identities when supported. Prefer these over owner dropdowns; retain readable names or existing selectors for unresolved identities. Preserve ordinary hyperlinks when their targets cannot use smart chips.
- Freeze the header and enough identifying columns to retain context while scrolling. Match the reference's typography, contrast, column proportions, and row density. Align short work-row values at the vertical middle and left; top-align wrapped weekly updates and long text. Keep owner names and selectors on one line, and give chips enough width for their labels. Expand long rows only as their content requires.
- For a new tracker, retain selected reference fields in their relative order and put weekly updates together at the far right, after all other project fields. Keep Theme, Target, and Linked Artifacts in the main flow when justified by the project. For an existing tracker, apply column-order changes and new weekly columns only with the structural approval described above. Use horizontal scrolling when needed; group optional detail separately.
- Keep weekly columns in the project's existing order. Preserve historical updates and human-authored text. Generated weekly text, when explicitly requested, uses a distinct readable font color and an `AI/skill-generated` label. Human edits or replacements take precedence; do not infer authorship from color alone.

## Apply updates safely

Make the smallest changes that satisfy the request. Preserve unaffected values, formulas, validation, notes, hyperlinks, human text, and formatting. Read the affected cells again before writing; reconcile concurrent changes rather than overwriting them.

When splitting or moving work, carry its source references and acceptance criteria to the correct resulting items. Keep unchanged identities stable and explain superseded items. Update affected dependency references, deliverable borders, grouping, filters, and validation ranges. Repeating a request must not create duplicate items or tabs.

Honor the user's authorized scope for creating or updating the sheet. Keep Jira creation, reassignment, and external notifications separate from tracker edits unless explicitly requested.

## Verify and hand off

Read back the sheet after writing. Check scope coverage, owners, dates, statuses, Jira roles, dependencies, deliverable membership, links, dropdowns, and preservation of existing human content against the request. Confirm each column has a distinct useful purpose and existing structural changes have explicit approval. Check that a supporting issue cannot be mistaken for the primary tracker. Confirm that primary Jira and artifact labels resolve to their intended URLs after all formatting is applied.

Compare the live sheet with the supplied visual references at the same sheet zoom: default view, several deliverable boundaries, long content, and rightmost used columns. Check section bands and merge boundaries, native table features, chip colors independently of cell fills, alternating row shading, core column visibility, typography, alignment, and density. Explain material departures from the references. Open representative dropdowns and verify their options and single/multi-select behavior. A PDF can verify layout but cannot verify interactive controls. Fix defects and inspect again. If live inspection or a required native feature is unavailable, state the limitation rather than accepting the tracker as fully verified.

After browser inspection, read back the affected sheet data again and compare it with the intended final content. Correct any accidental interaction changes before handing off the artifact.

Return the sheet URL, a brief account of the changes, and unresolved decisions. Keep temporary inspection files in a fresh per-run temporary directory; print exact absolute paths for any handed-off local artifacts.
