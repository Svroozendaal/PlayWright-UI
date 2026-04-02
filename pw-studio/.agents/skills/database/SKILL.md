# SKILL: database

## Purpose

Ensure all SQLite schema changes, migrations, and queries in PW Studio follow safe, consistent conventions.

## When to Use

- Adding a new database table or column.
- Writing or modifying a migration file.
- Adding or changing a query in any service.

## Procedure

### Migrations

1. Create a new migration file in `src/server/db/` — use a sequential numeric prefix (e.g., `004_add_suite_runs.ts`).
2. Every migration must be additive where possible — avoid dropping columns unless the column is new and unreleased.
3. Migrations run in order at startup — never reorder or renumber existing files.
4. Test migrations on a clean database before finalising.
5. Do not put business logic in migrations — schema changes only.

### Schema Conventions

- Use snake_case for table and column names.
- Always include `id INTEGER PRIMARY KEY AUTOINCREMENT` or a clearly documented primary key.
- Include `created_at` and `updated_at` timestamps where the row represents a persistent entity.
- Foreign keys must reference the parent table's primary key explicitly.

### Queries

1. Use parameterised queries — never interpolate user input into SQL strings.
2. Keep query logic in dedicated service or repository functions — no raw SQL in route handlers.
3. Wrap multi-step writes in transactions to ensure atomicity.
4. Return typed results — map rows to TypeScript interfaces before returning from the service layer.

### Key Tables (reference)

| Table | Purpose |
|---|---|
| `projects` | Registered project metadata |
| `runs` | Run history and status |
| `run_results` | Per-test results within a run |
| `artefacts` | Artefact paths and policy flags |
| `suites` | Suite definitions per project |
| `suite_runs` | Suite execution history |
| `settings` | Key-value app settings |

## Output / Expected Result

- A numbered migration file that adds the schema change.
- Typed query functions in the relevant service.
- No raw SQL in route handlers.

## Notes

- `better-sqlite3` is synchronous — do not wrap calls in unnecessary async/await.
- In-memory or temporary-file SQLite instances are acceptable for tests.
