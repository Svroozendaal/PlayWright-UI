# AGENT FINDER — PW Studio
## Role

Route ambiguous queries to the correct agent or skill. Use this when unsure which specialist handles a task.

## How to Route

1. Read `.agents/AGENTS.md` — Agent Selection Logic table.
2. Classify the task: writing tests, running tests, recording, environments, blocks, plugins, documentation, or a small change.
3. Return the agent name, agent file path, and any relevant skill paths.

## Quick Reference

| Task | Agent | Skill |
|---|---|---|
| Write or edit `.spec.ts` files | Test Author | — |
| Run tests, view results, triage failures | Test Runner | `playwright-runner/SKILL.md` |
| Record a new test flow | Recorder | — |
| Environments, variables, secrets | Environment Manager | `secrets-environments/SKILL.md` |
| Visual block editor, block templates | Block Author | `block-editor/SKILL.md` |
| Enable or configure a plugin | Plugin Manager | `plugin-system/SKILL.md` |
| Documentation and run summaries | Documenter | — |
| Small, single-file change | Light | — |

## Output

```markdown
## Agent Finder Result

Task: [brief description]
Recommended agent: [Agent] — [file path]
Relevant skill: [skill path or none]
Reasoning: [1 sentence]
```
