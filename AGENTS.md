# Repository Guidelines

## Project Structure & Module Organization

Backend Python code lives in `src/gradientbang/`. Key areas include `pipecat_server/` for the bot, `byoa/` for bring-your-own-agent support, `subagents/` for task agents, `adapters/` for bus/event integrations, `utils/` for shared helpers, `scripts/` for CLI entry points, and `newspaper/` for news/image generation tools. Tests are in `tests/unit/`, `tests/integration/`, and `tests/eval/`. Supabase schema, functions, and deployment files are under `deployment/supabase/`; bot deployment files are in `deployment/`. The React workspace is in `client/`, with `client/app`, `client/starfield`, and `client/combat-sim`.

## Build, Test, and Development Commands

- `uv sync --all-groups`: install backend dependencies from `pyproject.toml` and `uv.lock`.
- `uv run pytest tests/unit`: run fast backend unit tests.
- `bash scripts/run-integration-tests.sh`: run integration tests that require a local Supabase stack.
- `uv run bot`: start the Pipecat bot locally.
- `uv run functions`: serve Supabase edge functions via the project wrapper.
- `cd client && pnpm install`: install frontend workspace dependencies.
- `cd client && pnpm dev`: run the main web client with Vite.
- `cd client && pnpm build`: type-check and build all client packages.
- `cd client && pnpm lint`: run frontend ESLint through turbo.

## Coding Style & Naming Conventions

Python targets 3.12 and uses Ruff with a 100-character line length. Keep modules lowercase with underscores, tests named `test_*.py`, and async tests compatible with `pytest-asyncio` auto mode. Prefer existing adapter/factory patterns before introducing new abstractions. TypeScript packages are ESM; use React component names in PascalCase, hooks as `useThing`, and shared helpers in camelCase. Frontend formatting is Prettier-backed through lint-staged.

## Testing Guidelines

Add unit tests beside related behavior in `tests/unit/` and reserve `tests/integration/` for Supabase, server, or external-process coverage. Use pytest markers already declared in `pyproject.toml` such as `unit`, `integration`, `requires_server`, `live_api`, and `llm`. Avoid live API tests unless the required keys are documented and the marker is explicit.

## Commit & Pull Request Guidelines

Recent history uses short, direct commit subjects such as `session queue and bus cleanup`, `fixed create replace`, and `release: v0.5.3`. Keep commits focused and imperative where possible. Pull requests should include a concise description, testing performed, linked issue or context, and screenshots or preview links for client UI changes. Note any required environment, migration, or deployment steps.

## Security & Configuration Tips

Do not commit real secrets. Use `env.bot.example`, `env.byoa.example`, and `env.supabase.example` as templates for local `.env.*` files. Keep `uv.lock` and `client/pnpm-lock.yaml` updated when dependencies change.
