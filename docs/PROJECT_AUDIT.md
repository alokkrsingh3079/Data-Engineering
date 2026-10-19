# Project Audit

Audit date: 2026-10-19

## Scope and evidence

This audit inspected the backend persistence and SQL execution code, authentication and operations helpers, the main frontend/API call paths, Docker Compose and deployment documentation, and the existing backend security tests. The local `backend/.env` was not opened. No production database or credentials were accessed.

Commands actually run:

| Command | Result |
|---|---|
| `npm --prefix backend test` | Passed: 7 tests. These tests primarily inspect source text; they do not exercise a live database or API. |
| `npm --prefix backend run check` | Blocked: `tsc` is not installed because backend dependencies are absent. |
| `npm --prefix backend run build` | Not run; the preceding check failed and the chained command stopped. |
| `npm --prefix backend ls --depth=0` | Confirmed backend dependencies are missing. |

The worktree already contained a modified root `package-lock.json` before audit edits. It was left untouched.

## Architecture

- Frontend: React 18 and Vite, with the SQL workspace and account/admin/interview views calling the Express API.
- API: Node.js, Express, TypeScript, Zod, Multer, and the OpenAI SDK.
- Current persistence and SQL execution: PostgreSQL through `pg`. `backend/src/db.ts` initializes application tables and also creates per-workspace PostgreSQL schemas, inspects their tables, imports SQL, runs read-only practice queries, and stores snapshots.
- Deployment: Docker Compose currently provisions PostgreSQL and the API. The Cloudflare Worker serves frontend assets and proxies `/api/*` to the Node API.
- No MongoDB driver, MongoDB URI, MongoDB service, or MongoDB persistence code was found in the inspected backend/configuration.

## Verified feature inventory

| Area | Status | Evidence / limitation |
|---|---|---|
| Account registration, login, logout, role checks | Implemented; needs runtime tests | Routes use PostgreSQL users/sessions and HttpOnly cookies. |
| Per-user SQL workspaces | Implemented; needs runtime tests | PostgreSQL `app_databases.owner_user_id` and per-user schemas. |
| SQL editor, schema/table exploration, imports, snapshots | Implemented; security concerns below | API routes call PostgreSQL schema and import helpers. |
| SQL execution and output comparison | Implemented; needs stronger security validation | Single-statement/read-only keyword checks, transaction read-only mode, statement timeout, and bounded `work_mem` exist. |
| SQL questions, generated sets, starter questions, collections | Implemented; needs database-backed integration tests | Stored as PostgreSQL tables; AI questions are executed against a practice schema before acceptance. |
| Attempts, revision marks, progress and analytics | Implemented; needs isolation tests | Stored in PostgreSQL; the current tests only assert source patterns. |
| AI tutor and image schema extraction | Implemented when provider credentials are configured | Server-side OpenAI integration; provider-failure and prompt-safety testing is not evidenced. |
| Python Lab and isolated Python execution | Not implemented | No Python runner or module was found in the inspected workspace. |
| PySpark Lab and isolated Spark execution | Not implemented | No Spark runtime or runner was found. |
| Azure, Databricks, ETL learning modules and AI mock interviews | Partial/planned | There is an SQL interview flow, but not the full roadmap modules or persistent interview sessions. |
| Production deployment | Documented, not verified | Deployment docs describe Node API + PostgreSQL + Worker; no production build or deployment was run. |

## Current PostgreSQL data model

`initDb()` creates application collections/tables for `users`, `sessions`, `app_databases`, `challenges`, `question_sets`, `attempts`, `question_revision_marks`, `schema_imports`, `database_snapshots`, `challenge_flags`, `question_reviews`, `question_collections`, `collection_questions`, `audit_logs`, `feature_flags`, `api_usage_daily`, and `refresh_jobs`.

Separately, PostgreSQL schemas contain learner SQL-practice tables and rows. Those schemas are the execution environment for the SQL product, not merely application metadata. Replacing that engine with MongoDB would remove the feature the user explicitly wants to keep. Target architecture: MongoDB stores platform/user/learning records; PostgreSQL remains a constrained SQL practice runtime. Store each practice database's owner, metadata, and PostgreSQL schema identifier in MongoDB.

