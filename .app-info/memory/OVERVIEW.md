# MEMORY — PW Studio

## Live Logs

All active session content is written here. Templates originate from `.agents/agent-memory/`.

| File | Purpose |
|---|---|
| `SESSION_STATE.md` | Current scope, active agent, handoff log |
| `DECISIONS_LOG.md` | Architecture and design decisions |
| `PROGRESS.md` | Work progress entries |
| `REVIEW_NOTES.md` | Review findings and their resolution status |
| `PROMPT_CHANGES.md` | Changes to prompts and their compatibility |
| `INCIDENTS.md` | Incident tracking and root-cause analysis |

## Rules

- Do not compact memory logs automatically — use the `memory-compaction` skill and ask first.
- Every agent handoff appends a block to `SESSION_STATE.md`.
