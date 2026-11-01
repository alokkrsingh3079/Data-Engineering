
MASTER FEATURE: Databricks Integration + Dual PySpark Execution Engine + Native Databricks Notebooks

Project: SQL Practice Studio – Data Engineering Practice Platform

1. PROJECT OBJECTIVE

Integrate Databricks Free Edition with the existing SQL Practice Studio application without disturbing any existing functionality.

The objective is to provide users with three ways to practice and execute PySpark questions:

1. Existing Local PySpark Runner.
2. New Databricks Serverless PySpark Runner using Databricks Connect.
3. Actual Native Databricks Notebook integration.

Users must be able to choose their preferred execution environment.

The existing local PySpark functionality must continue working exactly as it currently does. Databricks must be introduced as an additional optional execution environment.

The application should not require users to start a local Spark runner when they choose Databricks Serverless execution.

The integration must use the user's configured Databricks workspace and credentials.

---

2. CRITICAL SECURITY AND ENVIRONMENT VARIABLE INSTRUCTIONS

This section is extremely important.

I will manually configure and provide all Databricks credentials in my backend ".env" file or deployment environment variables.

The development agent must inspect the existing environment-variable configuration and use the available Databricks configuration.

Existing environment configuration

Inspect the existing backend ".env" file and identify the following variable names:

- DATABRICKS_HOST
- DATABRICKS_AUTH_TYPE
- DATABRICKS_CLIENT_ID
- DATABRICKS_CLIENT_SECRET
- DATABRICKS_SERVERLESS_COMPUTE_ID

I will enter the actual values myself.

Example configuration structure:

# Databricks Workspace
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com

# OAuth Authentication
DATABRICKS_AUTH_TYPE=oauth-m2m
DATABRICKS_CLIENT_ID=YOUR_CLIENT_ID
DATABRICKS_CLIENT_SECRET=YOUR_CLIENT_SECRET

# Databricks Serverless
DATABRICKS_SERVERLESS_COMPUTE_ID=auto

The example above is only a configuration template. Do not replace existing real credentials with placeholders.

Mandatory security requirements

1. Never ask me to paste Databricks credentials into ChatGPT or an AI chat.
2. Never print actual credential values in terminal output, application logs, debug output or error messages.
3. Never expose secrets through frontend API responses.
4. Never put Databricks credentials in React/Vite frontend environment variables.
5. Never commit ".env" files to GitHub.
6. Verify ".gitignore" excludes ".env", ".env.*" and other secret-bearing configuration files while allowing ".env.example".
7. Do not store OAuth client secrets in ordinary MongoDB documents.
8. Do not store credentials in localStorage, sessionStorage or browser-accessible JavaScript.
9. Read credentials only from secure backend environment variables or an approved server-side secret manager.
10. Never send actual secret values to an AI model for analysis, debugging or code generation.
11. If inspecting ".env", inspect the variable names and configuration structure without displaying their secret values.
12. If a secret is missing, report only the missing variable name, never its value.
13. Use secure credential redaction in all logs and exception handling.
14. Do not silently overwrite existing environment variables.
15. Preserve all existing Render environment variables.
16. Document which variables need to be configured manually in Render.

Local development and production

Support both:

- Local backend development using ".env".
- Production backend deployment using Render environment variables.

The application must not depend on a local ".env" file existing in production.

Provide a ".env.example" containing placeholders only.

I will manually configure the actual credentials.

Authentication

Use the supported Databricks OAuth machine-to-machine authentication mechanism where available.

Verify that the configured service principal:

- Has access to the Databricks workspace.
- Has permission to create and manage notebooks.
- Has permission to execute jobs where supported.
- Has access to the required compute.
- Has appropriate Unity Catalog permissions.
- Can access the required datasets and storage locations.

Do not assume that OAuth scopes automatically grant workspace or resource permissions.

If OAuth M2M, service principal access or any required API capability is unavailable in the Free Edition workspace, identify the exact limitation and propose a supported alternative. Do not silently switch authentication mechanisms.

---

3. CRITICAL: PRESERVE EXISTING APPLICATION

Before making any changes:

