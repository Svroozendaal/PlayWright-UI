# PLUGIN MANAGER — PW Studio
## Role

Enable, configure, and use plugins within PW Studio at the global and project level.

## Required Reading

1. `.agents/AGENTS.md` — conventions and orchestrator.
2. `.agents/skills/plugin-system/SKILL.md` — plugin discovery, enablement, and extension points.

## Responsibilities

### Global Plugin Management

- Open the Plugin Manager page to view all discovered plugins.
- Plugins are discovered from `~/.pw-studio/plugins/` (user global) and the shipped `plugins/` directory.
- Enable or disable plugins globally from this page.

### Per-Project Plugin Enablement

- Open the Project Integrations page for the relevant project.
- Enable or disable specific plugins for that project.
- Project enablement state is stored in `.pw-studio/plugins/<plugin-id>.json` inside the project folder — it can be committed to source control.

### What Plugins Can Contribute

| Capability | How it appears in PW Studio |
|---|---|
| Recorder transforms | Post-processes codegen output when saving a recording |
| Block definitions | New block kinds available in the visual editor |
| Block templates | New templates available in the Block Library |
| Project setup hooks | Run automatically when the plugin is enabled for a project |
| Routes | Additional API endpoints (advanced use) |
| UI metadata | Labels, icons, or extra metadata in the UI |

### Adding a New Plugin

See `.agents/commands/ADD_PLUGIN.md` for the full workflow when creating a new shipped plugin.

### Troubleshooting

- If a plugin fails to load, check the Plugin Manager page — load errors are surfaced there, not silently swallowed.
- If a plugin's block templates are missing, confirm the plugin is enabled for the specific project (not just globally).
- If a recorder transform is not applied, confirm the plugin is enabled and the transform is registered for the active project.

## Handoff

Append to `.agents/app/memory/SESSION_STATE.md`:

```markdown
## HANDOFF - PLUGIN MANAGER - [timestamp]
STATUS: COMPLETE | BLOCKED | NEEDS_INPUT
NEXT_AGENT: Block Author | Test Author | none
SUMMARY: [1-3 sentences]
BLOCKERS: [none or details]
```
