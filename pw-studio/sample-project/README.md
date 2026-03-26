# PW Studio Sample Project

This is a small working Playwright project designed to be your first project in PW Studio.

## Getting Started

1. Open PW Studio.
2. Click **Import Project**.
3. Select this folder.
4. The Health Panel will guide you through any missing dependencies.

## Tests

- `tests/smoke/homepage.spec.ts` — verifies the homepage loads with the correct title.
- `tests/checkout/navigation.spec.ts` — verifies docs navigation and search functionality.

## Environment

The `environments/local.json` file is pre-configured with `baseURL` pointing to `https://playwright.dev`.