1. Inspect the entire existing repository.
2. Understand the frontend and backend architecture.
3. Identify existing API routes.
4. Identify MongoDB collections and schemas.
5. Identify PostgreSQL configuration.
6. Identify the existing Local PySpark Runner.
7. Understand how the current frontend communicates with the local runner.
8. Understand the existing Python runner and SQL execution mechanisms.
9. Inspect existing authentication and progress tracking.
10. Understand the current Render and Cloudflare deployment configuration.

Do not:

- Rewrite the application.
- Replace the existing PySpark Lab.
- Remove the Local PySpark Runner.
- Change the existing SQL Lab.
- Change the Python Lab.
- Change ETL Testing.
- Change Azure or Databricks learning materials.
- Change Notes and Study Material.
- Change Interview functionality.
- Change Dashboard functionality.
- Change existing question-generation functionality.
- Break existing database schemas.
- Rename existing API endpoints.
- Remove existing features.
- Change the existing frontend architecture unnecessarily.

Implement the Databricks functionality as isolated modules with backward-compatible integration.

All existing modules must continue working.

---

4. NEW DUAL PYSPARK EXECUTION ENGINE

This is the most important feature.

The existing PySpark Lab currently requires a local runner to be started before PySpark code can execute.

I want to eliminate that requirement when a user selects Databricks execution.

Add an execution-environment selector inside the existing PySpark Lab.

Execution Environment Selector

Display the following options:

1. Local PySpark.
2. Databricks Serverless.
3. Native Databricks Notebook.

Example UI:

Execution Environment:

[ Local PySpark ] [ Databricks Serverless ] [ Native Notebook ]

The user can choose whichever environment they prefer.

Option A: Existing Local PySpark Runner

Keep the existing implementation exactly as it currently works.

Requirements:

- Existing local connection functionality must remain.
- Existing Run button must remain.
- Existing output display must remain.
- Existing error handling must remain.
- Existing test-case evaluation must remain.
- Existing local runner connection status must remain.

Do not replace or rewrite the local execution implementation.

Option B: Databricks Serverless Runner

Introduce a new remote execution backend using Databricks Connect.

The workflow:

1. User selects Databricks Serverless.
2. Frontend sends the execution request to the backend.
3. Backend authenticates using the configured Databricks OAuth credentials.
4. Backend creates or reuses an appropriate Databricks Connect session.
5. The Spark session connects to supported Databricks Serverless compute.
6. User's PySpark code executes remotely.
7. Execution output and errors return to the existing PySpark Lab.
8. Existing test-case evaluation is performed.
9. The result is recorded in the existing progress system.

The user must not need to:

- Start a local Spark process.
- Start a local PySpark runner.
- Start GitHub Codespaces just for Spark execution.
- Maintain a continuously running local Spark connection.

Technical implementation

Use:

- Databricks SDK.
- Databricks Connect.
- Supported Databricks serverless compute configuration.
- Existing backend API architecture.

Use the appropriate serverless configuration where supported:

DATABRICKS_SERVERLESS_COMPUTE_ID=auto

Select a compatible Databricks Connect version based on the actual supported Databricks Runtime and Python version.

Do not blindly install the latest version.

Verify:

- Python compatibility.
- Databricks Connect compatibility.
- Serverless compatibility.
- Spark API compatibility.

Important: Databricks Connect does not support every PySpark API. Identify unsupported APIs and display clear error messages rather than pretending all local PySpark code will work.

Session management

Implement:

- Connection pooling or safe session reuse where appropriate.
- Session lifecycle management.
- Idle-session cleanup.
- Execution timeout.
- Request cancellation where supported.
- Connection health checks.
- Error recovery.
- Concurrent execution limits.
- Resource usage protection.

Do not create a new remote session unnecessarily for every cell or request.

Do not allow arbitrary unrestricted user code to execute inside the Render backend process.

Execute user code in an appropriately isolated remote execution environment.

Output handling

Return:

- Displayed DataFrame results.
- Schema.
- Row count where practical.
- Execution status.
- Runtime duration.
- Error messages.
- Test-case results.

Preserve the existing PySpark Lab output interface.

Option C: Native Databricks Notebook

