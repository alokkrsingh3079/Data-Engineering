# Project Architecture and Feature Audit

**Reviewed:** 2026-10-24
**Revision:** `553dbf3`
**Scope:** Repository structure, key frontend/backend/runner boundaries, documentation, relevant tests, and public health endpoints. This is a project overview, not a formal security review.

## Product summary

The application is a data-engineering learning and interview platform that has grown from a SQL practice app. It combines SQL workspaces, coding labs, curated learning content, dataset-grounded challenge generation, interview practice, AI study tools, notes, progress tracking, and admin functions.

## Architecture

| Layer | Implementation | Responsibility |
|---|---|---|
| Frontend | React 18, TypeScript, Vite | SQL Lab, learning tracks, Python/PySpark labs, dataset generation, notes, AI, interview, admin and analytics screens. |
| Web edge | Cloudflare Worker / Wrangler assets | Serves the built frontend and proxies `/api` to the API origin. |
| API | Node.js, Express, TypeScript, Zod | Authentication, validation, ownership checks, question workflows, progress, SQL coordination, AI calls, and runner adapters. |
| Platform records | MongoDB | Users/sessions, learning questions and progress, generated-question jobs, notes, interviews, and other product records. |
| SQL execution | PostgreSQL | Practice schemas, tables, SQL challenge execution, snapshots, and compatibility/provisioning data. |
| Code execution | Python and Spark worker services | Authenticated requests to separate controllers, which run disposable constrained containers. |
| AI | OpenAI API (optional) | Question generation, tutoring, study content, and interview feedback. |

Production origins and deployment details are in [DEPLOYMENT.md](../DEPLOYMENT.md). Local setup is in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md).

## Feature inventory

| Area | Implemented capability | Important boundary |
|---|---|---|
| SQL Lab | User workspaces, PostgreSQL schema/table inspection, SQL editor, practice queries, question banks, generation sets, snapshots, import/review flows. | SQL safety depends on server validation and PostgreSQL role isolation; full production threat-model review is separate work. |
| Learning Studio | Lessons, track question banks, filters, answers/review, progress, attempts, bookmarks, revision, and analytics. | Some question types are objectively checked; content authoring/review still needs a stronger editorial workflow. |
| Python Lab | Coding questions, editor, examples, submission/result workflow, runner adapter. | Requires a configured isolated Python worker. |
| PySpark Lab | Spark coding bank, DataFrame preview/output, examples, submissions, async job handling, runner adapter. | Spark runs local mode on a single host; it is not a distributed Spark cluster. |
| Dataset question generation | CSV, JSON/JSONL, Parquet, and constrained SQL import; dataset preview; SQL/Python/PySpark generation; progress; validation; dataset-specific banks. | Uploads are bounded. AI receives sample data; avoid personal/confidential records. Generated answer correctness remains bounded by coverage of validation cases. |
| Interviews | Timed learning interviews, persisted answers, optional AI feedback and reports. | AI score and coaching are subjective, not guaranteed. |
| AI study tools | Assistant, note/reminder generation, schema-image support, PDF-based notes. | Require configured provider credentials and subject to provider availability and cost. |
| Admin/analytics | User/access administration, audit views, content operations, metrics and learning analytics. | Server-side authorization and least privilege remain essential for each admin operation. |

## Data flow for dataset question generation

1. The API parses an upload under documented file, row, column, and table limits.
2. Dataset tables are stored in a user-owned PostgreSQL practice schema; dataset metadata is stored in MongoDB.
3. The generator sends the selected schema and a bounded preview sample to the configured AI service.
4. Candidate Python/PySpark inputs are checked for exact selected-table columns, required question structure, and valid reference code.
5. A configured isolated runner executes the reference solution against test cases. Questions are saved only when the requested batch validates.
6. Generated coding questions are associated with the dataset and shown in its lab question bank.

This pipeline reduces common errors but does not prove a candidate correct for all possible records. Held-out rows and meaningful null/type/edge-case tests are recommended.

## Operational observations

- On 2026-10-24, `/api/health` returned HTTP 200 with MongoDB and PostgreSQL healthy; runner status reported Python and PySpark available.
- Render and Cloudflare deployments are automated from `main`.
- The latest checked Cloudflare deploy workflow succeeded. The latest checked backend CI run failed at `npm test`, as did two preceding runs.
- Backend TypeScript check and frontend production build passed during the current review. The full local backend suite did not complete within the review window.
- On-demand Codespaces runner hosting can interrupt execution when the Codespace stops. A dedicated Docker-compatible host is more suitable for continuous use.

## Key architecture risks and improvement areas

1. **Regression signal:** investigate repeated backend test failures and make the suite terminate reliably.
2. **Background work:** generation is launched from the API process and interrupted work is marked failed after restart; consider a durable queue with idempotent jobs.
3. **Persistence transition:** PostgreSQL is still required for SQL execution and compatibility operations even though MongoDB stores platform records. Reconcile migration state before removing legacy data/tables.
4. **Question quality:** add independent/held-out validation and a learner/editor review step for AI-generated coding challenges.
5. **End-to-end verification:** add browser tests for the flows learners use, including runner unavailable/failure states.
6. **Runner operations:** monitor capacity, uptime, resource use, and job cleanup; use a durable controller host rather than relying on an on-demand Codespace for expected production availability.
7. **Privacy:** minimize sample data passed to AI, make retention/deletion behavior clear, and do not encourage uploads containing sensitive information.

See the [QA report](FINAL_QA_REPORT.md) and [prioritized roadmap](IMPLEMENTATION_ROADMAP.md).
