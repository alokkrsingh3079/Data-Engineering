# Final QA Report

Status: **Not production-ready**
Review date: 2026-10-19

## Verified checks

| Check | Result | Evidence |
|---|---|---|
| Backend source/regression tests | Passed | `npm test` in `backend/`; latest full run: 30 passed, 2 opt-in database integrations skipped by default. |
| Backend TypeScript build | Passed | `npm --prefix backend run build`. |
| Frontend TypeScript and production build | Passed | `npm --prefix frontend run build`. Route-level lazy loading splits the SQL workspace and learning/interview views; the largest emitted view chunk is about 392 kB, with no Vite 500 kB warning. |
| Frontend production dependency audit | Passed | `npm --prefix frontend audit --omit=dev`; 0 production vulnerabilities reported. |
| Full frontend dependency audit | Findings | Frontend install reported 2 vulnerabilities in development-inclusive dependency tree; review with `npm --prefix frontend audit`. |
| Backend dependency audit | Passed at install | Backend install reported 0 vulnerabilities; Multer 1.x emitted a deprecation warning. |
| PostgreSQL isolation integration | Passed | `RUN_POSTGRES_INTEGRATION=1 node --import tsx --test test/postgres-isolation.integration.test.mjs` against a disposable PostgreSQL 17 container. Verified executor identity, separate schema permissions, read-only execution, role resource setting, cross-schema denial, and role cleanup. |
| MongoDB learning integration | Passed | `RUN_MONGO_INTEGRATION=1 node --import tsx --test test/mongo-learning.integration.test.mjs` against a disposable MongoDB 8 container. Verified answer-key redaction, attempts, retry filtering, bookmark persistence, completion, and learner isolation. |
| Learning API smoke test | Passed | Two disposable learner accounts exercised signup, authenticated question listing/detail, answer submission, retry filtering, bookmarks, cross-account isolation, and invalid pagination rejection against the running API. |
| Configured admin login | Passed | The administrator values from the local production example authenticated against disposable local databases; session cookie, admin metrics/users, wrong-password rejection, and anonymous-admin denial were verified. No production host or data was accessed. |
| Admin login smoke test | Passed | Disposable local admin login returned 200; authenticated admin metrics returned 200; incorrect password and unauthenticated admin metrics returned 401. Credentials from the attached environment excerpt were not used. |
| Runner contract | Passed | A local fake HTTP runner verified bearer authentication, health checks, request payload, bounded response parsing, and hidden test summaries. No Python or Spark runtime executed code. |
| Interview feedback schema | Passed | Unit test verifies rubric ranges and strict structured fields. Mongo integration verifies saved response/resume and evaluator-outage behavior using a stub; the configured AI provider was not called. |
| Runner-unavailable coding flow | Passed | Mongo integration verifies a code submission is not executed or recorded as successful when no runner is configured. |
| Migration dry-run/reconciliation | Not implemented / not run | Existing migrations copy records at startup; there is no dedicated dry-run reconciliation command. |
| End-to-end browser tests | Not configured / not run | No browser automation suite is present. |
| Cloud deployment / runner validation | Blocked | No cloud resources, Python runner, or Spark runtime were provisioned. |

The regular backend suite includes source-pattern checks and pure validation tests. The separate opt-in database integration tests above use disposable databases, not production data. The API smoke test did not cover every upload, SQL, AI, or browser workflow.

## Feature status

| Area | Status | Limitation |
|---|---|---|
| Authentication and account data | Partial | Mongo-backed runtime methods exist, but startup still copies from PostgreSQL and requires the legacy database. |
| SQL practice | Partial | PostgreSQL remains the execution engine. Per-workspace roles are isolated in a live disposable-database test; imports and reads are AST-validated, results are capped by rows and serialized bytes, and statement/temp-file limits are applied. Upload authorization regression and broader SQL function/behavior review remain. |
| Learning studio | Partial, substantially implemented | Mongo curriculum, reviewed MCQ/scenario/coding bank, search/filter/pagination, answer checks, hints, bookmarks, retries, attempts, resume, and topic progress. Mongo integration and two-account API smoke checks passed. Content authoring/review UI and some question formats remain. |
| Python | Partial | Lessons, coding editor/challenge, hidden-test contract, private bounded submissions, and external runner adapter exist. No isolated Python service is configured or verified, so execution is disabled. |
| PySpark/Spark | Partial | Spark lessons, PySpark coding exercise/editor, and runner adapter exist. No Spark runtime or execution plans are configured, so execution is disabled. |
| Azure/Databricks/ETL | Partial | Original educational lessons and scenario questions exist; no live Azure/Databricks integration. |
| Mock interviews | Partial | SQL sessions remain deterministic. Mongo learning interviews support owner-checked responses, deadlines, resume, rubric scores, follow-ups, reports, and saved answers during AI outage. Persistence passed with a stub evaluator; the configured AI provider was not called and browser E2E is absent. |
| MongoDB migration | Partial / release blocker | MongoDB stores several platform collections, but startup and runtime provisioning still access PostgreSQL application tables. No data cutover or source reconciliation is verified. |

## Security and release gates

- Do not remove PostgreSQL application tables or configure MongoDB as the only application database until a resumable, idempotent migration and reconciliation process exists.
- Database role creation requires `DATABASE_URL` to have role/schema provisioning privileges. Verify the deployment identity and `PRACTICE_ROLE_SECRET` rotation procedure before release.
- Multipart uploads still need broader live API coverage for spoofed MIME/content, oversized requests, and ownership failures across all relevant handlers.
- Do not enable Python or Spark execution until separate, hardened runner services are deployed and verified.
- Do not treat the test fake runner as a sandbox or execute learner code inside the Express API.
- Review the two frontend development dependency findings and upgrade the deprecated Multer dependency in a separately tested security change.
- Do not push or deploy as a production release based solely on these local tests.

## Next verification

1. Add API integration coverage for multipart uploads, SQL workspace ownership, and lesson progress.
2. Implement and reconcile an explicit PostgreSQL-to-Mongo importer before removing legacy application table dependencies.
3. Verify production database role provisioning and `PRACTICE_ROLE_SECRET` rotation.
4. Complete browser workflows and test mobile and desktop layouts.
5. Deploy and review isolated Python/Spark services before enabling execution.