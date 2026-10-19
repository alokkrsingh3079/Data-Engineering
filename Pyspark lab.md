Phase: Integrate a Real PySpark Lab into SQL Practice Studio

Project Context

I have an existing project named SQL Software — SQL Practice Studio.

GitHub repository: https://github.com/kumaralok9876543/Sql-Software

I want to upgrade this project into a complete Data Engineering Interview Studio while preserving all existing SQL functionality.

Your task is to integrate a fully functional PySpark Interview Lab into the existing application. Do not create a separate disconnected demo application or replace my existing SQL Lab.

1. First, Audit the Existing Repository

Before making changes:

1. Inspect the complete repository structure.
2. Identify the actual frontend framework, backend framework, database, authentication system, API structure, deployment platform, and existing SQL execution engine.
3. Identify the existing navigation, dashboard, question bank, code editor, result panels, user progress system, and design system.
4. Check how SQL queries are executed and how their results are returned to the frontend.
5. Determine whether the current hosting environment can support a Java runtime, Python, PySpark, containers, and long-running jobs.
6. Identify which existing components can be reused.

Do not assume a particular technology stack without checking the code.

Create a brief implementation plan based on the actual repository, then proceed with the implementation. If a required infrastructure capability is unavailable, explain the limitation and implement the appropriate deployable architecture instead of pretending execution works.

2. Add a PySpark Lab to the Existing UI

Add a new navigation item called PySpark Lab.

It must fit the current application's design system and include:

- Dashboard and learning-module integration.
- PySpark question bank.
- Coding workspace.
- Python/PySpark code editor with syntax highlighting.
- Run Code and Submit Solution buttons.
- Sample input datasets and DataFrame previews.
- Execution status, duration, and resource-limit messages.
- Output tables and console output.
- Test Cases, Expected Output, Hints, Explanation, and Solution tabs.
- AI Tutor integration, if an existing AI service is available.
- Saved submissions, bookmarks, progress tracking, and question history.
- Responsive layouts for desktop, tablet, and mobile.

Reuse the current authentication, navigation, reusable UI components, and progress system wherever possible.

Do not break the existing SQL Lab, SQL Database Explorer, query history, or SQL question evaluation.

3. Use Real PySpark Execution — Not a Simulation

The lab must execute genuine PySpark code.

Preferred initial architecture:

Frontend → Backend API → Job Queue → Isolated PySpark Execution Container → Results API → Frontend

Use a separate execution service or worker so Spark workloads do not block the main application server.

The worker should have a compatible, pinned Python, Java, and PySpark environment. Select compatible versions based on the actual deployment platform and document them.

Run Spark in local mode using "local[*]" or a suitably restricted local execution configuration. This should allow exercises to run without provisioning a separate cloud cluster for each question.

Important distinctions:

- Local Spark mode is real Spark execution on one machine.
- It is suitable for many interview-level DataFrame and Spark SQL exercises.
- It does not reproduce the performance or behavior of a multi-machine distributed cluster.
- If the current hosting platform cannot run Spark, deploy the execution worker on a separate compatible service. Do not silently substitute browser-based simulation.

4. Build a Secure Code Execution System

Treat all submitted code as untrusted.

Implement appropriate safeguards, including:

- Run learner code in isolated, short-lived containers or an equivalent strong isolation boundary.
- Apply CPU, memory, process, disk, and execution-time limits.
- Restrict network access and prevent access to internal services and cloud metadata endpoints.
- Do not expose environment variables, database credentials, API keys, host files, or application secrets to learner code.
- Run with a non-root user and minimal container privileges.
- Use a read-only base filesystem where practical, with a restricted temporary workspace.
- Limit concurrent jobs and apply per-user rate limits.
- Terminate timed-out or cancelled jobs and clean up temporary resources.
- Validate input sizes and enforce output-size limits.
- Prevent learners from accessing another user's code, datasets, logs, or submissions.
- Never execute submitted code directly inside the main web application process.
- Do not rely on Python "exec()" alone, a prompt instruction, or simple text filtering as a security boundary.

Return sanitized error messages to learners. Keep sensitive operational logs out of the browser.

5. Create the Execution API

Adapt endpoint names and conventions to the existing backend. Provide equivalent functionality for:

- Creating an execution job.
- Checking execution status.
- Retrieving execution output and structured errors.
- Cancelling a running job.
- Submitting a solution for evaluation.
- Retrieving saved submission history.

Each job should have a unique identifier, authenticated owner, execution status, timestamps, and resource limits.

Handle queued, running, succeeded, failed, timed-out, cancelled, and resource-limit-exceeded states.

For asynchronous execution, use a job queue and status polling or an existing suitable real-time mechanism. Do not keep long-running HTTP requests open unnecessarily.

Do not return a successful result until real execution has completed successfully.

6. Support Real PySpark Learning Exercises

Support common interview topics:

- Creating DataFrames from sample datasets.
- Schema inspection and type conversion.
- "select", "filter", "where", "withColumn", and "drop".
- "groupBy", aggregations, and sorting.
- Inner, left, right, and full joins.
- Null handling and duplicate removal.
- String, date, and timestamp transformations.
- Window functions, ranking, and running totals.
- Conditional logic using "when" and "otherwise".
- Built-in Spark SQL functions.
- Spark SQL queries on registered temporary views.
- Reading and writing approved sample data formats.
- Partitioning, caching, lazy evaluation, transformations, and actions.
- Performance optimization concepts and common interview scenarios.

