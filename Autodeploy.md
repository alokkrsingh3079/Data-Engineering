Project: SQL Practice Studio — Fresh Render Deployment Automation

Act as a senior DevOps engineer and backend deployment specialist.

Objective

Freshly deploy my existing SQL Practice Studio backend to Render directly from my GitHub repository using the Render API.

I want the entire deployment process automated from GitHub Codespaces through an AI coding agent and deployment script.

I do NOT want to manually enter the service name, build command, start command, MongoDB URI, Spark Runner URL, Spark Runner token, OpenAI API key, or other environment variables one by one in the Render Dashboard.

Phase 1: Inspect the existing repository

Before changing anything, inspect my actual repository and identify:

- Backend framework and programming language.
- Backend directory and entry point.
- package.json, requirements.txt, pyproject.toml, Dockerfile, and existing Render configuration, if present.
- Correct build and start commands.
- Required runtime version and port configuration.
- Existing MongoDB and PostgreSQL connections.
- Spark Code Runner integration, including its URL, authentication method, and timeout configuration.
- Existing frontend/backend API communication.
- Existing environment-variable names and which variables are required.
- Existing health-check and diagnostic endpoints, if present.

Do not assume commands, paths, variable names, ports, or endpoints. Determine them from the repository.

Phase 2: Secure environment-variable handling

Read my existing local .env file from GitHub Codespaces, if it exists.

The file may contain:

- MongoDB connection URI.
- PostgreSQL connection URI.
- Spark Runner URL.
- Spark Runner authentication token.
- OpenAI API key.
- Other backend configuration and credentials.

Requirements:

1. Parse the .env file securely.
2. Preserve variable names and values without accidental trimming, quoting errors, or corruption.
3. Never print actual secrets to logs or terminal output.
4. Never commit .env or secrets to GitHub.
5. Never put secret values in render.yaml, Dockerfile, source code, or deployment logs.
6. Validate that required variables exist without revealing their values.
7. Detect missing variables, duplicate keys, malformed entries, and unsafe configuration.
8. Keep non-sensitive configuration separate from secrets.
9. Obtain the Render API key from a secure Codespaces Secret named RENDER_API_KEY.
10. Never ask me to paste the Render API key or application secrets into chat.

If the .env file is missing, do not invent or generate replacement production credentials. Explain which configuration is missing.

Phase 3: Create the deployment automation

Create an idempotent deployment script appropriate for this repository.

The script must:

1. Authenticate with the Render API using RENDER_API_KEY.
2. Verify access to the intended Render workspace.
3. Identify the correct GitHub repository and branch.
4. Derive the service name, runtime, build command, start command, and health-check path from the actual project.
5. Create a fresh Render backend service when explicitly requested.
6. Configure all required environment variables in bulk through the supported Render API.
7. Use the correct Render API request format and current API documentation.
8. Handle asynchronous deployment and wait for the deployment status.
9. Avoid accidentally creating duplicate services on repeated runs.
10. Never delete existing production services or resources without my explicit approval.
11. Never overwrite unrelated services or environment variables.
12. Keep the deployment script safe to rerun.
13. Provide useful sanitized error messages when a request fails.

If the Render API replaces the entire environment-variable collection during an update, verify the API's exact behavior and account for it. Do not unintentionally remove required variables.

Phase 4: Fresh deployment configuration

Create or update the appropriate deployment files, such as:

- render.yaml, if suitable for the actual project.
- Dockerfile, only if Docker is appropriate and required.
- A deployment automation script.
- A validation script.
- .gitignore entries that prevent committing secrets.
- GitHub Actions workflow, if useful for automatic deployment after the initial setup.

Determine whether a native Render runtime or Docker is more appropriate for the existing backend. Do not introduce Docker unnecessarily.

Do not embed application secrets into Docker images.

Phase 5: Spark Runner diagnostics

My Spark Code Runner currently runs through GitHub Codespaces. Its URL and authentication token are already configured in my Render backend, but deployed requests have failed despite working locally.

Investigate this integration separately.

1. Inspect the actual request code and authentication header.
2. Check the expected endpoint and HTTP method.
3. Identify whether the diagnostic endpoint exists before calling it.
4. Distinguish HTTP 401/403 authentication errors from HTTP 404 route errors and connection timeouts.
5. Use only existing supported endpoints unless a new diagnostic endpoint is necessary.
6. Never log or expose the runner token.
7. Do not disable authentication or expose a private Codespaces runner publicly to make tests pass.
8. If the Codespaces runner cannot reliably support production requests, explain the limitations and propose a separately hosted runner as an optional improvement.
9. Do not claim the Spark Runner problem is fixed unless an actual test confirms it.

Phase 6: Deployment verification

After deployment, run the available safe checks:

- Backend build and startup.
- HTTP health check.
- Required environment-variable presence.
- Database connectivity, using safe connection checks.
- Spark Runner connectivity and authentication, if a supported endpoint is available.
- Relevant existing backend tests.

Report the HTTP status codes, deployment status, and sanitized failure reasons.

Do not print passwords, API keys, connection strings, tokens, or secret values.

Do not claim that a test passed if it was not executed successfully.

Phase 7: GitHub-to-Render automation

Configure automatic deployment on subsequent GitHub pushes where supported and appropriate.

Keep the setup minimal, secure, repeatable, and easy to maintain.

The initial setup may require me to add the Render API key once to Codespaces Secrets. After that, I should not have to manually enter each application environment variable into Render for every deployment.

Phase 8: Execution safety and approval

Before making production changes:

1. Show me the proposed service name, repository, branch, runtime, build command, start command, environment-variable names, and deployment strategy.
2. Do not display secret values.
3. Clearly identify whether the plan creates a new service or modifies an existing one.
4. Provide a dry-run mode.
5. Ask for my approval before creating the service or performing production changes.
6. Do not delete, recreate, or overwrite existing resources without explicit approval.

Final deliverables

Provide:

- All deployment files and scripts created or modified.
- The exact one-time setup steps.
- The secure Codespaces Secret configuration required.
- The deployment command to execute.
- The actual deployment result and verification report.
- Any remaining blockers and their recommended fixes.

Start by inspecting the repository and preparing a deployment plan. Do not begin production deployment until I approve the plan.
