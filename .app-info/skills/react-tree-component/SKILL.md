# SKILL: React Tree Component

## Purpose

Conventions for building the file explorer tree UI in the renderer process.

## When to Use

- Phase 3: Explorer tree rendering
- Any time the tree UI needs enhancement

## Recommended Library

**Use `react-arborist`** — purpose-built for file-explorer-style trees with:
- Virtual scrolling (handles thousands of nodes)
- Keyboard navigation built in
- Drag-and-drop support (v1: not needed, but available for v2)
- Full control over node rendering

```bash
npm install react-arborist
```

Alternative: `react-complex-tree` (more feature-rich but heavier). For PW Studio v1, react-arborist is sufficient.

## Tree Data Model

Map `ExplorerNode` types to tree data:

```typescript
type ExplorerNode = FolderNode | FileNode | TestNode

type FolderNode = {
  type: 'folder'; path: string; name: string;
  children: ExplorerNode[]
}
type FileNode = {
  type: 'file'; path: string; name: string;
  isTestFile: boolean; parseState: 'ok' | 'warning' | 'error';
  parseWarning?: string; children?: TestNode[]
}
type TestNode = {
  type: 'test'; title: string; parentFile: string;
  latestStatus?: 'passed' | 'failed' | 'skipped'
}
```

## Node Rendering

Each node type has distinct visual treatment:
- **Folder:** folder icon, expandable/collapsible
- **Test file:** test file icon (distinct from regular files), expandable to show test nodes
- **Regular file:** standard file icon
- **Test node:** test icon with status indicator (passed=green, failed=red, skipped=grey)
- **Parse warning:** warning icon overlay on file node

## Context Menus

Use a lightweight context menu — either custom-built or a library like `@radix-ui/react-context-menu`.

Per node type:
- **Folder:** "Run folder", "New test file", "New folder"
- **File:** "Run file", "Debug file", "Open in editor", "Set artifact policy"
- **Test node:** "Run test", "Debug test"

## State Management

- Expanded/collapsed state stored in `.pwstudio/project.json` (`explorer.expandedPaths`)
- Selection state in React state (not persisted)
- Tree data fetched via IPC (`explorer:getTree`)
- Live refresh on `EXPLORER_REFRESH` push event

## Rules

1. **Use virtual scrolling** — projects may have hundreds of test files.
2. **Fetch tree data via IPC** — never read the filesystem from renderer.
3. **Parse errors don't break the tree** — show warning icon, hide children.
4. **Context menu actions are stubs in Phase 3** — functional in Phase 4+.
5. **Persist expanded state** — restore on next open via `.pwstudio/project.json`.