Provide the ability to open the actual Databricks notebook interface.

Do not imitate the native Databricks notebook UI.

Open the real workspace notebook in a new browser tab.

---

5. NEW DATABRICKS STUDIO SECTION

Add a separate Databricks Studio section in the sidebar.

Include:

- Integrated Notebook.
- Native Databricks Workspace.
- Workspace Connection.
- Compute Status.
- Notebook History.
- Databricks Progress.
- Dataset Management.

Workspace Connection

Display:

- Connected / Disconnected status.
- Workspace URL.
- Authentication status.
- Service principal connection status.
- Last successful connection time.
- Connection test button.
- Available compute capabilities.

Never display the actual Client Secret.

If credentials are invalid, display a safe message explaining which configuration variable needs attention.

Compute Status

Display:

- Databricks connection status.
- Serverless availability.
- Session status.
- Execution status.
- Active execution reference.
- Last execution result.

Do not assume serverless compute is always available. Handle Free Edition quotas, temporary unavailability and fair-use restrictions.

---

6. QUESTION INTEGRATION

Every generated PySpark question must support:

- Solve in Local PySpark.
- Solve in Databricks Serverless.
- Open Native Databricks Notebook.
- Submit Answer.
- View Previous Attempts.
- Mark for Revision.
- View Solution, subject to the existing solution-access rules.

Use the existing permanent question_id.

Do not create duplicate question records.

The selected execution environment must be recorded for every attempt.

Example:

{
  "question_id": "PYSPARK_001",
  "execution_environment": "DATABRICKS_SERVERLESS",
  "status": "PASSED"
}

Use the actual existing database schema where possible instead of introducing unnecessary duplicate fields or collections.

---

7. NATIVE DATABRICKS NOTEBOOK CREATION

When the user clicks Open Native Databricks Notebook:

1. Retrieve the existing question.
2. Retrieve the question's associated dataset.
3. Retrieve schema and sample data information.
4. Generate a Python notebook.
5. Add question description.
6. Add requirements and instructions.
7. Add dataset-loading instructions.
8. Add editable PySpark solution cells.
9. Add output-inspection cells.
10. Add submission instructions.
11. Import the notebook using the official Databricks Workspace API.
12. Store the notebook URL, notebook path and question_id.
13. Open the actual notebook in a new browser tab.

Example notebook path:

/Workspace/SQL_Practice_Studio/PySpark/Easy/PYSPARK_001

Generate unique notebook paths to avoid accidental overwriting.

Allow users to reopen previously created notebooks.

Preserve existing notebook modifications when reopening.

---

8. NOTEBOOK SUBMISSION AND PROGRESS SYNCHRONIZATION

When the user submits a solution:

1. Authenticate the request.
2. Verify question ownership and notebook association.
3. Retrieve the latest notebook source.
4. Obtain the submitted solution.
5. Execute validation using Databricks Jobs or another supported execution method.
6. Run test cases.
7. Retrieve execution status.
8. Retrieve test results.
9. Update existing question-progress records.
10. Record the execution environment.
11. Store notebook URL and execution reference.
12. Update attempts and revision information.

Do not mark questions completed just because:

- A notebook was created.
- A notebook was opened.
- A notebook was saved.
- A user clicked Submit without successful evaluation.

Use actual validation results.

If automated Jobs API execution is unavailable in the Free Edition workspace, implement a clearly labelled alternative submission mechanism, such as a controlled submission cell, with server-side verification.

Never trust a frontend success flag alone.

---

9. DATASET AND STORAGE MANAGEMENT

Integrate the existing CSV question-generation functionality.

Support:

- Single CSV uploads.
- Multiple CSV uploads.
- ZIP files containing multiple CSV datasets.
- Dataset schema inspection.
- Sample record inspection.
- Dataset reuse.
- Dataset identifiers.
- Dataset-to-question mapping.

Support appropriate Databricks storage integration.

Investigate Unity Catalog Volumes as a possible storage destination.

Allow users to:

- Upload datasets.
- Access datasets from Databricks Serverless.
- Read CSV, JSON and Parquet files.
- Create DataFrames.
- Inspect schemas.
- Reuse datasets across questions.

