# Final QA Report

Status: **Not production-ready**
Review date: 2026-10-19

## Verified checks

| Check | Result | Evidence |
|---|---|---|
| Backend source/regression tests | Passed | `npm test` in `backend/`; 18 tests after the SQL-guard and interview-session additions. |
| Backend TypeScript build | Passed | `npm --prefix backend run build`. |
| Frontend TypeScript and production build | Passed | `npm --prefix frontend run build`. Vite reports a bundle chunk over 500 kB. |
| Frontend production dependency audit | Passed | `npm --prefix frontend audit --omit=dev`; 0 production vulnerabilities reported. |
| Full frontend dependency audit | Findings | Frontend install reported 2 vulnerabilities in development-inclusive dependency tree; review with `npm --prefix frontend audit`. |
| Backend dependency audit | Passed at install | Backend install reported 0 vulnerabilities; Multer 1.x emitted a deprecation warning. |
| MongoDB/PostgreSQL integration tests | Not run | No disposable database services were started or available for this validation. |
| Migration dry-run/reconciliation | Not implemented / not run | Existing migrations copy records at startup; there is no dedicated dry-run reconciliation command. |
| End-to-end browser tests | Not configured / not run | No browser automation suite is present. |
| Cloud deployment / runner validation | Blocked | No cloud resources, Python runner, or Spark runtime were provisioned. |

The backend tests include source-pattern checks; newly added SQL guard tests execute the parser-backed validation functions but do not connect to PostgreSQL. Passing these tests does not establish production database isolation.

## Feature status

| Area | Status | Limitation |
|---|---|---|
| Authentication and account data | Partial | Mongo-backed runtime methods exist, but startup still copies from PostgreSQL and requires the legacy database. |
| SQL practice | Partial | PostgreSQL remains the execution engine. SQL references and imports are AST-validated and query output is capped at 1,000 rows. The shared executor role is still granted privileges on multiple workspace schemas; per-workspace roles or database-level isolation and live penetration tests remain release gates. |
| Learning studio | Partial | Mongo-backed curriculum and user-scoped completion are implemented. Current initial catalog has one lesson per module, not the full learning bank. |
| Python | Partial | Lesson/example only. No code editor, isolated runner, test cases, or code attempt history. |
| PySpark/Spark | Partial | Lesson/example only. No Spark service or execution plans. |
| Azure/Databricks/ETL | Partial | Educational scenario lessons only. No actual Azure or Databricks connection. |
| Mock interviews | Partial | SQL question sessions and responses persist in MongoDB with owner checks. No AI rubric, follow-up generation, pause/resume UI, or non-SQL tracks. |
| MongoDB migration | Partial / release blocker | MongoDB stores several platform collections, but startup and runtime provisioning still access PostgreSQL application tables. No data cutover or source reconciliation is verified. |

## Security and release gates

- Do not remove PostgreSQL application tables or configure MongoDB as the only application database until a resumable, idempotent migration and reconciliation process exists.
- Do not claim the shared SQL executor role provides per-workspace isolation. AST checks are defense in depth; database-level least privilege remains required.
- Do not enable Python or Spark execution until separate, hardened runner services are deployed and verified.
- Review the two frontend development dependency findings and upgrade the deprecated Multer dependency in a separately tested security change.
- Do not push or deploy as a production release based solely on these local tests.

## Next verification

1. Run MongoDB and both PostgreSQL services in an isolated disposable environment.
2. Add API integration coverage for signup, ownership, lesson progress, imports, SQL cross-schema isolation, and interview session privacy.
3. Implement and reconcile the explicit PostgreSQL-to-Mongo importer before removing any legacy application table dependencies.
4. Configure per-workspace SQL execution privileges and run database-backed security tests.
5. Complete browser workflows and test mobile and desktop layouts.