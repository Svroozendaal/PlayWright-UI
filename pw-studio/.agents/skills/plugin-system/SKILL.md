# SKILL: plugin-system

## Purpose

Guide the enabling, configuration, and use of plugins in PW Studio at the global and per-project level.

## When to Use

- Enabling or disabling a plugin globally or for a specific project.
- Understanding what a plugin contributes (blocks, recorder transforms, templates, routes).
- Diagnosing a plugin that is not working as expected.
- Adding a new shipped plugin (see also `.agents/commands/ADD_PLUGIN.md`).

## Procedure

### Discovering Plugins

PW Studio discovers plugins from:

1. `~/.pw-studio/plugins/` — user global plugins
2. Optional extra directories configured in app settings
3. `pw-studio/plugins/` — plugins shipped with the app

All discovered plugins appear on the Plugin Manager page.

### Enabling a Plugin

1. **Globally** — Plugin Manager page → toggle the plugin on.
2. **For a specific project** — Project Integrations page → toggle the plugin on for that project.

Project enablement is stored in `.pw-studio/plugins/<plugin-id>.json` inside the project folder. This file can be committed to source control so the team shares the same plugin configuration.

### What Plugins Contribute

| Capability | Effect |
|---|---|
| Block definitions | New block kinds appear in the visual editor |
| Block templates | New templates appear in the Block Library |
| Recorder transforms | Codegen output is post-processed when saving a recording |
| Project setup hooks | Run once when the plugin is enabled for a project |
| Routes | Additional API endpoints (advanced) |
| UI metadata | Extra labels or icons in the UI |

### Troubleshooting

- **Plugin not loading** — check the Plugin Manager page for a load error message. The plugin may have a missing or invalid manifest.
- **Block templates not appearing** — confirm the plugin is enabled for the *project*, not just globally.
- **Recorder transform not applied** — confirm the plugin is enabled for the active project and the transform is registered for the correct recorder flow.

## Notes

- Plugins run in the same process as the PW Studio server — only install plugins from trusted sources.
- Plugin state changes (enable/disable) take effect immediately without restarting the app.
