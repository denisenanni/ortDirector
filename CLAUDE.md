@AGENTS.md

# Project rules

- ortDirector is a single-user app for managing my vegetable garden and ornamental
  plants. All data stays on the device (SQLite). Do not add accounts, auth, a backend,
  sync, analytics, telemetry or AI/LLM features. If a task seems to need one, stop and ask.
- The app UI is in Italian; code, comments and commit messages in English.
- Seed/sample data (plants, zones, tasks) must be invented, never real personal data.
- Never commit secrets or `.env` files.
- Third-party content (plant data, images, icons) only with an MIT-compatible license;
  record source and license in the README.
- Database changes go through a versioned migration (current pattern: DB vN).
- Every feature ships with tests: `node --test` for logic and database, Playwright
  for web e2e flows.
- Commits: one logical change each, descriptive message, keep `Co-Authored-By`.
  Never rewrite history, squash or force-push.
- Keep README.md, including its Roadmap section, up to date when features land.