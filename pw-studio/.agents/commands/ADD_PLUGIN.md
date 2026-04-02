# COMMAND: add-plugin

## Purpose

Enable or configure a plugin in PW Studio, or set up a new shipped plugin that contributes block templates, recorder transforms, or other capabilities to a project.

## Entry Criteria

- The plugin already exists and needs to be enabled, **or**
- A new plugin needs to be created that is specific to a system or platform being tested.

## Workflow

### Option A — Enable an Existing Plugin

1. Open the Plugin Manager page.
2. Find the plugin in the list — if it does not appear, check that it is placed in `~/.pw-studio/plugins/` or the configured plugin directory.
3. Enable the plugin globally.
4. Open the Project Integrations page for the target project.
5. Enable the plugin for that specific project.
6. Confirm the plugin's contributions are available (e.g., new block templates appear in the Block Library, recorder transforms are applied).

### Option B — Create a New Shipped Plugin

Use this when you need a plugin that contributes reusable test-level capabilities for a specific system (e.g., custom block kinds for a UI framework, recorder transforms for a specific app).

1. **Define scope** — confirm what the plugin will contribute: block definitions, block templates, recorder transforms, project setup hooks, or additional routes.
2. **Create the plugin folder** under `plugins/<plugin-name>/` in the `pw-studio/` directory.
3. **Write the plugin manifest** — unique `id`, `name`, `version`, and declared extension points.
4. **Implement each extension point**:
   - Block definitions: define the Playwright statement pattern and the block UI descriptor.
   - Block templates: define default configurations for the new block kinds.
   - Recorder transforms: write a transform function that post-processes codegen output.
5. **Test the plugin** — enable it for a project and confirm each contribution works end-to-end.
6. **Document the plugin** — add a `README.md` in the plugin directory describing what it contributes and how to configure it.

## Exit Criteria

- Plugin appears in the Plugin Manager.
- Plugin is enabled for the target project.
- Plugin contributions (blocks, templates, transforms) are visible and working.
- Plugin documented.

## Skill References

- `.agents/skills/plugin-system/SKILL.md` — discovery, enablement, and extension points
- `.agents/skills/block-editor/SKILL.md` — if the plugin contributes blocks or templates