Use small, controlled datasets for practice. Include realistic examples such as employees, departments, orders, transactions, customers, and event logs.

Keep filesystem operations restricted to a temporary workspace. Do not allow arbitrary paths, unrestricted downloads, or access to production datasets.

7. Implement Test-Case Evaluation

The Submit Solution button must evaluate actual code execution against predefined test cases.

Implement a reliable evaluation system that can:

- Compare actual and expected DataFrame contents.
- Handle row ordering appropriately when ordering is not part of the question.
- Respect column names and expected data types where required.
- Handle null values and duplicate rows correctly.
- Evaluate multiple test cases.
- Distinguish runtime errors from incorrect answers.
- Return passed/failed test counts and useful explanations.
- Keep hidden test cases inaccessible to learners.

Do not evaluate correctness by comparing output text alone when structured DataFrame comparison is possible.

Prevent learners from reading hidden expected results or modifying the evaluator.

8. Integrate AI Assistance

If the existing project has a working AI service, reuse it through the backend. Do not expose AI provider API keys in frontend code.

Add these actions:

- Explain My Code.
- Give Me a Hint.
- Explain This Error.
- Optimize My PySpark Code.
- Show a Step-by-Step Solution.
- Generate a Similar Practice Question.
- Explain the underlying Spark concept.

AI assistance must use the actual question, learner code, and sanitized execution output where relevant.

Do not allow AI-generated explanations to fabricate execution results. If real execution data is unavailable, clearly label the explanation as theoretical.

Respect the selected hint/solution policy for hidden test cases and interview practice.

9. Add Learning Progress and Persistence

Use the existing database and authentication system if suitable.

Persist the appropriate information:

- PySpark questions and difficulty levels.
- Topic and learning-path metadata.
- Public sample datasets and test-case definitions.
- User submissions and scores.
- Execution metadata and sanitized errors.
- Completion status and question bookmarks.
- Learning progress and recent activity.

Keep large execution logs and temporary datasets out of permanent database records unless required.

Use proper authorization and database access controls. If schema migrations are necessary, provide reversible migrations and do not delete or overwrite existing user data.

10. Provide a Complete Question Experience

Every question page should contain:

1. Problem statement.
2. Difficulty and topic.
3. Input dataset preview.
4. Required output and schema.
5. Code editor with a sensible starter template.
6. Run Code and Submit Solution actions.
7. Actual execution output.
8. Test-case results.
9. Hints and explanation.
10. Reference solution.
11. Related questions.
12. Save/bookmark and mark-as-completed controls.

Provide a few seeded, working questions covering DataFrame filtering, aggregation, joins, window functions, and null handling.

Starter code and sample datasets must be appropriate to each question. Do not use identical hardcoded outputs for every exercise.

11. Deployment and Infrastructure

Inspect the actual deployment environment before selecting the final design.

Provide:

- A reproducible PySpark worker setup.
- A pinned dependency manifest.
- A Dockerfile and container configuration where appropriate.
- A documented backend-to-worker API.
- Environment-variable documentation without real secrets.
- Health checks and readiness checks.
- Job queue configuration if required.
- Logging, cleanup, and resource-limit configuration.
- Local development instructions.
- Deployment instructions for the existing frontend/backend and the separate worker.
- A clear explanation of which components need separate hosting.

Do not assume that a serverless frontend host can run Spark locally. If the existing hosting platform does not support Java, PySpark, or persistent workers, keep the UI on the existing platform and deploy the Spark execution service separately.

Avoid requiring paid Databricks or cloud-cluster access for basic exercises. Managed Spark integration can be added later as an optional advanced mode.

12. Testing and Acceptance Criteria

Add automated tests appropriate to the existing stack.

Verify all of the following:

- A user can open PySpark Lab from the existing navigation.
- A valid PySpark program executes on a real Spark runtime.
- A DataFrame aggregation returns the correct actual output.
- A join and a window-function exercise can execute.
- A syntax error returns a useful, sanitized error.
- An infinite loop or long-running job is stopped by the configured timeout.
- Resource limits and job concurrency controls work.
- Cancelled and failed jobs display the correct status.
- Test cases correctly distinguish passing and failing solutions.
- Hidden test cases and other users' submissions remain inaccessible.
- Unauthorized users cannot submit jobs or inspect another user's results.
- Existing SQL execution and database exploration still work.
- Existing authentication, progress, and question-bank features are not broken.
- The deployed environment can actually start and execute the Spark worker.

Include evidence from tests and identify any checks that could not be completed.

13. Final Deliverables

When finished, provide:

1. A summary of the existing architecture discovered.
2. A list of files created or modified.
3. The implemented PySpark Lab features.
4. The actual execution architecture and Spark version.
5. Setup and deployment instructions.
6. Required environment variables.
7. Database migrations, if any.
8. Automated test results.
9. Remaining limitations and infrastructure costs or requirements.
10. A clear distinction between completed functionality and planned functionality.

Non-negotiable requirements

- Preserve all existing SQL Practice Studio functionality.
- Use genuine PySpark execution, not mocked results.
- Do not expose secrets or execute untrusted code inside the main application server.
- Do not claim a feature works until it has been implemented and verified.
- Do not replace existing project files blindly.
- Keep the implementation modular so Python Lab, SQL Lab, and PySpark Lab can use a consistent interface while retaining separate execution engines.
- Finish with a working, testable implementation rather than only a UI mockup or an architecture document.
