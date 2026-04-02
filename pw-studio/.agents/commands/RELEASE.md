# COMMAND: release

## Purpose

Guide the release workflow for PW Studio — build verification, PR, and version tag.

## Entry Criteria

- All features and fixes for this release are merged to `main`.
- Tests pass on `main`.

## Workflow

1. **Verify build** — run `npm run build` inside `pw-studio/`. Fix any failures before proceeding.
2. **Verify checks** — run `npm run lint` and `npm run typecheck`. Fix any failures.
3. **Update version** — bump the version in `pw-studio/package.json` following semver:
   - Patch (`x.x.1`) — bug fixes only.
   - Minor (`x.1.0`) — new features, backwards-compatible.
   - Major (`1.0.0`) — breaking changes.
4. **Update FEATURES.md** — confirm `.agents/app/FEATURES.md` reflects all completed features.
5. **Commit** — commit the version bump with message: `chore: release v<version>`.
6. **Tag** — create a git tag `v<version>`.
7. **Deployment agent** — delegate the push and any CI steps to the Deployment agent.

## Exit Criteria

- Build, lint, and typecheck all pass.
- Version bumped in `package.json`.
- Tag created and pushed.

## Notes

- Never force-push to `main`.
- Never skip pre-commit hooks.
- Confirm Reviewer sign-off exists before tagging a release.
