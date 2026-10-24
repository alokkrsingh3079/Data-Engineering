# Product and Reliability Roadmap

This is a prioritized follow-up list for the deployed project. It does not claim that these items are already implemented. The immediate goal is to improve confidence and reliability before expanding the product surface.

## Priority 0: restore a dependable release signal

- Diagnose the repeated backend GitHub Actions `npm test` failure.
- Make the backend suite finish reliably in both local and CI environments.
- Separate unit, database integration, and sandbox integration test jobs so skips and failures are unambiguous.
- Require the TypeScript checks, backend tests, frontend build, and deployment build to pass before deployment.

**Exit evidence:** clean CI run on a commit; test summary identifies every pass, skip, and failure.

## Priority 1: improve generated-question correctness

- Add held-out records from the selected dataset in addition to AI-authored examples.
- Cover nulls, empty outputs, duplicate values, formatted numerics, and date parsing where relevant.
- Validate expected output shapes and column types, not just row equality.
- Provide clearer per-candidate failure causes and a review/edit/approve step before publishing.
- Let users inspect and normalize inferred dataset types before sending samples to AI.
- Preserve dataset ownership, source attribution, and a clear delete/retention policy.

**Exit evidence:** deterministic tests for malformed candidates and a representative set of real uploads, with candidates saved only after independent checks pass.

## Priority 2: make background work durable

- Move question generation from in-process fire-and-forget work to a durable queue.
- Preserve progress and retry safely across API restarts/deployments.
- Make saving batches idempotent to prevent duplicate questions after retry.
- Define job retention, cancellation, rate limits, and concurrency behavior.

**Exit evidence:** restart/retry integration tests show jobs resume or reach an explicit terminal state without duplicate results.

## Priority 3: expand end-to-end confidence

- Add browser automation for authentication, SQL practice, dataset upload/generation, dataset-specific banks, Python/PySpark execution, and failure states.
- Add authorization regression cases for two separate users and all upload/ownership-sensitive routes.
- Add backup/restore and migration reconciliation procedures for MongoDB and PostgreSQL.

**Exit evidence:** repeatable test reports from clean test databases and a documented rollback procedure.

## Priority 4: strengthen operations and content workflows

- Monitor API, database, AI, and runner availability independently.
- Make runner queue/capacity, execution duration, and failure reasons visible without exposing secrets or submitted private data.
- Prefer a dedicated runner host for continuous availability; keep Codespaces as a development option.
- Add editorial review and versioning for curated and AI-generated question content.
- Use existing topic progress and attempts for explainable recommendations instead of adding disconnected dashboards.

**Exit evidence:** documented service objectives/alerts and a content review history with safe rollback.

## Later product expansion

After the reliability work, prioritize based on learner feedback:

- dataset profiling and safe type normalization;
- adaptive study plans and revision scheduling;
- more ETL/data-quality scenarios with realistic, validated test fixtures;
- expanded system-design interviews;
- optional real cloud integrations only with explicit credentials, cost controls, and secure isolation.

Do not provision billable cloud services automatically. Educational content should be clearly distinguished from real cloud execution.
