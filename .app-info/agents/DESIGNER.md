# DESIGNER - PW Studio Extension

## Extends: `.agents/agents/DESIGNER.md`

## App-Specific Conventions

### Renderer Architecture
- All UI code lives in `src/renderer/src/`.
- React with TypeScript - no `any`.
- `BrowserRouter` from `react-router-dom`.
- Access the backend only via the fetch client in `src/renderer/src/api/client.ts` and WebSocket helpers in `src/renderer/src/api/useSocket.ts`.

### API in Components
- Handle both `payload` and `error` from every API call.
- Use `useSocketEvent()` for push updates and rely on hook cleanup.
- Keep route paths and event names in shared constants.

### Component Patterns
- Pages in `src/renderer/src/pages/`.
- Reusable components in `src/renderer/src/components/`.
- API helpers in `src/renderer/src/api/`.
- State kept local unless a shared store is clearly needed.

### Screens
| Screen | Route | Phase |
|---|---|---|
| Projects | `/` | 1 |
| Dashboard | `/project/:id` | 2 |
| Explorer | `/project/:id/explorer` | 3 |
| Runs | `/project/:id/runs` | 4 |
| Run Detail | `/project/:id/runs/:runId` | 4 |
| Recorder | `/project/:id/recorder` | 6 |
| Settings | `/settings` | 1 (basic), 6 (environments) |

### UI Principles
- Graceful degradation - parse errors do not break the explorer.
- Health errors disable run buttons but show a "Force run" escape.
- Live refresh on push events - no full page reload.
- Scroll to bottom for log streaming unless the user has scrolled up.

---

## Design System - PW Studio

All visual tokens are defined as CSS custom properties in `src/renderer/src/App.css`.
Never hardcode a colour, shadow, radius, or spacing value when a token can represent it.

### Theme System
- Light and dark themes are supported.
- Carbon Logic accent/status colours apply to dark mode only unless the task says otherwise.
- Theme is stored in `localStorage` under key `pw-studio-theme` (`'light' | 'dark' | 'system'`).
- The resolved theme is written as `data-theme="light"` or `data-theme="dark"` on `<html>`.
- Use `useTheme()` from `src/renderer/src/contexts/ThemeContext.tsx` to read or change the theme.
- Token overrides for dark mode live in the `[data-theme="dark"]` block in `App.css`.

### Carbon Logic Rules
- The visual style is industrial-tech, dense, sharp, and functional.
- Use 2px to 4px radii for dark-mode shell and data widgets.
- Prefer borders and subtle inner highlights over decorative shadows.
- Environment colours are for shells and surfaces only.
- Functional colours are reserved for status, logic typing, or primary actions.
- Use monospace for dense data, tabs, labels, tables, and metrics where it improves scan speed.
- Use sans-serif for headings, navigation, and prose UI labels.
- Global shell pattern: fixed header, collapsible side rail, central workspace.

### Environment Colours
Use these for shells, containers, tables, sidebars, and non-status surfaces.

| Token | Dark value | Use |
|---|---|---|
| `--cl-bg` | `#121212` | Primary app background |
| `--cl-surface` | `#1A1A1A` | Panels, cards, sidebars |
| `--cl-surface-2` | `#161616` | Deep inset zones |
| `--cl-stroke` | `#252626` | Borders and dividers |
| `--cl-text-primary` | `rgba(255,255,255,0.9)` | Headings and key data |
| `--cl-text-secondary` | `#A1A1AA` | Labels and helper text |

### Functional Colours
Use these only for status, logic type, or the primary call to action.

| Token | Dark value | Meaning |
|---|---|---|
| `--cl-success` | `#4AE183` | Passed, healthy, primary execute CTA |
| `--cl-danger` | `#FF5C5C` | Failed, critical, recording state |
| `--cl-warning` | `#FDB022` | Flaky, warning |
| `--cl-nav` | `#3B82F6` | Navigation logic |
| `--cl-action` | `#F59E0B` | Interaction logic |
| `--cl-assert` | `#8B5CF6` | Assertions and verification |

### Shell Tokens
- Keep shell-level tokens semantic and reusable: `--shell-header-height`, `--shell-rail-width`, `--shell-content-padding`, `--panel-gap`.
- The side rail should support a compact 64px state and an expanded 240px state.
- Shared panels, tables, badges, and collapsed blocks should inherit from shell tokens, not define their own colours.

### Required Reuse Patterns
- Shared shell header class for all project routes.
- Shared content container class for all project pages.
- Shared panel/card class for metrics, tables, and sidebars.
- Shared status badge classes driven by semantic tokens.
- Shared monospace utility for metrics, table headers, IDs, and logs.

### Block Editor
- The visual block editor uses the `bed-*` CSS prefix and should align to Carbon Logic shell tokens.
- Use left-edge logic colour bars for block typing.
- Keep collapsed blocks narrow, wide, and high-density.
- Reuse the shared functional colour tokens for navigation, interaction, and assertion categories.

### Adding New Tokens
Before adding a new visual value:
1. Check whether an existing token covers the use case.
2. If not, add the token to both `:root` and `[data-theme="dark"]` in `App.css`.
3. Name the token semantically, not by raw colour.
4. Document it in this file.

### Do Not
- Do not hardcode colour values in component markup or CSS.
- Do not use status colours as decoration on neutral surfaces.
- Do not invent new breakpoints - use the existing project breakpoints unless a wider refactor is approved.
- Do not add Tailwind or another CSS framework - this project uses plain CSS with custom properties.
