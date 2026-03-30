# DESIGNER — PW Studio Extension

## Extends: `.agents/agents/DESIGNER.md`

## App-Specific Conventions

### Renderer Architecture
- All UI code lives in `src/renderer/src/`.
- React with TypeScript — no `any`.
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
- Graceful degradation — parse errors do not break the explorer.
- Health errors disable run buttons but show a "Force run" escape.
- Live refresh on push events — no full page reload.
- Scroll to bottom for log streaming unless the user has scrolled up.

---

## Design System — PW Studio

All visual tokens are defined as CSS custom properties in `src/renderer/src/App.css`.
**Never hardcode a colour, shadow, or border-radius — always use a token.**

### Theme System
- Light and dark themes are supported.
- Theme is stored in `localStorage` under key `pw-studio-theme` (`'light' | 'dark' | 'system'`).
- The resolved theme is written as `data-theme="light"` or `data-theme="dark"` on `<html>`.
- Use `useTheme()` from `src/renderer/src/contexts/ThemeContext.tsx` to read or change the theme.
- Token overrides for dark mode live in the `[data-theme="dark"]` block in App.css.

### Core Tokens

#### Surfaces
| Token | Light | Dark | Use for |
|---|---|---|---|
| `--bg` | `#f4f6fb` | `#0d1117` | Page/app background |
| `--surface` | `#ffffff` | `#161b22` | Cards, panels, modals, inputs |
| `--surface-2` | `#f8fafc` | `#1c2432` | Subtle tinted area |
| `--surface-3` | `#f1f5f9` | `#21262d` | Hover states, inactive tabs |
| `--surface-4` | `#e8edf5` | `#2d333b` | Deeper hover |

#### Borders
| Token | Light | Dark |
|---|---|---|
| `--border` | `#e2e8f0` | `#30363d` |
| `--border-2` | `#cbd5e1` | `#444c56` |
| `--border-3` | `#b0bcce` | `#545d68` |

#### Text
| Token | Light | Dark | Semantic use |
|---|---|---|---|
| `--text-1` | `#1e293b` | `#e6edf3` | Headings, primary |
| `--text-2` | `#475569` | `#adbac7` | Body, secondary |
| `--text-3` | `#64748b` | `#8b949e` | Tertiary, helpers |
| `--text-4` | `#94a3b8` | `#6e7681` | Muted, placeholder |

#### Accent (brand)
| Token | Light | Dark |
|---|---|---|
| `--accent` | `#4361ee` | `#5b7fff` |
| `--accent-hover` | `#3a56d4` | `#7b95ff` |
| `--accent-tint` | `rgba(67,97,238,0.08)` | `rgba(91,127,255,0.12)` |
| `--accent-tint-2` | `rgba(67,97,238,0.15)` | `rgba(91,127,255,0.22)` |
| `--accent-tint-3` | `rgba(67,97,238,0.25)` | `rgba(91,127,255,0.35)` |

#### Status
| Token | Purpose |
|---|---|
| `--green`, `--green-tint`, `--green-border`, `--green-text` | Success / health-pass |
| `--amber`, `--amber-tint`, `--amber-border`, `--amber-text` | Warning |
| `--red`, `--red-tint`, `--red-border`, `--red-text`, `--red-text-2` | Error / danger |

#### Shadows
| Token | Value (light) |
|---|---|
| `--shadow-xs` | `0 1px 2px rgba(15,23,42,0.04)` |
| `--shadow-sm` | `0 1px 3px rgba(15,23,42,0.06)` |
| `--shadow-md` | `0 4px 12px rgba(15,23,42,0.08)` |
| `--shadow-lg` | `0 8px 24px rgba(15,23,42,0.12)` |

#### Border Radii
| Token | Value | Use |
|---|---|---|
| `--r-sm` | `6px` | Inputs, small chips |
| `--r-md` | `8px` | Cards, dropdowns |
| `--r-lg` | `10px` | Block cards, list items |
| `--r-xl` | `12px` | Main panels |
| `--r-2xl` | `16px` | Large panels, modals |
| `--r-pill` | `999px` | Pill shapes, toggles |

#### Transitions
| Token | Value |
|---|---|
| `--transition-fast` | `0.12s ease` |
| `--transition-normal` | `0.18s ease` |

#### Sidebar (always dark, independent of theme)
```css
--sidebar-bg, --sidebar-hover, --sidebar-border,
--sidebar-text-muted, --sidebar-text-strong, --sidebar-accent
```

#### Block category colours (block editor)
```css
--cat-nav, --cat-nav-tint        /* Navigation — blue */
--cat-act, --cat-act-tint        /* Actions — green */
--cat-assert, --cat-assert-tint  /* Assertions — violet */
--cat-adv, --cat-adv-tint        /* Advanced — grey */
```

---

### Block Editor (bed-*) Component System

The visual block editor uses the `bed-*` CSS prefix. Classes are defined in App.css.
When adding new sections or components to the block editor, use the existing `bed-*` token-based classes rather than creating ad-hoc styles.

Key layout classes:
- `bed` — root flex column
- `bed-header` — top bar (title input + tabs + actions)
- `bed-body` — main grid (canvas area + sidebar)
- `bed-canvas-area` + `bed-canvas-scroll` — left scrollable canvas
- `bed-flow` — vertical flow chart container
- `bed-node` — single step row (number badge + card)
- `bed-node-card` — the card itself (accepts `data-cat` attribute for category border colour)
- `bed-node-header` / `bed-node-body` — always-visible header / collapsible properties
- `bed-connector` — CSS-only arrow between nodes
- `bed-sidebar` — right sidebar (library + browser instance)
- `bed-library` — block library section with search
- `bed-browser-instance` — browser preview placeholder

---

### Adding New Tokens

Before adding a new visual value:
1. Check whether an existing token covers the use case.
2. If not, add the token to BOTH `:root` (light) and `[data-theme="dark"]` blocks in App.css.
3. Name the token semantically (e.g. `--surface-editor-bg`, not `--grey-100`).
4. Document it in this file.

---

### Do Not

- Do not hardcode `#ffffff`, `#1e293b`, or any other colour value in component CSS.
- Do not use inline `style` for colours, borders, or shadows — use a class.
- Do not invent new breakpoints — use the two existing ones (`960px`, `720px`).
- Do not add Tailwind or any CSS framework — this project uses plain CSS with custom properties.