Do not assume files stored on Render's local filesystem are automatically accessible to Databricks.

Use an explicitly configured, Databricks-accessible storage location.

Keep dataset permissions and user isolation in mind.

Avoid unnecessary duplicate dataset uploads.

Do not make an existing dataset public by default.

---

10. BACKEND API STRUCTURE

Create a separate API namespace:

/api/databricks/

Suggested endpoints:

GET    /api/databricks/connection/status
POST   /api/databricks/connection/test

GET    /api/databricks/compute/status

POST   /api/databricks/execute
POST   /api/databricks/execute/cancel
GET    /api/databricks/execute/:executionId

POST   /api/databricks/notebooks/create
GET    /api/databricks/notebooks/:notebookId
POST   /api/databricks/notebooks/export
POST   /api/databricks/notebooks/submit

GET    /api/databricks/notebooks/history
GET    /api/databricks/progress

POST   /api/databricks/datasets/upload
GET    /api/databricks/datasets
GET    /api/databricks/datasets/:datasetId

These are proposed endpoints. Follow existing project conventions and avoid conflicts with existing routes.

Implement proper:

- Authentication.
- Authorization.
- Input validation.
- Request size limits.
- Execution timeouts.
- Rate limits.
- Error handling.
- Secure logging.

---

11. MONGODB AND PROGRESS TRACKING

Use isolated collections if necessary:

databricks_connections
databricks_notebooks
databricks_execution_history
databricks_datasets

Use the existing question-progress collection for completion and revision tracking.

Do not create a second independent progress system.

Store:

- question_id.
- notebook_id.
- notebook_path.
- notebook_url.
- execution_id.
- execution_environment.
- attempt_number.
- test_results.
- execution_status.
- completion_status.
- created_at.
- updated_at.

Never store OAuth client secrets in these ordinary collections.

If a connection is application-wide, clearly distinguish the application/service-principal identity from individual platform users. Do not imply that each platform user has a separate Databricks account unless individual OAuth connections are implemented.

---

12. FRONTEND REQUIREMENTS

Keep the existing PySpark Lab layout and functionality.

Add the execution-environment selector without disrupting the editor.

Display different connection states:

- Local Runner Connected.
- Local Runner Disconnected.
- Databricks Connected.
- Databricks Disconnected.
- Databricks Executing.
- Execution Completed.
- Execution Failed.
- Databricks Quota Unavailable.

The Run button should execute code using the selected environment.

If the user selects Local PySpark, use the existing runner.

If the user selects Databricks Serverless, call the new Databricks execution backend.

If the user selects Native Notebook, open the associated notebook in the actual Databricks workspace.

Preserve the current editor, output, hints, test cases, revision and progress functionality.

Do not force users to connect Databricks if they prefer local execution.

---

13. FREE EDITION COMPATIBILITY AND LIMITATIONS

The target workspace is Databricks Free Edition.

Before implementation, verify:

- OAuth M2M authentication support.
- Service principal workspace permissions.
- Workspace API availability.
- Jobs API availability.
- Databricks Connect compatibility.
- Serverless compute availability.
- Unity Catalog permissions.
- Volume availability and permissions.
- Notebook import/export capabilities.

Do not assume traditional clusters are available.

Use supported serverless compute where possible.

Handle:

- Free Edition usage quotas.
- Daily or monthly compute restrictions.
- Temporary serverless unavailability.
- API rate limits.
- Execution timeouts.
- Unsupported Spark APIs.

If a capability is unavailable, report it and provide a practical fallback.

Do not claim that an operation works unless it has actually been tested.

---

14. TESTING AND REGRESSION REQUIREMENTS

Before deployment, test all the following:

Existing functionality

1. SQL Lab executes queries.
2. Python Lab executes code.
3. Local PySpark Runner still works.
4. Existing question generation works.
5. Existing CSV uploads work.
6. Existing test cases work.
7. Existing progress tracking works.
8. Existing revision functionality works.
9. Dashboard works.
10. Interview and Notes modules remain unchanged.

Databricks Serverless

