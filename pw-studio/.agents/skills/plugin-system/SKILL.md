# SKILL: plugin-system

## Purpose

Guide the correct implementation of plugin discovery, registration, and use of plugin extension points in PW Studio.

## When to Use

- Adding a new plugin extension point to core.
- Creating or modifying a shipped local plugin in `plugins/`.
- Implementing plugin discovery, loading, or validation logic.
- Enabling or disabling a plugin for a specific project.

## Procedure

### Plugin Discovery

Plugins are discovered from three locations (in order):

1. `~/.pw-studio/plugins/` — user global plugins
2. Optional configured extra directories (from app settings)
3. `pw-studio/plugins/` — shipped local plugins (relative to the app root)

Discovery must not fail silently — log any directories that are inaccessible or contain invalid plugins.

### Plugin Manifest

Every plugin must export a manifest that identifies:

- `id` — unique string identifier
- `name` — human-readable display name
- `version` — semver string
- Declared extension points (recorder transforms, block definitions, templates, routes, UI metadata)

Validate the manifest at load time — reject plugins with missing or malformed manifests.

### Extension Points

Core provides these extension points:

| Extension point | Purpose |
|---|---|
| Recorder transforms | Post-process codegen output |
| Block definitions | Add new visual block kinds |
| Block templates | Add new block templates to the library |
| Project setup hooks | Run setup logic when a project is enabled |
| Routes | Register additional Express routes |
| UI metadata | Contribute labels, icons, or metadata to the UI |

When adding a new extension point:
1. Define the interface in `src/shared/types/ipc.ts` (plugin manifest section).
2. Implement the registration call in `src/server/plugins/`.
3. Document the extension point in `.agents/skills/plugin-system/SKILL.md` (this file).

### Project Enablement

- Project-level enablement state is stored in `.pw-studio/plugins/<plugin-id>.json` inside the project folder.
- Do not store enablement state in the PW Studio SQLite database.
- When a project integration is enabled or disabled, emit `WS_EVENTS.PLUGIN_STATE_CHANGED` so the UI updates.

### Shipped Plugins

- Shipped plugins live in `pw-studio/plugins/` and are always available.
- They follow the same manifest and extension point contract as user plugins.
- Keep shipped plugin logic self-contained — do not let them reach into core internals beyond the defined extension points.

## Output / Expected Result

- A plugin that loads, validates its manifest, and registers its extension points.
- Project enablement persisted to `.pw-studio/plugins/<plugin-id>.json`.
- Any new extension point defined in shared types and registered in the plugin loader.

## Notes

- Plugins run in the same process as the server — there is no sandbox. Trust only plugins from known sources.
- Plugin load errors must be logged and surfaced in the plugin manager UI, not silently swallowed.
