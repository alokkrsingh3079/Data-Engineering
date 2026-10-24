# QA and Release Status

**Reviewed:** 2026-10-24
**Repository revision:** `553dbf3` (`Validate complete dataset rows in generated challenges`)
**Scope:** Documentation refresh and verification evidence available in this workspace and public deployment checks. This is not a formal security audit or a complete production acceptance test.

## Current deployment observations

| Check | Result | Evidence and limits |
|---|---|---|
| Render API deployment | Live | Render reported commit `553dbf3` live on 2026-10-24. |
| API health | Passed at check time | `GET /api/health` returned HTTP 200 and reported MongoDB and PostgreSQL healthy. |
| Python runner health | Available at check time | `GET /api/learning/runners/status` reported configured and available. This does not establish continuous uptime. |
| PySpark runner health | Available at check time | Same runner-status response reported configured and available. Runner may depend on an on-demand Codespace; see [runner operations](SELF_HOSTED_RUNNERS.md). |
| Cloudflare deployment | Workflow succeeded | The deploy workflow completed successfully for `553dbf3`; previous verification compared live JS bundles against local build hashes. |

These checks validate service status at a point in time, not every user flow or the full security boundary.

## Checks run during this review

| Check | Result | Notes |
|---|---|---|
| `npm run check --prefix backend` | Passed | TypeScript check completed successfully. |
| `npm run build --prefix frontend` | Passed | TypeScript and Vite production build completed successfully. |
| `npm test --prefix backend` | Incomplete locally | The command remained active after tests and warnings had printed; it was stopped. Do not count it as a full-suite pass. |
| GitHub CI backend job | Failed | Latest inspected run failed at `npm test`; the two preceding recent runs also failed at that step. The available check annotation only stated exit code 1 and did not identify the failing assertion. |
| GitHub CI frontend job | Passed | Latest inspected run completed the frontend job successfully. |
| Cloudflare deployment workflow | Passed | Latest inspected Worker deploy workflow succeeded. |

Focused dataset-question tests and backend build checks had passed during the preceding implementation work, but this does not replace the currently failing full CI backend test job.

## Feature verification boundaries

- SQL practice uses PostgreSQL. Production health proves connectivity, not full SQL isolation or every import/query path.
- MongoDB stores platform and learning records. Startup still includes legacy PostgreSQL compatibility/migration operations; a complete source-data reconciliation and removal plan has not been verified.
- Python/PySpark use separate runner services. Runner health indicates an endpoint responds, not that all sandbox behavior has been independently penetration-tested.
- Dataset-generated coding questions are checked against complete table-column shapes and executed against the configured runner. AI-generated reference output can still be incorrect outside tested cases. User review and additional held-out tests remain worthwhile.
- Interview scoring and AI tutoring are assistance features and can be unavailable or subjective.
- Azure and Databricks tracks are educational content; they do not provision or execute against cloud accounts.

## Outstanding release work

1. Diagnose the repeated backend CI `npm test` failure and make the test run terminate deterministically.
2. Add browser end-to-end tests for signup/login, dataset upload, question generation, dataset-specific banks, SQL execution, and code execution.
3. Increase independent validation for generated questions: held-out dataset rows, null/empty cases, and explicit type normalization where applicable.
4. Make long-running generation jobs durable across API restarts/deployments; current generation work runs in the API process.
5. Reconcile and document the PostgreSQL-to-Mongo compatibility migration, backup/restore, and rollback process before changing/removing source records.
6. Review dependency security and current versions, including the deprecated Multer 1.x dependency noted in prior install output.
7. Confirm runner hosting is durable for the expected users and monitor runner capacity, queueing, and costs.

## Release conclusion

The application is deployed and key production health checks are working. **The project should not be described as fully production-ready or fully regression-verified while backend CI is failing and the full local test command has not completed successfully.** See [deployment operations](../DEPLOYMENT.md) and [project audit](PROJECT_AUDIT.md) for context.
