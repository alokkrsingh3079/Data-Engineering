# SQL Software → Data Engineering Interview Studio

> **A phased, security-first roadmap for evolving the existing SQL Software project into a comprehensive Data Engineering learning and interview-preparation platform.**

**Repository:** https://github.com/sameep20252026/Data-Engineering

bash scripts/start-codespace-runners.sh

This README contains the complete seven-phase implementation plan, acceptance criteria, and copy-ready prompts for an AI coding agent. Keep this file in the repository as the long-term project specification and source of truth.

## On-Demand Codespaces Runners

To start the isolated Spark and Python runners in GitHub Codespaces, run:

```bash
bash scripts/start-codespace-runners.sh
```

The first run generates runner tokens. Add the printed values to Render as `SPARK_RUNNER_TOKEN` and `PYTHON_RUNNER_TOKEN`. The Codespace must remain running while Render uses the runners. For setup, token rotation, and limitations, see [the self-hosted runner guide](docs/SELF_HOSTED_RUNNERS.md).

## Run Locally

For a complete copy-paste setup—including MongoDB, PostgreSQL, Python and Spark runners, backend/frontend startup, admin and learner login, testing, and optional SQL A–R question generation—see the [Local Development Guide](docs/LOCAL_DEVELOPMENT.md).

Quick prerequisites: Node.js 20+, npm, Docker Compose, and a working Docker daemon. Do not commit `backend/.env`; it contains local credentials.

---

## Table of Contents