## Security findings

### Medium: multipart import ownership is not checked after parsing

The `/api` authentication/ownership middleware runs before route-level `upload.single('file')` middleware. For multipart requests, `databaseId` is not available to the shared guard at that point. The SQL file import and image import handlers later read `req.body.databaseId` and call `dbRow()` without checking that the authenticated user owns that database. A signed-in user who obtains another workspace's UUID can target its imports. Verify ownership inside each handler after Multer parses the form, before reading or mutating the database. The same principle applies to future multipart routes.

### High: SQL import executes uploaded SQL with the API's PostgreSQL role

`executeImport()` submits the provided SQL directly to the shared PostgreSQL connection after setting a search path; it does not constrain statements to a practice schema or use a separate least-privilege role. The SQL import route accepts uploaded SQL and the API connection is also used for application tables. An imported script can therefore attempt operations outside the learner's intended schema. Use a dedicated constrained execution role and validate/import within an isolated database or schema boundary; add tests for attempts to alter application schemas and other workspaces. Do not expose this import path to production until the execution permissions are verified.

### High: insecure authentication fallbacks

`auth.ts` falls back to `change-me-in-production` for `AUTH_SECRET`; `ops.ts` also has a predictable default administrator password. Deployment documentation requires production secrets, but the application code does not fail startup when those variables are absent. Reject missing/weak production secrets and require an explicit admin bootstrap password or one-time setup flow.

### Medium: SQL read-only checks are not a substitute for database privileges

The read-only executor combines statement prefix/keyword checks with PostgreSQL read-only transactions and a timeout. This is stronger than prefix checks alone, but the inspected code does not establish a dedicated least-privilege PostgreSQL role or prove behavior for every callable function and schema. Verify with integration tests under a restricted role before production claims.

## MongoDB migration decisions

1. Use the official MongoDB Node driver and a server-only `MONGODB_URI` plus database name. Do not place Mongo credentials in frontend or Worker configuration.
2. Move account, session, question, question-set, attempt, progress/revision, import-review, snapshot metadata, collection, audit, feature-flag, and operational records to MongoDB.
3. Keep uploaded practice table definitions and rows in PostgreSQL so submitted SQL continues to execute as SQL. MongoDB stores the workspace ownership and schema mapping.
4. Provide an explicit, resumable PostgreSQL-to-Mongo migration with dry-run/verification, backups, idempotent checkpoints, and no destructive source drops. Do not switch production until counts and representative records reconcile.
5. Make both stores' health/readiness explicit. The API must not silently start with default auth credentials or claim healthy when a required store is unavailable.
6. Preserve the existing SQL APIs and frontend contract while repositories are migrated; add tests for Mongo persistence and cross-user isolation.

## Prioritized next phases

1. **Stabilize/security:** fix multipart ownership, isolate SQL imports with least privilege, and remove weak production secret fallbacks. Add runtime-oriented tests where dependencies and services are available.
2. **MongoDB persistence:** add Mongo connection/configuration and repositories, migrate platform records while retaining PostgreSQL SQL execution, provide data migration and verification, then update Compose/deployment docs.
3. **Learning foundation:** generalize the existing question/progress model in MongoDB and add the learning dashboard only after migration tests pass.
4. **Python Lab:** content/editor first; real code execution stays disabled until a separate hardened runner is available.
5. **Spark Lab:** content/editor first; real Spark execution stays disabled until isolated Spark infrastructure is configured.
6. **Azure/Databricks/ETL/mock interviews:** implement educational scenarios and persisted sessions; label integrations/simulations accurately and do not provision paid resources.
7. **Final QA:** reconcile migrations, run authorization and regression suites, document deployment/rollback, and report actual readiness.

## Blockers and next safe action

Backend packages are not installed in this workspace, so TypeScript checks/builds and live API tests could not be run. Install dependencies from the existing lockfile before code changes are accepted. The next code task is the Phase 2 security slice, beginning with post-Multer ownership checks; the MongoDB migration should follow with a verified schema/data migration plan rather than a destructive database swap.