# [Feature Name] Design Document

> Guidance: Fill each section from the resolved grill outcomes. Not every section is required
> for a small feature — keep the ones that apply, omit the rest. Replace bracketed
> placeholders, and strip these `> Guidance:` lines as you write. Use language-agnostic
> pseudocode and generic interface descriptions — match the host project's stack when you fill
> it in.

**Status:** Draft | In Review | Approved | Implemented
**Author:** [Name]

## Version History

| Version | Date | Commit | Summary |
|---------|------|--------|---------|
| 0.1 | YYYY-MM-DD | `abc1234` | Initial draft |

> Guidance: Add a row per significant revision. Version is semantic-style (0.1, 0.2, 1.0).
> Date is the commit date; Commit is the short hash (enables `git diff` between versions);
> Summary is 1–2 sentences. Move Status through Draft → In Review → Approved → Implemented as
> the feature matures.

## Table of Contents

- [1. Overview](#1-overview)
- [2. Requirements](#2-requirements)
- [3. Architecture](#3-architecture)
- [4. Data Models](#4-data-models)
- [5. Interface / API Design](#5-interface--api-design)
- [6. Workflow Sequences](#6-workflow-sequences)
- [7. Integration with Existing Components](#7-integration-with-existing-components)
- [8. Configuration](#8-configuration)
- [9. Implementation Checklist](#9-implementation-checklist)
- [10. File Structure](#10-file-structure)
- [11. Self-Critique & Open Questions](#11-self-critique--open-questions)
- [12. Dependencies](#12-dependencies)
- [Appendix A: Examples](#appendix-a-examples)

---

## 1. Overview

> Guidance: 2–4 paragraphs — what problem this feature solves, what capabilities it provides
> (a numbered list works well), and why it's needed now.

[Describe the feature and its purpose.]

---

## 2. Requirements

> Guidance: Requirements validate the design and double as acceptance criteria. Use ID
> prefixes for traceability.

### 2.1 Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-1 | [User-facing capability or behavior] |
| FR-2 | [Another requirement] |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | [Performance, security, reliability requirement] |
| NFR-2 | [Another non-functional requirement] |

---

## 3. Architecture

> Guidance: Show component relationships with a diagram. A responsibilities table makes
> ownership explicit; a decisions table captures the "why" behind each choice.

### 3.1 High-Level Architecture

```
[Diagram showing components and data flow — ASCII or mermaid.]

Example:
┌─────────────────────────────────────────┐
│              Component A                 │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │  SubComp 1   │  │   SubComp 2      │ │
│  └──────┬───────┘  └────────┬─────────┘ │
│         ▼                   ▼           │
│  ┌──────────────────────────────────┐   │
│  │         Shared Component          │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Component A** | [What it does] |
| **Component B** | [What it does] |

### 3.3 Key Design Decisions

> Guidance: This table is the feature's decision record — capture the decisions resolved in
> the grill here, with the rationale, rather than spinning out separate ADRs.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| [Decision area] | [What was decided] | [Why] |

---

## 4. Data Models

> Guidance: Define the core types, records, and enums in language-agnostic pseudocode. Match
> the host project's language when you fill this in.

### 4.1 [Model Name]

```
type ExampleModel {
    id:         string     // Unique identifier
    name:       string     // Human-readable name
    created_at: timestamp
    status:     Status     // See enum below
}
```

### 4.2 Enums

```
enum Status {
    PENDING
    ACTIVE
    COMPLETED
}
```

---

## 5. Interface / API Design

> Guidance: Describe the surface other components or callers use — generic endpoints,
> method/function signatures, request/response shapes, or message contracts. Use the form that
> fits the feature (HTTP endpoints, library API, CLI, event messages).

### 5.1 Operations

| Operation | Input | Output | Notes |
|-----------|-------|--------|-------|
| `exampleMethod` | `ExampleRequest { id, payload }` | `ExampleResponse { success, result }` | [When/why called] |

### 5.2 Signatures

```
exampleMethod(request: ExampleRequest) -> ExampleResponse
```

---

## 6. Workflow Sequences

> Guidance: Show interactions between components with a sequence diagram (ASCII or mermaid).
> Include the happy path and the important error cases.

### 6.1 [Workflow Name]

```
Actor A                    Component B                    Component C
  │  Request                   │                              │
  │───────────────────────────>│  Internal call               │
  │                            │─────────────────────────────>│
  │                            │  Response                    │
  │                            │<─────────────────────────────│
  │  Final Response            │                              │
  │<───────────────────────────│                              │
```

---

## 7. Integration with Existing Components

> Guidance: How this feature connects to existing code. Reference specific files and what
> changes in each.

### 7.1 [Component] Integration

- **File:** `path/to/file`
- **Changes:** [What needs to be modified]

---

## 8. Configuration

> Guidance: Document configuration options with their defaults.

### 8.1 Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `EXAMPLE_SETTING` | `default_value` | [What it controls] |

### 8.2 CLI Arguments

```
--example-arg VALUE    # Description of argument
```

---

## 9. Implementation Checklist

> Guidance: This section tracks progress during implementation.
>
> - Break the feature into 4–8 logical phases; order them by dependency (earlier phases enable
>   later ones); each phase independently testable where possible, with a one-sentence Goal.
> - Tasks small enough to finish in 1–4 hours; prefix each with the file path; be specific
>   about the method/class/function. Group related tasks under subheadings.
> - Track with checkboxes (`- [ ]` / `- [x]`) and update the phase emoji as you go.
> - Add or split tasks as you discover them during implementation; keep completed tasks
>   visible for history.

**Status Legend:** ✅ Complete | 🚧 In Progress | ⏳ Not Started

---

### Phase 1: [Foundation / Setup] ⏳

> Goal: [One sentence describing what this phase achieves.]

#### 1.1 [Subgroup Name]

- [ ] `path/to/file` - Create `ClassName` with basic structure
- [ ] `path/to/file` - Implement `method_name()`
- [ ] `path/to/file` - Add configuration constants

---

### Phase 2: [Core Feature] ⏳

> Goal: [What this phase achieves.]

- [ ] [Task with file path]
- [ ] [Task with file path]

---

### Phase 3: [Integration] ⏳

> Goal: [What this phase achieves.]

- [ ] [Tasks...]

---

### Phase 4: [Testing] ⏳

> Goal: Comprehensive test coverage for the new components.

- [ ] `path/to/test` - Test [specific functionality]
- [ ] `path/to/test` - Test [edge cases and error handling]
- [ ] `path/to/test` - Test [end-to-end flow]

---

### Phase 5: [Documentation & Cleanup] ⏳

> Goal: Update documentation and finalize the feature.

- [ ] Update user-facing docs with the feature overview
- [ ] Add inline documentation where needed
- [ ] Remove leftover TODOs and dead scaffolding

---

## 10. File Structure

> Guidance: Show the directory layout, marking new and modified files.

```
src/
├── new_module/                     # NEW: Module description
│   ├── core.*                      # Core functionality
│   └── helpers.*                   # Helper utilities
├── existing_module/
│   └── file.*                      # Modified: Added X
└── ...

test/
├── new_feature_test.*              # NEW: Tests for feature
└── ...
```

---

## 11. Self-Critique & Open Questions

> Guidance: Be honest about weaknesses — it surfaces issues early and builds trust.

### 11.1 Strengths

1. [What works well about this design]
2. [Another strength]

### 11.2 Concerns & Risks

| Concern | Severity | Mitigation |
|---------|----------|------------|
| [Potential issue] | Low / Medium / High | [How to address it] |

### 11.3 Open Questions

> Guidance: Decisions that still need input or more investigation.

1. **[Question topic]:** [The question itself]
2. **[Another topic]:** [Question]

### 11.4 Alternatives Considered

> Guidance: Why rejected approaches were not chosen — prevents revisiting the same ideas.

**Alternative: [Name]**
- Pros: [Benefits]
- Cons: [Drawbacks]
- Decision: Rejected because [reason]

---

## 12. Dependencies

### 12.1 New External Dependencies

```
package-name >= X.Y.Z    # Why this package
```

### 12.2 Internal Dependencies

- Requires: [Other feature or component that must exist first]
- Blocks: [Features waiting on this one]

---

## Appendix A: Examples

> Guidance: Concrete usage examples — pseudocode, sample calls, or expected input/output.

### Example: [Scenario Name]

```
result = new_feature.do_something(input_data)
print(result)
```

### Example: [Expected Output]

```
/example/path/
├── file1.txt
└── file2.txt
```
