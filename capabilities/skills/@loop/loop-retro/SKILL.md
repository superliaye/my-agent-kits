---
name: loop-retro
description: "Session retrospective that mines the current session — the main transcript plus every subagent transcript — for concrete ways to improve the kit capabilities (skills/agents) that ran. Spawns a retro agent to read the large transcripts off the resident's context and return findings only: per capability, what worked and where its instructions caused friction, each tied to transcript evidence. Edits nothing. Auto-runs at the end of a /full-loop-* flow, or invoke directly after a session that exercised kit skills/agents."
added_in: 0.41.0
---

# /loop-retro

Turn a finished session into improvement opportunities for the skills and agents it used.
The transcripts are large, so you (the **resident agent**) hand the reading to a **retro
agent** and relay what it finds — you spend almost no context yourself.

## Spawn the retro agent

Give the agent the working directory — it locates this session's transcripts itself:

```
Agent({
  subagent_type: "loop-retro-agent",
  description: "retro on this session",
  prompt: `WORKING DIRECTORY: <cwd> — the repo this session ran in.`
})
```

## Relay the findings

Present the agent's findings grouped by capability. **Apply nothing automatically** — the
human decides what to act on. If the agent found no readable capability body in the
session, say so plainly.