- [Run Locally](#run-locally)
1. [Project Vision](#1-project-vision)
2. [Guiding Principles](#2-guiding-principles)
3. [Target Modules](#3-target-modules)
4. [High-Level Architecture](#4-high-level-architecture)
5. [How to Use This Roadmap](#5-how-to-use-this-roadmap)
6. [Phase 1 — Complete Repository Audit](#6-phase-1--complete-repository-audit)
7. [Phase 2 — Stabilize and Secure the Existing Application](#7-phase-2--stabilize-and-secure-the-existing-application)
8. [Phase 3 — Learning Dashboard and Question Engine](#8-phase-3--learning-dashboard-and-question-engine)
9. [Phase 4 — Python Interview Lab](#9-phase-4--python-interview-lab)
10. [Phase 5 — PySpark and Apache Spark Lab](#10-phase-5--pyspark-and-apache-spark-lab)
11. [Phase 6 — Azure, Databricks, ETL, and AI Mock Interviews](#11-phase-6--azure-databricks-etl-and-ai-mock-interviews)
12. [Phase 7 — Final QA and Production Readiness](#12-phase-7--final-qa-and-production-readiness)
13. [Data Model Guidance](#13-data-model-guidance)
14. [Security Requirements](#14-security-requirements)
15. [Testing and Acceptance Standards](#15-testing-and-acceptance-standards)
16. [Deployment and Cost Controls](#16-deployment-and-cost-controls)
17. [Definition of Done](#17-definition-of-done)
18. [Final Project Status Template](#18-final-project-status-template)

---

## 1. Project Vision

Evolve the existing **SQL Software** application into a **Data Engineering Interview Studio** while preserving and extending the existing codebase.

The platform should help learners prepare for Data Engineering interviews through practical exercises, verified explanations, coding challenges, scenario-based questions, progress tracking, and AI-powered mock interviews.

### Implementation status

Status last checked: 2026-10-19. “Partial” means some useful functionality exists, but the phase acceptance criteria are not met. Only verified completion is marked done.

| Phase | Status | Evidence and remaining gate |
|---|---|---|
| 1. Repository audit | Done | See [the audit report](docs/PROJECT_AUDIT.md). |
| 2. Stabilize and secure | Partial | Per-workspace PostgreSQL roles, cross-schema denial, query limits, malformed-password handling, and admin-bootstrap regression tests are implemented. A disposable PostgreSQL integration test passed; upload and full authorization/API regression coverage remain incomplete. |
| 3. Dashboard and question engine | Partial, substantially implemented | Mongo-backed modules, reviewed MCQ/scenario questions, search/topic/difficulty/type/progress filters, answer checking, retries, bookmarks, attempts, resume, and topic progress are implemented. Disposable Mongo tests and a two-account API smoke test passed; reviewer authoring and non-objectively-graded question workflows remain incomplete. |
| 4. Python Interview Lab | Partial | Python lessons, an original coding exercise, editor, hidden tests, private bounded submissions, and a fail-closed external runner adapter are implemented. No isolated Python service is configured or verified. |
| 5. PySpark and Spark Lab | Partial, locally verified | A PySpark question bank/workspace, real public-example output, hidden-test evaluation, Mongo-backed progress/history, AI tutor, async job API, and a separate Python 3.11.11 / PySpark 3.5.6 / Java 17 Docker worker are implemented. Local real Spark aggregation, join, window, null, syntax-error, and timeout checks pass. Production dedicated-host deployment and durable multi-replica queue scaling remain unverified. |
| 6. Azure, Databricks, ETL, and AI interviews | Partial | Original ADF/ADLS/Delta/ETL/system-design lessons and scenario questions are available. Persisted learning interviews support rubric feedback and follow-ups when OpenAI is configured; the provider was not called and no cloud service is integrated. |
| 7. Final QA and production readiness | Blocked | Unit/builds, disposable PostgreSQL/Mongo integrations, runner-contract tests, and a two-account API smoke test pass. Production migration reconciliation, browser automation, upload security coverage, live runners, and provider/cloud verification remain outstanding. |

Platform records are intended for MongoDB; PostgreSQL still contains legacy application tables used by startup and account/workspace provisioning, as well as the SQL-practice schemas. Do not remove those PostgreSQL tables or deploy a Mongo-only configuration until a resumable migration and runtime cutover are implemented and verified. See [environment variables](docs/ENVIRONMENT_VARIABLES.md) and the [current QA report](docs/FINAL_QA_REPORT.md).

The project should grow incrementally. Each phase must be audited, implemented, tested, and reviewed before the next phase begins.

### Core goals

- Preserve existing working functionality and user data.
- Improve security and reliability before adding complex features.
- Reuse existing components, services, database tables, and integrations where appropriate.
- Support SQL, Python, PySpark, Azure, Databricks, ETL testing, data warehousing, and system design.
- Provide meaningful question validation and progress tracking.
- Run submitted code only in appropriately isolated execution infrastructure.
- Clearly distinguish real integrations from simulated demonstrations.
- Maintain documentation, tests, migrations, and deployment instructions throughout development.

### Important note

The module list in this README describes the **target product**, not a claim that every module already exists or works. Actual status must be determined by inspecting the repository and running tests.

---

## 2. Guiding Principles

Every AI coding agent or developer working on this project must follow these principles.

1. **Inspect before changing.** Read the relevant code, schema, tests, configuration, and documentation before implementing a feature.
2. **Do not rewrite from scratch.** Extend the current architecture unless an evidence-based technical reason justifies a change.
3. **Make incremental changes.** Implement one phase and small logical tasks at a time.
4. **Preserve existing behavior.** Add regression tests for working features before changing their implementation.
5. **Do not fabricate progress.** Never claim that a feature, test, security fix, or integration works without evidence.
6. **Protect data.** Never run destructive migrations or commands against production without explicit authorization and a recovery plan.
7. **Keep secrets server-side.** Do not commit API keys, passwords, tokens, private connection strings, or production credentials.
8. **Enforce authorization on the server.** Frontend visibility is not an authorization mechanism.
9. **Treat user input as untrusted.** This includes SQL, Python code, uploaded files, question text, and AI-generated content.
10. **Isolate code execution.** Never execute arbitrary user-submitted Python or Spark code directly in the web API process.
11. **Validate learning content.** Questions, reference answers, and test cases must be checked before publication.
12. **Report blockers honestly.** If credentials, infrastructure, repository access, or dependencies are missing, state what cannot be completed.
13. **Avoid unnecessary dependencies.** Add new libraries or infrastructure only when the benefit and maintenance impact are understood.
14. **Keep migrations backward-conscious.** Prefer additive, reversible changes where practical.
15. **Do not provision paid services automatically.** Ask for explicit authorization before creating billable cloud resources or changing production infrastructure.

---

## 3. Target Modules

### 3.1 SQL Interview Lab

- SQL editor and query execution.
- Schema and table exploration.
- Filtering, aggregation, joins, subqueries, and CTEs.
- Window functions and ranking.
- Date and time operations.
- NULL handling and deduplication.
- Query debugging and output prediction.
- Interview-style timed practice.
- Reference answers, hints, explanations, and attempt history.

The existing SQL functionality should be retained and improved rather than replaced.

### 3.2 Python Interview Lab

- Python fundamentals and data structures.
- Strings, lists, dictionaries, sets, and tuples.
- Functions, comprehensions, sorting, and searching.
- Exceptions, debugging, and generators.
- File handling, CSV, JSON, and API concepts.
- Data cleaning and transformation.
- ETL-oriented coding exercises.
- Test cases and validated reference solutions.
- Isolated execution where safe infrastructure is available.

### 3.3 PySpark and Apache Spark Lab

- DataFrames and schemas.
- Transformations and actions.
- Filtering, aggregation, joins, and window functions.
- Null handling and deduplication.
- CSV, JSON, and Parquet processing.
- Partitioning, repartitioning, and shuffle.
- Lazy evaluation, jobs, stages, and tasks.
- Catalyst optimizer and execution plans.
- Broadcast joins, skew, caching, and performance.
- Delta Lake fundamentals and incremental processing.
- Real execution only through an isolated Spark runtime.

### 3.4 Azure Data Engineering

- Azure Data Factory pipelines and activities.
- Linked services, datasets, triggers, and Integration Runtime.
- Copy Activity, parameters, variables, and control flow.
- Incremental ingestion and watermark patterns.
- Retries, monitoring, and failure handling.
- Azure Data Lake Storage Gen2.
- Secure storage and data access concepts.
- Pipeline troubleshooting scenarios.

### 3.5 Databricks and Delta Lake

- Notebooks and jobs.
- PySpark transformations.
- Delta tables and transaction fundamentals.
- MERGE and upserts.
- Schema enforcement and evolution.
- Bronze, Silver, and Gold medallion architecture.
- Incremental ingestion and batch processing.
- Performance and job troubleshooting.
- Version-specific capabilities clearly identified.

### 3.6 ETL Testing and Data Warehousing

- Source-to-target validation.
- Row-count reconciliation.
- Null, duplicate, schema, and datatype validation.
- Aggregate reconciliation.
- Incremental-load validation and CDC.
- SCD Type 1 and Type 2.
- Idempotency and reprocessing.
- Late-arriving records and recovery.
- Fact and dimension tables.
- Star and snowflake schemas.
- Data quality rules and failure scenarios.

### 3.7 Data Engineering Concepts and System Design

- Batch versus streaming.
- Data ingestion and orchestration.
- Data lakes, warehouses, and lakehouses.
- File formats and partitioning.
- Reliability, scalability, and data quality.
- Data pipeline architecture.
- Failure recovery and observability.
- Trade-offs and scenario-based system design.
- Airflow and Kafka fundamentals, introduced incrementally.

### 3.8 AI Mock Interviews

- Track, topic, difficulty, and time selection.
- One question at a time.
- Text and coding responses where supported.
- Follow-up questions.
- Session history and resume support where implemented.
- Rubric-based feedback.
- Reference answers and missing concepts.
- Revision recommendations.

AI feedback must be presented as assistance, not as a perfectly accurate or authoritative score.

---

## 4. High-Level Architecture

The final architecture must be based on repository inspection and deployment constraints. Do not assume that every component below is already present.

### Existing application

Preserve the current frontend, backend, database, authentication, SQL execution, AI integrations, and deployment/proxy configuration where they are verified and suitable.

### Persistence target for this roadmap

Use MongoDB for platform records: user accounts, sessions, questions, question sets, attempts, progress, bookmarks, imports/reviews, interview sessions, audit records, and related application data. Keep MongoDB access in the backend and require explicit connection configuration. Preserve SQL Software by retaining PostgreSQL (or another explicitly verified SQL engine) for isolated practice schemas and actual submitted SQL execution. Store each practice workspace's ownership and SQL schema mapping in MongoDB. Do not move SQL datasets into MongoDB or describe MongoDB as the SQL execution engine. Plan and verify an explicit, resumable migration of existing application records before any production cutover; never drop existing PostgreSQL data automatically.

The prior project description suggests a React/Vite frontend, a Node.js/Express backend, PostgreSQL, and an AI integration, with possible Cloudflare Worker deployment or proxying. Confirm these details against the actual repository before making architectural decisions.

### Recommended logical boundaries

- **Frontend:** dashboard, modules, editors, questions, progress, and interview UI.
- **Backend API:** authentication, authorization, question services, progress, interview orchestration, and validated API contracts.
- **MongoDB:** user profiles, password hashes, sessions, workspace metadata, questions, question sets, attempts, revision marks, imports, snapshots, collections, audit records, feature flags, and operational learning data.
- **PostgreSQL:** a dedicated practice executor connection for user-created SQL practice schemas and SQL query execution. Platform metadata remains in MongoDB; PostgreSQL has a compatibility shadow for legacy foreign keys during migration.
- **SQL execution:** a separate non-superuser PostgreSQL role with per-workspace schema grants, a schema-only search path, read-only practice queries, statement timeouts, and bounded result behavior.
- **Python runner:** a separate, sandboxed execution service.
- **Spark runner:** a separate Spark-compatible execution environment.
- **AI service:** server-side integration with validated inputs/outputs, usage limits, and protected credentials.
- **Cloud learning modules:** scenario-based exercises initially; real Azure or Databricks integrations only when configured and explicitly authorized.
- **Observability:** safe logs, health checks, error reporting, and operational documentation.

### Execution boundary

The Express API must not run arbitrary user code directly. Python and Spark submissions must be sent to a separate execution service with a verified isolation boundary, resource limits, and restricted permissions.

A UI-only or mocked runner must be labeled as simulated or unavailable. It must never be presented as actual code execution.

---

## 5. How to Use This Roadmap

### Required workflow

1. Give the coding agent access to the repository.
2. Run **Prompt 1 only**.
3. Review the audit report and implementation roadmap.
4. Run Prompt 2 after the audit is understood.
5. Verify the results before proceeding to Prompt 3.
6. Repeat this process for each phase.
7. Run Prompt 7 only after the earlier phases have been reviewed.

### Before every phase

- Confirm that the previous phase's deliverables exist.
- Review uncommitted changes.
- Create a Git commit or backup at a known-good checkpoint.
- Use a development or staging database.
- Ensure secrets and production data are not exposed to the agent unnecessarily.
- Confirm that the agent can run the required tests.
- Give explicit approval for any destructive or billable operation.

### After every phase

Require a report with:
- Files changed.
- Database migrations.
- Tests actually executed and their results.
- Build status.
- Manual verification steps.
- Known limitations.
- Security implications.
- Recommended next step.

Do not proceed merely because the agent says “done.”

---

# 6. Phase 1 — Complete Repository Audit

**Objective:** Understand the existing codebase and prepare a verified implementation plan. Do not perform broad feature implementation in this phase.

## Copy-ready Prompt 1

```text
# PHASE 1: COMPLETE REPOSITORY AUDIT
## Project: SQL Software → Data Engineering Interview Studio

GitHub repository:
https://github.com/kumaralok9876543/Sql-Software

Act as a senior full-stack engineer, application security reviewer, database architect, and Data Engineering product architect.

## 1. Primary objective

Perform a complete evidence-based audit of my existing repository before implementing new features.

The goal is to evolve the existing application into a Data Engineering learning and interview preparation platform without rewriting it from scratch.

Preserve existing working functionality, architecture, authentication, SQL practice capabilities, AI integration, and user data.

## 2. Repository inspection

Inspect the complete repository, including:
- Frontend components, pages, routing, state management, styling, and API clients.
- Backend routes, controllers, services, middleware, and validation.
- Database schema, migrations, indexes, relationships, and seed data.
- Authentication, sessions, password handling, roles, and authorization.
- SQL execution engine and database isolation.
- AI integrations, prompts, error handling, and API-key management.
- Cloudflare Worker or other deployment/proxy configuration, if present.
- Tests, scripts, CI workflows, environment variables, Docker files, and deployment configuration.
- README, feature documentation, and known limitations.

Do not assume documentation accurately describes the implementation. Verify claims against the actual code.

## 3. Create a feature inventory

For every important feature, classify it as:
1. Implemented and verified.
2. Implemented but needs testing.
3. Partially implemented.
4. Planned but not implemented.
5. Broken or blocked.
6. Security-sensitive or potentially unsafe.

Inspect SQL editor, query execution, database/schema explorer, question generation, expected-result checking, AI tutor, login, workspaces, progress tracking, admin functionality, imports, and deployment.

## 4. Security audit

Review:
- Authentication and session security.
- Authorization and role enforcement.
- User-to-user and tenant data isolation.
- SQL injection and unsafe query execution.
- Read-only SQL restrictions and multi-statement handling.
- Query timeouts and resource exhaustion.
- File uploads, image imports, multipart parsing, and database ownership checks.
- API abuse and rate limiting.
- Secret handling and development fallback secrets.
- Admin endpoint protection.
- AI prompt injection, generated SQL validation, and unsafe AI output.
- Dependency vulnerabilities and exposed debugging endpoints.

Specifically investigate whether database ownership is checked correctly for every import endpoint, including endpoints such as `/api/databases/import-file` and `/api/databases/import-image`, if present.

Treat suspected vulnerabilities as hypotheses until verified. Never claim an exploit is confirmed without evidence.

## 5. Build and tests

Run available frontend and backend checks where the environment allows:
- Dependency and configuration inspection.
- Production builds.
- Existing automated tests.
- Type checking and linting, if configured.
- Migration validation where feasible.

Record actual commands, outcomes, failures, and environment-related blockers. Never report a test as passing unless it was executed successfully.

Do not run destructive production database commands.

## 6. Target product

The future product should support:
- SQL Interview Lab.
- Python Interview Lab.
- PySpark and Apache Spark Lab.
- Azure Data Factory and Azure Data Lake Storage.
- Databricks and Delta Lake.
- ETL Testing and Data Warehousing.
- Data Engineering Concepts and System Design.
- AI-powered Mock Interviews.
- Learning progress, bookmarks, practice history, and revision.

These are target capabilities, not assumptions about current functionality.

## 7. Required deliverables

Create a detailed audit report containing:
1. Existing architecture and technology stack.
2. Current folder and module map.
3. Verified feature inventory.
4. Database schema and API inventory.
5. Security findings with severity, evidence, impact, and suggested fix.
6. Build and test results.
7. Technical debt and major blockers.
8. Recommended implementation architecture.
9. Prioritized phase-by-phase roadmap.
10. Acceptance criteria for each phase.

If appropriate, add the report to the repository as `docs/PROJECT_AUDIT.md` and the roadmap as `docs/IMPLEMENTATION_ROADMAP.md`.

## 8. Strict rules

- Do not rewrite the application.
- Do not delete existing features.
- Do not perform broad schema changes.
- Do not add all new modules yet.
- Do not expose secrets.
- Do not fabricate test results or implementation status.
- If repository access is unavailable, explain the blocker and provide only the evidence actually available.

Finish by summarizing the findings and recommending the safest next step.

STOP after the audit and roadmap. Wait for approval before implementing Phase 2.
```

### Phase 1 exit criteria

- Audit report exists and is evidence-based.
- Current features are classified accurately.
- Build/test status is documented.
- Security concerns and blockers are prioritized.
- A practical implementation plan is available.
- No broad implementation changes were made.

---

# 7. Phase 2 — Stabilize and Secure the Existing Application

**Objective:** Fix verified security and reliability issues before adding major features.

## Copy-ready Prompt 2

```text
# PHASE 2: STABILIZE AND SECURE THE EXISTING APPLICATION

Repository:
https://github.com/kumaralok9876543/Sql-Software

Use the Phase 1 audit report as the source of truth. Inspect the current code again before changing anything.

## 1. Objective

Fix verified high-priority bugs and security vulnerabilities while preserving existing application behavior.

Do not rewrite the frontend, backend, authentication system, or database without a documented technical reason.

## 2. Prioritize security

For this project, application records are being migrated to MongoDB while PostgreSQL remains the SQL practice runtime. Enforce ownership against MongoDB workspace metadata before any SQL runtime operation. Do not weaken SQL execution isolation during the storage migration.

Address verified issues involving:
- Missing or inconsistent authentication.
- Missing authorization checks.
- Cross-user database or workspace access.
- Import endpoint ownership validation.
- Unsafe SQL execution.
- File upload validation and storage.
- Missing query timeouts and resource limits.
- Weak production secret handling.
- Unprotected administrative endpoints.
- Rate limiting and request validation.

For every sensitive endpoint, verify identity, permissions, ownership, and input validation on the server. Never trust frontend-only checks.

For multipart imports, verify that uploaded content cannot be imported into a database belonging to another user. Parse and validate the relevant identifiers safely before performing ownership-sensitive operations.

## 3. SQL execution safety

Preserve the existing SQL learning experience.

Verify and improve, where needed:
- Allowed statement types and read-only enforcement.
- Single-statement restrictions.
- Transaction handling and rollback behavior.
- Statement and connection timeouts.
- Row limits and response-size limits.
- Database/schema isolation.
- Safe error messages.
- Prevention of access to internal or unauthorized schemas.
- Protection against resource exhaustion.

Do not assume that checking whether a query begins with SELECT is sufficient security.

Use database permissions and appropriate execution isolation. If a safe implementation cannot be guaranteed, disable the unsafe capability until it can be secured.

## 4. Authentication and data protection

Preserve existing login and user sessions.

Verify:
- Password hashing and session/token handling.
- Role checks on protected APIs.
- User-specific workspace and progress access.
- Secure production configuration.
- No secrets in frontend bundles or source control.
- Appropriate error handling and logging.

Use environment variables or the existing secret-management mechanism. Never invent or commit production secrets.

## 5. Testing

Add or improve automated tests for:
- Unauthenticated requests.
- Unauthorized roles.
- Cross-user resource access.
- SQL execution restrictions.
- Malformed inputs.
- File import ownership checks.
- Oversized uploads and requests.
- Session expiration and relevant authentication behavior.
- Existing SQL practice workflows.

Use isolated test data. Do not test destructive operations against production resources.

## 6. Regression protection

Before changing a feature, identify its current expected behavior.

After each logical fix:
- Run relevant tests.
- Run the production build.
- Verify existing SQL editor, login, question checking, AI tutor, and other verified features.
- Record failures and any behavior changes.

Fix only issues supported by evidence. Avoid unnecessary dependency upgrades or large refactors.

## 7. Deliverables

Provide:
- List of files changed.
- Security findings fixed and remaining.
- Database migrations, if any.
- Tests added and their actual results.
- Build status.
- Manual verification checklist.
- Remaining limitations.

Update `docs/PROJECT_AUDIT.md` or create `docs/SECURITY_REVIEW.md` if appropriate.

Do not begin Phase 3 automatically. Stop and report the results before continuing.
```

### Phase 2 exit criteria

- Verified high-priority issues are fixed or explicitly blocked.
- Authorization is enforced server-side.
- SQL execution restrictions are tested.
- Existing login and SQL workflows still function.
- Tests and builds have actual recorded results.
- Remaining risks are documented.

---

# 8. Phase 3 — Learning Dashboard and Question Engine

**Objective:** Create the unified learning foundation for all future modules.

## Copy-ready Prompt 3

```text
# PHASE 3: DATA ENGINEERING LEARNING DASHBOARD AND QUESTION ENGINE

Repository:
https://github.com/kumaralok9876543/Sql-Software

Use the verified Phase 1 audit and completed Phase 2 changes. Inspect existing components and tables before implementing anything.

## 1. Product goal

Evolve the existing SQL practice application into a unified Data Engineering Interview Studio.

Preserve the current SQL editor, question execution, AI tutor, authentication, and progress functionality.

Do not create a separate application or duplicate existing functionality.

## 2. Build the main dashboard

Create a clean, responsive dashboard containing these learning modules:

1. SQL Interview Lab.
2. Python Interview Lab.
3. PySpark and Apache Spark.
4. Azure Data Factory and ADLS Gen2.
5. Databricks and Delta Lake.
6. ETL Testing and Data Warehousing.
7. Data Engineering Concepts.
8. Data Engineering System Design.
9. AI Mock Interviews.

Show module cards with:
- Module name and description.
- Number of available questions, based on actual data.
- Difficulty categories.
- User's completed questions and progress.
- Continue Learning action.
- Start Practice action.

Never display fabricated counts or progress. Show a sensible empty state if a module has not been populated.

## 3. Question engine

Design a reusable question model that supports:
- Question title and prompt.
- Module, topic, subtopic, and tags.
- Difficulty: Beginner, Intermediate, Advanced.
- Question type: MCQ, conceptual, SQL, coding, debugging, or scenario.
- Question statement and optional input data.
- Validated reference answer.
- Explanation and common mistakes.
- Hints.
- Test cases for executable questions.
- Publication status.
- Created and updated timestamps.

Reuse the existing SQL question model wherever practical. Add backward-compatible migrations rather than destructively replacing tables.

## 4. Learning experience

Implement:
- Topic browsing and search.
- Difficulty and question-type filters.
- Question details page.
- Hints and answer explanations.
- Mark for revision/bookmark.
- Attempt history.
- Completed and incorrect question lists.
- Retry incorrect questions.
- Topic-wise progress.
- Recently attempted questions.
- Resume previous learning session.

Track progress separately from the question definition and scope it to the authenticated user.

Do not mark a question complete merely because the user opened it.

## 5. Content quality

Create a small, high-quality initial set of original sample questions for SQL and Data Engineering concepts.

Validate every answer and explanation. Do not generate large amounts of unverified content simply to inflate counts.

If AI generates questions, keep them in draft status until the required validation and review process succeeds.

## 6. Database and API

Inspect existing schema first.

Create only the necessary migrations and endpoints for modules, topics, questions, bookmarks, attempts, and progress.

Requirements:
- Server-side validation.
- Authenticated access to private user data.
- Authorization for question management.
- Pagination for question lists.
- Efficient database queries and indexes.
- Consistent API error formats.
- No secrets exposed to the frontend.

Do not introduce a second competing question engine if the current one can be extended safely.

## 7. UI and performance

Use the existing design system and routing.

Ensure:
- Responsive mobile and desktop layouts.
- Loading, empty, error, and success states.
- Accessible controls.
- Reusable components.
- No unnecessary API calls.
- No broken navigation.
- No fabricated premium or payment functionality.

Do not add a payment gateway unless separately approved.

## 8. Tests and acceptance criteria

Verify:
- All dashboard modules navigate correctly.
- Existing SQL practice still works.
- Filters and search work.
- Bookmarks persist.
- Attempts and progress persist across login sessions.
- One user cannot access another user's private progress.
- Empty modules show accurate empty states.
- Migrations work on a test database.
- Production build and automated tests pass.

Report files changed, migrations, sample content, test results, and known limitations.

Stop after Phase 3. Do not implement Python or Spark execution in this phase.
```

### Phase 3 exit criteria

- Dashboard navigation works.
- Existing SQL functionality remains intact.
- Questions can be browsed and filtered.
- Attempts, bookmarks, and progress persist.
- User data is isolated.
- Empty modules are clearly represented.
- Database migrations and tests are documented.

---

# 9. Phase 4 — Python Interview Lab

**Objective:** Add Python practice and safe automated evaluation.

## Copy-ready Prompt 4

```text
# PHASE 4: PYTHON INTERVIEW LAB WITH SAFE CODE EXECUTION

Repository:
https://github.com/kumaralok9876543/Sql-Software

Use the existing learning dashboard and question engine. Inspect the existing deployment environment and available infrastructure before choosing an execution approach.

## 1. Objective

Implement a functional Python Interview Lab for Data Engineering interview preparation.

Users should be able to read a problem, write Python code, run it against controlled test cases, inspect output, receive feedback, and track attempts.

## 2. Python content

Organize topics into:
- Python fundamentals.
- Strings, lists, dictionaries, sets, and tuples.
- Loops, functions, and comprehensions.
- Sorting and searching.
- Data structures and problem solving.
- File handling and CSV/JSON.
- Exceptions and debugging.
- Iterators and generators.
- Object-oriented programming.
- Python for ETL.
- Data transformation and validation.
- API and database concepts.
- Common data engineering interview problems.

Provide Beginner, Intermediate, and Advanced questions with verified solutions and explanations.

## 3. Coding interface

Build a coding workspace using a suitable editor already available in the project, or a compatible maintained editor library.

Include:
- Problem statement.
- Input/output specification.
- Example input and expected output.
- Code editor with syntax highlighting.
- Run Code and Submit actions.
- Visible test results.
- Execution status and time limit messages.
- Reset Code.
- Hints and reference solution, where appropriate.
- Previous attempts and revision support.

Keep the interface responsive and consistent with the SQL Lab.

## 4. Execution architecture

Never execute arbitrary submitted Python code directly inside the Express application process.

Implement a separate execution service or runner abstraction.

Before enabling execution, establish a real isolation boundary using an appropriate sandbox or hardened container infrastructure.

Apply:
- CPU limits.
- Memory limits.
- Wall-clock timeout.
- Process and output-size limits.
- Restricted filesystem access.
- Non-root execution.
- Network disabled by default.
- No access to application secrets, host credentials, or production databases.
- Temporary per-execution workspaces.
- Cleanup after completion.
- Concurrency limits and request rate limiting.

Do not expose a privileged Docker socket or unrestricted host execution endpoint.

If secure runner infrastructure is unavailable, implement the interface and runner contract, provide sample/mock results clearly labeled as simulated, and report that real execution is not yet enabled.

Never claim sandboxed execution works without a verified running implementation.

## 5. Test-case evaluation

Support:
- Public sample tests.
- Hidden tests.
- Exact and normalized output comparisons where appropriate.
- Structured JSON comparison when appropriate.
- Per-test pass/fail status.
- Execution errors and timeouts.
- Partial scores only where a defined rubric supports them.

Do not reveal hidden test inputs or expected outputs before submission.

Validate test cases and reference solutions before publishing a question.

## 6. Backend and database

Reuse the Phase 3 question model and add only necessary fields or tables for:
- Python submissions.
- Execution jobs.
- Test results.
- Attempt history.
- Execution status and timing.
- User progress.

Store code submissions and results with appropriate access controls and retention limits. Avoid storing unnecessary sensitive data.

Validate ownership for job-status and result endpoints.

Keep the runner interface independent from the frontend so execution infrastructure can be changed later.

## 7. Tests

Add tests for:
- Correct and incorrect solutions.
- Syntax errors.
- Runtime errors.
- Timeouts.
- Excessive output.
- Malicious or restricted code.
- Unauthorized job access.
- Cross-user submission access.
- Runner unavailable state.
- Existing SQL functionality.

Security tests must not depend on actually compromising the host.

## 8. Acceptance criteria

The Python Lab is complete only when:
- Questions and editor load correctly.
- Actual code execution works in a verified isolated runner, or the feature is explicitly labeled unavailable.
- Test results are accurate.
- Attempts and progress persist.
- Users cannot read other users' private submissions.
- Limits and cleanup are verified.
- Existing SQL and dashboard features remain functional.

Report the runner architecture, deployment requirements, files changed, tests, and unresolved blockers.

Stop after Phase 4. Do not implement Spark execution in this phase.
```

### Phase 4 exit criteria

- Python problems and editor work.
- Real execution is isolated and verified, or clearly disabled/simulated.
- Test results and submission history are accurate.
- Timeouts, resource limits, and authorization are tested.
- Existing modules continue to work.

---

# 10. Phase 5 — PySpark and Apache Spark Lab

**Objective:** Teach Spark concepts and support real PySpark exercises only when suitable execution infrastructure exists.

## Copy-ready Prompt 5

```text
# PHASE 5: PYSPARK AND APACHE SPARK INTERVIEW LAB

Repository:
https://github.com/kumaralok9876543/Sql-Software

Extend the existing application. Reuse the dashboard, question engine, authentication, progress tracking, and execution-job architecture.

## 1. Objective

Build a PySpark Interview Lab that teaches both coding and the underlying execution model of Apache Spark.

Do not implement a fake Spark engine by merely returning predefined outputs while presenting them as actual Spark execution.

## 2. Learning topics

Organize content into:

### PySpark coding
- SparkSession and DataFrames.
- Creating DataFrames and defining schemas.
- select, filter, withColumn, and expressions.
- Null handling and data cleaning.
- GroupBy and aggregations.
- Inner, left, right, and anti joins.
- Window functions and ranking.
- Deduplication.
- Date and timestamp transformations.
- Nested JSON and arrays.
- CSV, JSON, and Parquet.
- Partitioning and repartitioning.
- UDFs and built-in functions.
- Data validation and ETL transformations.

### Spark internals
- Lazy evaluation.
- Transformations and actions.
- Jobs, stages, and tasks.
- Narrow and wide transformations.
- Shuffle operations.
- Partitions and parallelism.
- Catalyst optimizer.
- Execution plans.
- Broadcast joins and skew.
- Caching and persistence.
- Memory and performance troubleshooting.
- Small-file problems.

### Modern data engineering
- Delta Lake fundamentals.
- ACID transactions.
- Schema enforcement and evolution.
- MERGE operations.
- Incremental processing.
- Batch versus streaming fundamentals.

Clearly identify features that depend on particular Spark or Delta Lake versions.

## 3. Question formats

Support:
- Conceptual questions.
- MCQs.
- Output prediction.
- Debugging.
- PySpark coding challenges.
- Query and execution-plan interpretation.
- Performance scenarios.
- ETL case studies.

Each question should have a validated answer, explanation, difficulty, topic, and appropriate test cases.

## 4. Real execution architecture

Use a separate Spark execution service. Do not execute Spark jobs inside Express.

Investigate whether a managed Spark service, isolated worker infrastructure, or another deployment-compatible environment is available.

Before running user submissions, enforce:
- Resource quotas.
- Timeouts.
- Job concurrency limits.
- Network and filesystem restrictions.
- Restricted credentials and service identities.
- No access to arbitrary cloud storage or production databases.
- Cleanup of temporary data.
- Authentication and authorization for job status and results.

Do not let users submit arbitrary Spark configurations that can access the host or cloud account.

Do not expose a Spark master, cluster manager, or privileged execution endpoint publicly without appropriate security.

If no Spark runtime is available, build the learning UI, question bank, and a clearly labeled simulated preview mode. Document the exact infrastructure needed for real execution.

## 5. Coding workspace

Create a PySpark editor experience with:
- Problem statement.
- Input DataFrame schema and sample rows.
- Required output schema and examples.
- Code editor.
- Run and Submit actions.
- Test results.
- Execution status and resource-limit errors.
- Explanation and hints.
- Attempt history and retry.

Where feasible, show actual DataFrame results and validated execution plans from the isolated runtime.

Never fabricate Spark logs, execution plans, or performance metrics.

## 6. Integration

Reuse the shared question engine and progress system.

Add only the required module-specific configuration and submission metadata.

Use migrations that preserve existing data.

Make Python and Spark runner implementations independently configurable.

## 7. Tests and acceptance criteria

Verify:
- Join and aggregation questions.
- Window-function problems.
- Null and duplicate handling.
- Schema correctness.
- Incorrect outputs.
- Timeouts and job failures.
- Authorization and isolation.
- Runner-unavailable behavior.
- Spark version compatibility.
- Existing SQL and Python functionality.

Measure actual execution only when a real Spark runtime is available.

Report infrastructure costs and deployment requirements where known; do not invent prices.

Stop after Phase 5. Do not automatically provision paid cloud infrastructure.
```

### Phase 5 exit criteria

- Spark learning content and questions are available.
- PySpark code execution is genuine and isolated, or clearly labeled unavailable.
- Runtime version and infrastructure requirements are documented.
- No fabricated execution plans or metrics are displayed.
- Existing SQL and Python functionality remains intact.

---

# 11. Phase 6 — Azure, Databricks, ETL, and AI Mock Interviews

**Objective:** Add practical cloud/data-engineering scenarios and structured AI interviews.

## Copy-ready Prompt 6

```text
# PHASE 6: AZURE, DATABRICKS, ETL TESTING AND AI MOCK INTERVIEW

Repository:
https://github.com/kumaralok9876543/Sql-Software

Use the existing dashboard, question engine, SQL Lab, Python Lab, and Spark Lab. Preserve all verified functionality.

## 1. Azure Data Engineering Lab

Create structured modules for:

### Azure Data Factory
- Pipelines and activities.
- Linked services and datasets.
- Copy Activity.
- Parameters and variables.
- Triggers and scheduling.
- Lookup, ForEach, and conditional activities.
- Integration Runtime.
- Incremental loading.
- Watermark patterns.
- Failure handling and retries.
- Monitoring and troubleshooting.

### Azure Data Lake Storage Gen2
- Containers and directory structures.
- Parquet, CSV, and JSON.
- Access control concepts.
- Partitioning and file organization.
- Secure ingestion and storage patterns.

### Databricks and Delta Lake
- Notebooks and jobs.
- PySpark transformations.
- Delta tables.
- MERGE and upserts.
- Schema enforcement and evolution.
- Incremental ingestion.
- Medallion architecture.
- Bronze, Silver, and Gold layers.
- Job failures and performance troubleshooting.

Initially implement scenario-based questions, diagrams where useful, configuration exercises, and step-by-step explanations.

Do not claim to deploy real Azure pipelines or execute real Databricks jobs unless the corresponding integration has been configured and tested.

## 2. ETL Testing and Data Warehousing

Create interview modules for:
- Source-to-target validation.
- Row-count reconciliation.
- Null and duplicate checks.
- Data type and schema validation.
- Aggregate and financial reconciliation.
- Incremental-load validation.
- CDC.
- SCD Type 1 and Type 2.
- Idempotency.
- Late-arriving records.
- Reprocessing and recovery.
- Fact and dimension tables.
- Star and snowflake schemas.
- Data warehouse fundamentals.
- Data quality rules.
- Batch failures and incident troubleshooting.

Include realistic examples, test scenarios, sample source/target tables, SQL exercises, expected results, and explanations.

Where practical, allow users to solve data-validation questions using the existing SQL execution environment.

## 3. AI Mock Interview

Build an authenticated, session-based mock interview experience.

Allow users to select:
- Interview track.
- Topic.
- Difficulty.
- Number of questions.
- Time limit.
- Interview style: technical, scenario-based, or mixed.

Support interview tracks such as SQL, Python, PySpark, Azure, Databricks, ETL Testing, and mixed Data Engineering.

## 4. Interview workflow

Implement:
1. Create interview session.
2. Show one question at a time.
3. Accept text answers or code where appropriate.
4. Validate code through the relevant secure runner.
5. Ask relevant follow-up questions.
6. Save responses.
7. Generate a final report.
8. Recommend weak topics and revision questions.

Support pause/resume only if the implementation handles session state and timing correctly.

## 5. Feedback and scoring

Use an explicit scoring rubric covering:
- Technical correctness.
- Completeness.
- Reasoning.
- Practical trade-offs.
- Performance and scalability awareness where relevant.

For coding questions, use actual test results when a verified runner exists.

For conceptual questions, use transparent rubric-based AI feedback. Distinguish objective correctness from subjective assessment.

Show:
- Score and rubric breakdown.
- Correct concepts.
- Missing concepts.
- Suggested reference answer.
- Improvement tips.
- Follow-up questions to practise.
- Recommended topics for revision.

Do not claim AI scoring is perfectly accurate. Let users review explanations and retry.

## 6. AI service and security

Use the existing AI integration where appropriate.

Keep API keys server-side. Validate user inputs and limit request sizes, token usage, and rate of requests.

Treat user answers, uploaded content, and retrieved material as untrusted input. Do not allow them to override system instructions or trigger unauthorized tool access.

Use structured response formats and validate AI-generated output before saving or displaying it.

If AI is unavailable, display a clear error and preserve the user's saved responses.

## 7. Data model and access control

Reuse existing user, question, attempt, and progress entities.

Add only necessary structures for:
- Interview sessions.
- Session configuration.
- Responses and follow-ups.
- Rubric scores and feedback.
- Completion status.

Enforce ownership for all session and response endpoints. Do not allow users to access another user's interview history.

## 8. Testing and acceptance criteria

Verify:
- All new modules load and navigate correctly.
- Scenario questions and sample data work.
- SQL-based validation behaves correctly.
- Mock interviews save and resume as documented.
- Scoring uses a defined rubric.
- AI failures are handled safely.
- User sessions remain isolated.
- Existing SQL, Python, Spark, authentication, and progress features still work.

Report which integrations are real, simulated, or awaiting credentials/infrastructure.

Do not connect paid Azure services or create billable resources without explicit authorization.

Stop after Phase 6.
```

### Phase 6 exit criteria

- Azure, Databricks, ETL, and warehouse topics contain useful, verified learning content.
- Mock interview sessions and responses persist correctly.
- Feedback uses an explicit rubric.
- AI failures and limits are handled safely.
- Real cloud integrations are distinguished from educational simulations.
- No cloud costs are incurred without authorization.

---

# 12. Phase 7 — Final QA and Production Readiness

**Objective:** Verify the whole platform, document deployment, and identify all remaining gaps.

## Copy-ready Prompt 7

```text
# PHASE 7: FINAL QUALITY ASSURANCE AND PRODUCTION READINESS

Repository:
https://github.com/kumaralok9876543/Sql-Software

Audit the complete application after Phases 1–6. Do not assume any feature is complete merely because its UI exists.

## 1. Feature acceptance audit

Create a feature-by-feature matrix covering:
- Authentication and authorization.
- SQL Interview Lab.
- Question generation and answer validation.
- AI tutor.
- Dashboard and learning modules.
- Question bank and filters.
- Bookmarks and progress.
- Python editor and isolated runner.
- PySpark editor and Spark runtime.
- Azure and Databricks learning scenarios.
- ETL testing and warehouse modules.
- AI Mock Interviews.
- Admin/content management.
- Database migrations.
- Deployment configuration.

For each feature, record:
- Expected behavior.
- Actual implementation.
- Test evidence.
- Status: Passed, Failed, Partial, Blocked, or Not Implemented.
- Remaining action.

Do not mark simulated functionality as real execution.

## 2. Automated testing

Run and improve:
- Frontend production build.
- Backend production build.
- Type checking and linting, if configured.
- Unit tests.
- API integration tests.
- Database migration tests.
- End-to-end tests.
- Authentication and authorization tests.
- Cross-user isolation tests.
- SQL execution safety tests.
- Python/Spark runner tests where infrastructure exists.
- AI error-handling tests.

Record actual commands and outputs. Do not suppress failures or weaken tests merely to achieve a green build.

## 3. Security review

Perform a final review of:
- Session and token security.
- Role-based authorization.
- User and workspace isolation.
- SQL execution restrictions.
- Code runner isolation.
- File uploads.
- API rate limiting.
- Secrets and environment variables.
- AI prompt injection and output validation.
- Admin access.
- Dependency security.
- Error messages and sensitive logs.
- Resource limits and abuse prevention.

Do not perform destructive penetration tests on production infrastructure.

Fix verified critical and high-severity issues before recommending production deployment. Document any remaining security risks.

## 4. Performance and reliability

Inspect:
- Database indexes and slow queries.
- Pagination.
- Unnecessary frontend requests.
- Loading and error states.
- Large query results and output limits.
- Long-running jobs.
- Runner concurrency and timeouts.
- Retry behavior.
- Logging and operational visibility.

Do not invent performance benchmarks. If measuring performance, record the environment, workload, and actual results.

## 5. Deployment documentation

Document the actual deployment architecture and requirements.

Include:
- Frontend deployment.
- Backend/API deployment.
- PostgreSQL setup and migrations.
- Environment variables and secret configuration.
- AI provider setup.
- Python runner deployment.
- Spark runner deployment.
- Network and access-control requirements.
- Health checks.
- Logging and troubleshooting.
- Backup and recovery considerations.
- Rollback procedure.
- Local development setup.

If Cloudflare Workers, containers, or other services are used, document their actual responsibilities rather than assuming a particular architecture.

Provide an `.env.example` containing placeholder values only. Never include real credentials, API keys, passwords, or production connection strings.

## 6. Data and migration safety

Verify migrations on a disposable or staging database before production.

Confirm:
- Existing users and practice data are preserved.
- Migration order is documented.
- Rollback or recovery steps are explained.
- Seed data does not overwrite user data.
- Production migrations are not run automatically without an explicit deployment process.

## 7. Final user acceptance checklist

Prepare a practical manual checklist for:
- Signing up and logging in.
- Practising SQL.
- Reviewing explanations.
- Tracking progress.
- Running Python code if the runner is available.
- Running PySpark code if the Spark runtime is available.
- Completing an AI mock interview.
- Reviewing results and retrying questions.
- Checking mobile and desktop layouts.
- Verifying authorization between different users.

## 8. Final deliverables

Produce:
1. `docs/FINAL_QA_REPORT.md`.
2. `docs/DEPLOYMENT_GUIDE.md`.
3. `docs/ENVIRONMENT_VARIABLES.md`.
4. Updated README, where necessary.
5. Test summary with actual pass/fail results.
6. Known limitations and unresolved blockers.
7. Production readiness recommendation.

Do not claim the application is production-ready if critical tests, security fixes, required integrations, or deployment configuration remain incomplete.

Do not deploy to production, incur cloud costs, alter production data, or expose services publicly without explicit authorization.

Finish with a clear summary of what works, what is simulated, what remains, and the exact next steps for launch.
```

### Phase 7 exit criteria

- Every target feature has a documented status.
- Tests and builds have verifiable results.
- Critical/high security issues are resolved or clearly block release.
- Deployment and environment requirements are documented.
- Migration and rollback procedures are reviewed.
- Remaining simulated, blocked, and unimplemented features are disclosed.
- Production readiness is based on evidence, not assertion.

---

## 13. Data Model Guidance

This section is architectural guidance, not a command to create every table. Inspect the current database and reuse existing tables wherever appropriate.

Potential entities may include:

| Entity | Purpose |
|---|---|
| `learning_modules` | Learning module metadata |
| `learning_topics` | Topic and subtopic hierarchy |
| `questions` | Shared question metadata and content |
| `question_test_cases` | Validated test cases for coding questions |
| `coding_submissions` | User code submission metadata |
| `execution_jobs` | Runner job status and resource metadata |
| `learning_attempts` | Question attempt history |
| `topic_progress` | User-specific learning progress |
| `bookmarks` | Saved questions |
| `interview_sessions` | Mock interview configuration and status |
| `interview_responses` | Responses and feedback for interview questions |

These are possible names, not mandatory schema definitions. Existing equivalents should be reused or extended. Avoid duplicate models that represent the same concept.

### Data design requirements

- Use foreign keys and appropriate indexes where supported.
- Enforce user ownership on private data.
- Validate inputs at the API boundary.
- Keep question content separate from user attempts.
- Store timestamps consistently.
- Use migrations rather than manual, undocumented schema edits.
- Protect hidden test cases and private reference data.
- Avoid logging secrets, complete credentials, or unnecessary sensitive submissions.
- Define retention and deletion policies for code submissions and execution output.

---

## 14. Security Requirements

### Authentication and authorization

- Authenticate every private API request.
- Enforce roles and resource ownership on the server.
- Do not rely on hidden buttons or frontend route guards.
- Test access using multiple users and roles.
- Protect admin and content-management operations.

### SQL execution

- Use database-level least-privilege permissions.
- Apply appropriate statement and connection timeouts.
- Restrict result sizes and execution resources.
- Prevent access to unauthorized schemas and databases.
- Do not rely only on string-prefix checks for query safety.
- Verify transactions, rollback, and multi-statement behavior.

### Python and Spark execution

- Keep execution separate from the main API process.
- Use an appropriate sandbox or hardened execution environment.
- Restrict CPU, memory, wall-clock time, process count, output size, filesystem, and network access.
- Do not mount secrets or production credentials into user jobs.
- Do not expose a privileged container runtime interface.
- Authenticate job submission and result retrieval.
- Clean up temporary resources.
- Apply queue and concurrency limits.
- Verify that the isolation design matches the actual threat model.

A container alone is not a guarantee of complete isolation. Use an appropriately hardened runtime and review its configuration.

### File uploads

- Validate file type, size, content, and destination.
- Verify ownership and permissions server-side.
- Avoid trusting filenames and client-supplied MIME types.
- Prevent path traversal and unsafe file processing.
- Clean up temporary files.
- Do not allow uploaded content to trigger arbitrary server-side operations.

### AI integrations

- Keep API keys server-side.
- Apply request and usage limits.
- Treat prompts, user answers, uploads, and retrieved content as untrusted.
- Validate structured AI output.
- Do not allow AI-generated code or SQL to bypass the application's security controls.
- Use clear error states when the AI provider is unavailable.
- Avoid representing subjective AI feedback as guaranteed truth.

---

## 15. Testing and Acceptance Standards

Every phase must use evidence-based acceptance criteria.

### Minimum testing categories

- Unit tests for business logic.
- API integration tests.
- Authentication and authorization tests.
- Cross-user isolation tests.
- Database migration tests.
- SQL execution restriction tests.
- Python runner tests when a real runner is available.
- Spark runner tests when a real runtime is available.
- AI failure and malformed-output tests.
- Frontend navigation and empty/error-state tests.
- Regression tests for existing functionality.
- Production build and type checking, where configured.

### Evidence reporting format

For each test, report:

| Field | Required information |
|---|---|
| Test name | What is being verified |
| Command or method | How it was run |
| Environment | Local, CI, staging, or other |
| Result | Passed, Failed, Blocked, or Not Run |
| Evidence | Actual output or test report |
| Limitation | Any missing infrastructure or coverage |

Do not convert a blocked or unexecuted test into a pass.

### Suggested release gate

Do not recommend a production release while:
- Critical or high-severity security issues remain unresolved.
- Authentication or authorization tests fail.
- User data isolation is unverified.
- Required execution services are exposed unsafely.
- Database migrations could cause unreviewed data loss.
- Essential deployment configuration is missing.
- Claimed features have not been verified.

A feature that is intentionally unavailable or simulated may be acceptable if that limitation is visible and documented.

---

## 16. Deployment and Cost Controls

### Deployment documentation should explain

- Required runtime versions.
- Frontend and backend build commands.
- Database setup and migration procedure.
- Required environment variables.
- AI provider configuration.
- Python runner requirements.
- Spark runtime requirements.
- Network access and service identities.
- Health checks and logs.
- Backup and recovery.
- Rollback and incident response.

The actual commands must be discovered from the repository and verified. Do not invent deployment commands or assume that a particular platform supports every required runtime.

### Environment variables

Maintain an `.env.example` with placeholder values only.

Document for each variable:
- Name.
- Purpose.
- Required or optional status.
- Which service uses it.
- How it should be supplied securely.

Never commit real secrets. Do not expose server-only keys through frontend-prefixed variables or client bundles.

### Cost controls

Before enabling cloud execution:
- Estimate the expected resource requirements.
- Configure quotas and timeouts.
- Limit concurrent jobs.
- Prevent arbitrary user access to cloud resources.
- Use explicit authorization before creating billable services.
- Document how to disable or remove the integration.

---

## 17. Definition of Done

A phase is complete only when all applicable items below are satisfied.

- [ ] Scope is implemented as approved.
- [ ] Existing functionality is preserved or changes are documented.
- [ ] Database migrations are reviewed.
- [ ] Authorization and data isolation are verified.
- [ ] Relevant automated tests have been run.
- [ ] Build status is recorded.
- [ ] Manual verification steps are documented.
- [ ] No secrets have been committed.
- [ ] Simulated and real features are clearly distinguished.
- [ ] Known limitations are documented.
- [ ] Changed files and architecture are summarized.
- [ ] The next phase has not started automatically.

### Overall product definition of done

The Data Engineering Interview Studio can be considered ready for a specific release only when its advertised features work as documented, its security controls have been reviewed, relevant tests pass, its deployment process is understood, and any unavailable integrations are clearly disclosed.

Production readiness is a release decision based on evidence, not simply completion of all seven prompts.

---

## 18. Final Project Status Template

Update this section after each implementation phase.

### Current status

- **Current phase:** Phases 2–6 implemented in part; Phase 7 release verification
- **Last completed phase:** Phase 1 audit and roadmap
- **Repository checkpoint:** Current Phase 2–7 changes are local and uncommitted
- **Backend build status:** Type check and production build pass locally
- **Automated backend tests:** 30 pass; 2 opt-in database integration tests skip by default
- **Integration evidence:** Disposable PostgreSQL role isolation, Mongo learning/interview persistence, and two-account API smoke tests pass
- **Security review:** Per-workspace SQL roles are verified; broader multipart and production review remain
- **Production readiness:** Not ready; migration reconciliation, real runner/cloud services, and browser E2E remain outstanding

### Feature status

| Feature | Status | Evidence / notes |
|---|---|---|
| Existing SQL functionality | Partially verified | Existing editor remains; per-workspace isolation passed a disposable PostgreSQL integration. |
| Authentication and authorization | Partially verified | Mongo accounts/sessions and owner-scoped learning/interview APIs exist; full multipart/API matrix remains. |
| Learning dashboard | Implemented, partial | Nine module paths, filters, question bank, attempts, bookmarks, progress, and resume. |
| Shared question engine | Implemented, partial | Mongo MCQ/scenario/coding records; reviewer authoring and more question types remain. |
| Python Lab | Implemented, partial | Lessons, coding editor, hidden-test contract, and private submission history; no runner deployed. |
| Isolated Python execution | Unavailable | External adapter is tested, but no Python sandbox is configured. |
| PySpark Lab | Implemented, partial | Lessons and coding exercise/editor; no Spark runtime deployed. |
| Isolated Spark execution | Unavailable | External adapter is tested, but no Spark service is configured. |
| Azure learning content | Partial | Original ADF/ADLS scenario lessons; no live cloud connection. |
| Databricks learning content | Partial | Original Delta/MERGE lessons; no live Databricks connection. |
| ETL and warehouse content | Partial | Reconciliation, SCD, and quality lessons/questions. |
| AI Mock Interviews | Partial | Mongo sessions, resume, rubric and follow-up flow; AI provider was not called in tests. |
| Final deployment documentation | Partial | Requirements documented; production migration, rollback, and deployment are not verified. |

Update statuses only when supported by repository inspection, tests, or manual verification. Replace this template with actual evidence as work progresses.

---

## Final Instructions for AI Coding Agents

Treat this README as the long-term product specification. At the start of a task, identify the relevant phase and read the related section completely.

**Do not execute all seven phases in one uncontrolled operation.** Start with Phase 1, produce the audit and roadmap, and wait for approval. Implement one phase at a time, preserve working functionality, run tests, report evidence, and stop at each phase boundary.

The goal is not merely to generate more code. The goal is to build a secure, reliable, maintainable, and genuinely useful Data Engineering Interview Studio.
