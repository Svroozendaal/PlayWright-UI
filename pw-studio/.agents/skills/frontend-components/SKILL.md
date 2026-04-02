# SKILL: frontend-components

## Purpose

Guide the creation and modification of React pages and components in PW Studio following the existing patterns for API consumption, WebSocket events, and UI structure.

## When to Use

- Adding a new page or modifying an existing page in `src/renderer/src/pages/`.
- Creating or updating a shared component in `src/renderer/src/components/`.
- Writing or modifying a custom hook in `src/renderer/src/hooks/`.
- Consuming a REST endpoint or WebSocket event from the frontend.

## Procedure

### Pages

1. Place page components in `src/renderer/src/pages/` — one file per route area.
2. Follow the naming convention of existing pages (e.g., `RunsPage.tsx`, `ExplorerPage.tsx`).
3. Each page is responsible for fetching its own data and passing it down to child components.
4. Register new pages in the React Router configuration (find the router setup in `src/renderer/src/`).

### Components

1. Place shared components in `src/renderer/src/components/`.
2. Read existing components before creating a new one — reuse first.
3. Keep components focused on a single responsibility.
4. Pass data via props; lift state only when two siblings need the same data.

### API Consumption

1. Fetch data using the existing API client utilities — do not use raw `fetch` without the shared base URL.
2. Always handle both `payload` and `error` from `ApiEnvelope<T>`:
   ```ts
   const res = await apiClient.get<MyType>(API_ROUTES.MY_ROUTE)
   if (res.error) { /* handle */ }
   const data = res.payload
   ```
3. Use `API_ROUTES` constants for endpoint paths — never hardcode URL strings.
4. Show loading and error states in the UI — never silently ignore failures.

### WebSocket Events

1. Use `WS_EVENTS` constants for channel names.
2. Subscribe to events via the existing WebSocket hook or context — do not create new raw WebSocket connections.
3. Unsubscribe on component unmount to avoid memory leaks.

### Conventions

- Use UK English for all visible text labels, headings, button labels, and error messages.
- Follow existing styling patterns — do not introduce a new CSS-in-JS library or class naming convention without Architect approval.
- Keep the UI consistent with the existing design across all pages.

## Output / Expected Result

- A page or component that correctly consumes the API using `ApiEnvelope<T>` and handles the error path.
- WebSocket subscriptions that clean up on unmount.
- New pages registered in the router.

## Notes

- The renderer has no direct filesystem or Node.js access — all system operations go through the API.
- Do not import server-side modules into renderer code.