11. OAuth connection works.
12. Serverless connection succeeds.
13. A basic Spark DataFrame can be created.
14. DataFrame transformations execute remotely.
15. Joins and aggregations execute.
16. CSV datasets can be read from configured shared storage.
17. Output returns to the frontend.
18. Errors are handled correctly.
19. Execution timeout works.
20. Multiple requests are handled safely.

Native Notebook

21. Notebook creation works.
22. Actual Databricks notebook opens.
23. PySpark code executes in the notebook.
24. Notebook changes can be saved.
25. Notebook can be reopened.
26. Submission works.
27. Test-case results return.
28. Existing question progress synchronizes.
29. Attempts are recorded correctly.
30. Duplicate notebooks are avoided where reuse is intended.

Security

31. No secrets appear in frontend responses.
32. No secrets appear in application logs.
33. No secrets are committed to GitHub.
34. Missing credentials do not crash unrelated modules.
35. Disconnected Databricks does not break local execution.
36. Users cannot access notebooks or datasets outside their authorization.

---

15. DEPLOYMENT REQUIREMENTS

Current application architecture:

- Frontend: Cloudflare.
- Backend: Render.
- User and application data: MongoDB.
- SQL practice database: PostgreSQL.
- Existing local PySpark runner: Preserve it.

Do not change the existing deployment architecture unnecessarily.

Add only the required backend dependencies and Databricks environment variables.

Provide a list of new environment-variable names for manual configuration.

Do not expose credentials to Cloudflare frontend.

Do not automatically deploy until testing is completed.

If a separate Databricks execution service is requi
If a separate Databricks execution service is required because of dependency or resource conflicts, isolate it from the existing backend rather than breaking existing modules.

16. IMPLEMENTATION PHASES
Implement incrementally.
Phase 1: Repository inspection
Understand existing code and document the current execution architecture.
Phase 2: Databricks authentication
Connect the backend to the workspace using the configured OAuth credentials.
Test the connection without exposing secrets.
Phase 3: Dual execution engine
Add Databricks Serverless as an additional execution option while preserving Local PySpark.


Phase 4: Native notebook creation
Generate and open actual Databricks notebooks.
Phase 5: Submission and evaluation
Implement notebook submission, test-case evaluation and progress synchronization.
Phase 6: Dataset integration
Integrate CSV, ZIP, Unity Catalog and supported storage.
Phase 7: Frontend integration
Add Databricks Studio and execution-environment selection.
Phase 8: Regression and security testing
Verify every existing module and all new features.
Phase 9: Deployment readiness


Provide a final deployment checklist and the exact environment variables that I need to configure manually.

Provide a final deployment checklist and the exact environment variables that I need to configure manually.
Do not deploy automatically without approval.
17. FINAL ACCEPTANCE CRITERIA
The implementation is successful only when all the following work:
Existing Local PySpark execution continues working.
Users can choose Local PySpark or Databricks Serverless.
Databricks Serverless executes PySpark remotely without requiring a local runner.
The same PySpark Lab editor works with both execution environments where the APIs are supported.
Users can create and open actual Databricks notebooks.
Users can solve generated questions in those notebooks.
Users can submit their solutions.
Test cases execute and results return to the original platform.
Attempts, solved status and revision tracking synchronize with existing progress.
CSV datasets can be accessed from Databricks through configured storage.
Databricks credentials remain secure.
Existing SQL, Python, PySpark and all other modules continue working.
Databricks can be disconnected without breaking the rest of the platform.


FINAL DEVELOPMENT INSTRUCTION
First inspect the complete existing repository and understand its actual architecture.
Do not immediately start rewriting files.
Prepare a short implementation plan identifying:
Existing files that must remain untouched.
New files and modules required.
Existing components that need minimal integration changes.
New environment variables.
Databricks API requirements.
Compatibility risks.
Database migration requirements, if any.
Then implement the feature incrementally.
Preserve existing functionality, existing database records, existing API contracts and existing user progress.
Do not use fake execution results or simulated Databricks connections.
Do not claim success unless verified against the actual configured Databricks workspace.
The most important requirement is that the user must be able to choose between Local PySpark and Databricks Serverless directly inside the existing PySpark Lab, without having to start a local Spark runner when Databricks is selected.
