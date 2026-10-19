# MongoDB Migration Roadmap

This roadmap refines the project phases for the requested MongoDB application storage while preserving SQL Software's SQL practice workflow.

## Storage boundary

- **MongoDB:** user profiles, credentials metadata (password hashes only), sessions, question content, question sets, attempts, progress, bookmarks/revision marks, imports/reviews, snapshots/metadata, collections, audit events, feature configuration, and interview/learning records.
- **PostgreSQL:** isolated SQL practice databases and their schemas/tables/rows, plus the SQL execution engine. Do not store SQL practice datasets as Mongo documents or pretend MongoDB executes SQL.
- **API:** authorization and ownership checks apply before either store is read or mutated. MongoDB and PostgreSQL credentials remain backend-only.

## Phase order and gates

Verified status as of 2026-10-19: Phase 1 is complete. Phase 2 through Phase 6 have partial implementation only; Phase 7 is blocked on live database and deployment validation. Detailed evidence is in `PROJECT_AUDIT.md` and `FINAL_QA_REPORT.md`. Do not treat the planned milestones below as completed work.

1. Audit (complete): document the existing architecture, verified features, test limits, risks, and migration boundary in `docs/PROJECT_AUDIT.md`.
2. Security stabilization: fix multipart ownership checks, constrain SQL imports, remove insecure secret defaults, and add behavior tests. Gate: backend build and security tests pass in an environment with installed dependencies and isolated databases.
3. Mongo foundation: add MongoDB driver, connection lifecycle, indexes, configuration validation, health checks, and local Compose service. Keep the existing PostgreSQL service for SQL execution. Gate: clean startup/shutdown, unavailable-store behavior, unique user email/session token indexes.
4. Application data migration: create Mongo repositories for user/session/auth/audit, workspace metadata, questions/sets, attempts/progress/revisions, imports/snapshots, collections, flags, and jobs. Replace application SQL queries with Mongo operations; retain PostgreSQL only for practice DDL/DML and read-only query execution. Gate: API contract and ownership regression tests pass.
5. Existing data migration: implement a dry-run and resumable importer from current PostgreSQL application tables into MongoDB. Reconcile records and foreign-key relationships using stable IDs. Never delete source PostgreSQL tables automatically. Gate: counts, sample records, ownership, and SQL workspace mappings verify before cutover.
6. Learning dashboard/question engine: build on Mongo-backed models and add module/topic/content/progress behavior incrementally. Gate: persistence across restarts and user isolation tests pass.
7. Python Lab: build UI/content and a runner contract. Real execution is unavailable until a separate isolated runner is deployed and verified.
8. PySpark Lab: build UI/content and a runner contract. Real execution is unavailable until isolated Spark infrastructure is configured.
9. Azure, Databricks, ETL, and mock interviews: add educational scenario content and persisted sessions. Real cloud integrations require explicit configuration and authorization.
10. Final QA/release: test clean installs, migrations, rollback, store outages, builds, security, and deployment. Report simulated/unavailable functions accurately.

## Migration requirements

- Use additive Mongo collections and indexes; define document validation where it protects contracts.
- Keep stable IDs or an explicit old-to-new ID map so existing workspace references remain valid.
- Make the importer idempotent and resumable; support dry-run and per-collection reconciliation.
- Back up both stores before production migration. Cut over through an explicit deployment step, not an automatic destructive startup migration.
- Preserve the existing API response shapes during the storage refactor.
- Do not migrate practice table rows out of PostgreSQL unless a separate SQL-compatible execution service is deliberately selected and verified.
- Never put secrets in documents, frontend bundles, logs, or committed environment files.

## Required release evidence

Each phase reports changed files, migration behavior, test commands/results, build status, manual checks, remaining risks, and whether any capability is simulated. Production cutover is blocked until the MongoDB migration is reconciled and SQL execution remains isolated and functional.