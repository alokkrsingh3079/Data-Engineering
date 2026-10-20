# Question-

Feature Integration: AI-Powered Question Generation for Existing Data Engineering Platform

1. Primary Objective

I want to add a new sidebar module called Question Generation to my existing Data Engineering Learning Platform.

This is an additive feature, not a project rewrite.

CRITICAL RULE: Do not rebuild, redesign, replace, or unnecessarily refactor the existing application.

My application already contains multiple modules, including:

- Dashboard
- SQL Lab
- Python Lab
- PySpark Lab
- Azure
- Databricks
- ETL Testing
- Notes and Study Material
- Interview
- Ask
- Process Analysis
- Other existing modules and features

First, thoroughly analyze the entire existing application and its architecture. Then implement the new Question Generation feature using the existing architecture, components, database, authentication, and execution infrastructure wherever possible.

Do not remove or break any existing functionality.

---

2. Mandatory Phase 1: Analyze the Existing Project Before Coding

Before making any changes, inspect the complete project.

Analyze:

1. The current frontend architecture, routing, sidebar, layouts, reusable components, and styling.
2. The existing database schema, tables, relationships, migrations, and Row Level Security (RLS) policies.
3. The current authentication and user-role system.
4. How SQL Lab, Python Lab, and PySpark Lab currently load questions and execute code.
5. How questions, difficulty levels, test cases, hints, explanations, solutions, and expected outputs are stored.
6. How Run Code, Submit Solution, test validation, and output rendering work.
7. How solved questions, bookmarks, revision markers, progress tracking, and question status are persisted.
8. Whether an AI integration or existing question-generation service is already available.
9. Whether file upload, storage, dataset management, or background jobs already exist.
10. How the application is deployed and which environment variables, backend services, and runtime dependencies are required.

After analysis

Prepare a concise internal implementation plan identifying:

- Existing components and services that can be reused.
- The correct database tables and relationships to integrate with.
- The safest way to add the new sidebar item and routes.
- How generated questions will connect to the three existing labs.
- Any necessary database migrations, backend functions, or environment variables.

Then implement the feature using that plan.

Do not duplicate an existing service or create a parallel question-management system if the current system can be extended safely.

If an essential integration detail is uncertain, inspect the relevant code and configuration before proceeding. Do not invent database tables, APIs, execution capabilities, or environment variables.

---

3. Add One New Sidebar Item

Add exactly one new primary sidebar item:

Question Generation

Use the existing sidebar's visual design, icons, active states, responsive behavior, spacing, and navigation conventions.

Clicking it should open the new Question Generation module.

Do not reorganize the other sidebar items or redesign the rest of the application.

---

4. Dataset Upload and Management

The new module must support uploading datasets that users can use to generate realistic coding questions.

Supported upload formats

Implement the formats that can be safely parsed by the existing backend or a suitable secure processing service:

- CSV
- XLSX and XLS, where supported
- JSON and JSON Lines, where supported
- ZIP containing supported dataset files, if secure extraction is implemented
- SQL dump or database exports only if a secure, reliable parser is available

Users should be able to upload datasets downloaded from Kaggle or other public dataset repositories. Kaggle integration must not require users to expose their account credentials. Direct Kaggle API integration is optional; uploading a downloaded dataset is the primary requirement.

Upload workflow

1. Select or drag and drop a file.
2. Show upload progress and processing status.
3. Validate the file type, size, encoding, and structure.
4. Preview the dataset in a table.
5. Display the dataset name, row count, column count, column names, inferred data types, null counts, and basic statistics where appropriate.
6. Allow the user to select which tables, sheets, files, or columns to use for question generation.
7. Let the user rename a dataset and add a description.
8. Allow the user to reopen, manage, and delete their uploaded datasets, subject to ownership and authorization rules.

Support datasets containing multiple related CSV files or tables where feasible.

For example, a retail dataset could contain:

- customers.csv
- orders.csv
- products.csv
- order_items.csv

The system should inspect column names, data types, possible keys, and relationships. It must not assume that a relationship exists merely because two column names look similar.

Dataset safety

- Never execute uploaded files or arbitrary SQL dumps automatically.
- Validate file contents, not just file extensions.
- Enforce upload size and processing limits.
- Protect against malicious files, path traversal, unsafe archive extraction, and parser abuse.
- Keep uploaded data private to authorized users.
- Do not expose secrets, credentials, or private data to the client.
- Avoid storing unnecessary copies of large datasets.

---

5. Question Generation Configuration

Create a configuration panel where users can select the exact questions they want.

A. Target Lab

Provide three primary choices:

1. SQL
2. Python
3. PySpark

Each question must be compatible with the selected language and the actual execution capabilities of its destination lab.

B. Number of Questions

Provide convenient choices:

- 10 questions
- 20 questions
- 50 questions
- 100 questions
- Custom quantity

Validate the requested quantity against configured system limits. If a large batch needs asynchronous processing, use a background job with progress tracking rather than freezing the interface.

C. Difficulty

Allow the user to choose:

- Easy
- Medium
- Hard
- Mixed difficulty

For mixed difficulty, provide a configurable distribution or use a sensible default, such as 40% Easy, 40% Medium, and 20% Hard. Explain that the distribution may be adjusted to the available dataset and question complexity.

D. Question Topics

Allow users to choose one or more topics relevant to the selected lab.

SQL examples:

- SELECT and WHERE
- Filtering and sorting
- DISTINCT and NULL handling
- Aggregations and GROUP BY
- HAVING
- JOINs
- Subqueries and CTEs
- CASE expressions
- Date and string functions
- Window functions
- Ranking and analytical queries
- Data quality and deduplication

Python examples:

- Lists, dictionaries, sets, and tuples
- Loops and conditions
- Functions
- String and date processing
- Collections and transformations
- File and CSV processing
- Pandas, when supported by the existing Python Lab
- Data cleaning and validation
- Grouping, aggregation, and business logic

PySpark examples:

- DataFrame operations
- select, filter, and withColumn
- Column transformations
- Null handling
- String and date functions
- groupBy and aggregations
- Joins
- Window functions
- Deduplication
- Data quality checks
- ETL transformations
- Multi-step transformation pipelines

Only offer topics that can be meaningfully supported by the selected lab.

E. Additional Options

Where feasible, allow users to configure:

- Question title and description language.
- Single-table or multi-table questions.
- Topic focus.
- Include business scenarios.
- Include hints and detailed explanations.
- Include test cases.
- Include expected output.
- Avoid questions already generated for the same dataset.
- Generate more questions later without duplicating existing ones.

Use the dataset's actual structure to determine which topics are possible.

---

6. AI Question Generation Engine

Build the generation workflow on the server side using the existing AI provider or integration if one is already configured.

Do not expose API keys or privileged credentials in frontend code.

For every generated question, produce a structured question record containing the applicable fields:

- Question title
- Question statement
- Target lab and language
- Dataset reference
- Difficulty
- Topic and relevant tags
- Required tables or columns
- Input data requirements
- Starter code, if applicable
- Hints
- Explanation
- Reference solution
- Expected output or validation specification
- Test cases and test data, where applicable
- Creation timestamp and generation metadata

Extend the existing question schema where practical instead of duplicating existing fields.

Dataset-grounded generation

Generated questions must be based on the uploaded dataset's actual schema and available data.

The AI must not invent columns, tables, data types, keys, or relationships.

Before generating questions, inspect the dataset schema and determine which operations and scenarios are possible.

For example, if the dataset contains:

employees:

- employee_id
- employee_name
- department
- salary

A valid SQL question could be:

"Find employees whose salary exceeds 50000 and return their names and salaries in descending salary order."

A valid PySpark question could ask the user to filter employees above the same salary threshold and select the required columns.

A Python question could ask the user to calculate department-wise salary statistics using the supported Python data-processing environment.

These are examples only. Actual questions must use the selected dataset's real schema and values.

Question quality

- Generate unique, meaningful questions rather than paraphrasing the same question repeatedly.
- Ensure the question is solvable with the selected language and dataset.
- Use realistic business scenarios when appropriate.
- Match the requested difficulty.
- Provide concise, useful hints without immediately revealing the complete answer.
- Provide detailed explanations and reference solutions.
- Validate generated questions and solutions before making them available for practice.
- Flag or regenerate questions that fail validation.
- Never mark an unverified solution as verified.
- Show clear errors when generation or validation fails.

For large batches, process questions in manageable batches and display progress, completed counts, failed counts, and retry options.

---

7. SQL Questions Must Run in SQL Lab

When a user generates SQL questions, they must appear in the existing SQL Lab.

Reuse the existing SQL editor, execution engine, dataset/table setup, Run Code functionality, result grid, Submit Solution functionality, and test-case framework wherever possible.

Requirements:

- Register or provision the generated dataset using the SQL Lab's existing supported execution environment.
- Ensure the generated question references tables and columns that actually exist.
- Provide the necessary table schema and sample data preview.
- Allow users to write and execute their own SQL.
- Display actual query results from the execution engine.
- Validate submitted answers against the intended result, not just superficial string matching.
- Handle column ordering, duplicate rows, NULLs, and other result semantics appropriately.
- Provide hints, explanations, and reference solutions through the existing interface.

Do not pretend that a table exists in the SQL execution engine merely because the uploaded file is stored in object storage.

If the current SQL Lab uses a particular SQL dialect, ensure generated queries are compatible with it or clearly identify the required dialect.

---

8. Python Questions Must Run in Python Lab

Generated Python questions must appear in the existing Python Lab.

Reuse its editor, runtime, Run Code, output display, submission validation, and progress-tracking features.

Depending on the existing runtime, support:

- Standard Python transformations.
- List and dictionary operations.
- Data cleaning and validation.
- File processing.
- Pandas operations when Pandas is installed and supported.

Provide the necessary dataset access in a secure and consistent manner.

Users must be able to run code, inspect actual output, debug errors, submit their solution, view hints, and review the reference solution.

Do not introduce a different Python execution system unless the existing runtime genuinely cannot support the requirement.

---

9. PySpark Questions Must Run in PySpark Lab

Generated PySpark questions must appear in the existing PySpark Lab.

Reuse its actual PySpark execution backend, question runner, test harness, DataFrame fixtures, editor, output panel, and progress tracking wherever possible.

Support the existing question format as well as notebook-style questions where the current execution infrastructure can safely support both.

Function-based example

from pyspark.sql.functions import col

def solve(employees):
    return employees.filter(
        col("salary") > 50000
    )

Notebook-style example

from pyspark.sql.functions import col

result = employees.filter(
    col("salary") > 50000
)

result.show()

The generation engine must produce questions compatible with the selected execution mode.

For notebook-style execution, preserve variables and state across cells within the same isolated question session when the runtime supports it.

For function-based questions, preserve the existing function contract and automated test mechanism.

Important requirements:

- Use the real configured Spark runtime.
- Provide DataFrames derived from the uploaded dataset.
- Support actual transformations, actions, and output capture.
- Separate Run from Submit Solution.
- Run must execute the code and display actual output.
- Submit must validate the answer against the question's expected behavior.
- Capture standard output, errors, and relevant DataFrame results.
- Prevent one user's session from leaking variables or data into another user's session.
- Never fake Spark output or report successful execution when the runtime failed.
- Do not silently replace PySpark execution with Pandas or ordinary Python.
- If a dataset or transformation exceeds runtime limits, show a useful error or offer a supported sample dataset for practice.

Notebook-style support must be built on the actual backend, not simulated only through the UI.

---

10. Integration with Existing Question Features

This is a critical requirement.

Generated questions must behave like existing questions after they are saved and added to the relevant lab.

Reuse existing functionality for:

- Question Bank
- Difficulty badges
- Topic filters
- Run Code
- Submit Solution
- Test cases
- Actual output
- Expected output
- Hints
- Explanation
- Reference solution
- Mark as solved
- Mark for revision
- Bookmarks or saved questions
- Attempt history
- Progress tracking
- Existing question navigation
- Next and previous question controls

Do not implement a second, separate revision system or solved-status system if the existing application already provides these features.

When a user marks a generated question for revision, that status must persist using the existing tracking system.

When a user solves a generated question, its solved status and progress should update consistently with existing questions.

Do not mark a question as solved merely because the code executed without an error.

Ensure generated questions can be filtered or identified by dataset and generation source without disrupting the existing question bank.

If the existing architecture requires a new question-source field, add it through a backward-compatible migration.

---

11. Dataset and Question Persistence

Persist the information needed to reopen and practice generated questions later.

Use the existing database and storage architecture.

Store only the necessary information, such as:

- Dataset metadata and ownership.
- Dataset storage reference.
- Schema metadata.
- Generation configuration.
- Generated question records.
- Question-to-dataset relationships.
- Question validation status.
- Existing progress and revision records through the existing system.
- Generation job status and error metadata.

Do not store large file contents directly in ordinary database rows unless the existing architecture explicitly requires it.

Use appropriate storage policies and RLS policies so users cannot access another user's private datasets or generated content without authorization.

Publicly available datasets may still contain sensitive information; ownership and access controls must not be skipped.

---

12. UI and UX Requirements

The Question Generation page must match the existing application design.

Create a clean, responsive interface containing the following sections.

A. Dataset Library

- Upload Dataset button.
- Drag-and-drop upload area.
- Dataset list.
- Search and filtering.
- Dataset preview.
- Schema and statistics panel.
- Rename and delete actions.
- Dataset processing status.

B. Generate Questions

- Dataset selector.
- Lab selector: SQL, Python, PySpark.
- Quantity selector: 10, 20, 50, 100, Custom.
- Difficulty selector.
- Topic selector.
- Optional question-generation settings.
- Generate Questions button.

C. Generation Progress

Display:

- Requested question count.
- Generated question count.
- Validated question count.
- Failed question count.
- Current processing status.
- Retry or regenerate actions where appropriate.

Do not display fabricated progress or claim that all questions are validated before validation finishes.

D. Generated Question Summary

Show:

- Question title.
- Lab.
- Difficulty.
- Topic.
- Dataset.
- Validation status.
- Question count.
- Open in Lab action.

Allow users to open a generated question directly in its correct existing lab.

Use the existing design system, theme, buttons, cards, icons, typography, and responsive layouts. Do not redesign unrelated pages.

---

13. Security and Execution Safety

Follow the existing application's security model and strengthen it where necessary.

- Enforce authentication and authorization on the server.
- Keep AI provider keys and other secrets server-side.
- Use RLS and appropriate storage access policies.
- Validate uploaded files and generated payloads.
- Restrict SQL execution to the supported sandbox and permissions.
- Never execute arbitrary uploaded SQL scripts without explicit, controlled parsing and authorization.
- Isolate Python and PySpark execution.
- Apply CPU, memory, execution-time, file-size, and output-size limits.
- Prevent arbitrary filesystem access, network abuse, and cross-session data access.
- Protect against prompt injection originating from dataset values or file contents.
- Treat dataset contents as untrusted data, not as instructions for the AI.
- Do not expose reference solutions or hidden tests unnecessarily before submission if the existing challenge system keeps them private.
- Respect the existing user roles and administrative permissions.

---

14. Backward Compatibility and Database Changes

Do not delete, rename, or alter existing tables, columns, policies, routes, or execution contracts in a way that breaks the current application.

If a schema change is required:

1. Inspect the current schema.
2. Design the smallest necessary backward-compatible migration.
3. Preserve all existing records.
4. Add appropriate constraints, indexes, ownership fields, and RLS policies where required.
5. Test the migration against existing workflows.
6. Ensure the migration can be applied safely in the existing environment.

Do not reset the database, replace the existing Supabase project, switch to a different backend, or use mock data in place of real persisted data.

Do not overwrite existing environment variables or application secrets.

If the existing application lacks a necessary runtime, AI integration, or storage capability, identify that dependency and implement it through the safest compatible approach. Do not pretend the capability already exists.

---

15. Required Testing Before Completion

Verify the following scenarios:

1. Existing application loads without errors.
2. All existing sidebar items still work.
3. SQL Lab, Python Lab, and PySpark Lab continue working with existing questions.
4. Dataset upload, validation, preview, and persistence work.
5. A Kaggle CSV can be uploaded and used for question generation.
6. Generate 10 questions for SQL.
7. Generate 20 questions for Python.
8. Generate 50 or more questions in a supported batch workflow.
9. Generate PySpark questions that use actual Spark-compatible DataFrames and transformations.
10. Verify the requested difficulty and topic filters.
11. Verify questions reference actual dataset columns.
12. Verify duplicate prevention and retry behavior.
13. Verify generated questions open in the correct lab.
14. Verify Run Code shows actual execution results.
15. Verify Submit Solution uses real validation.
16. Verify hints, explanations, and reference solutions.
17. Verify solved status, revision markers, and progress persist.
18. Verify dataset and question access controls between users.
19. Verify empty datasets, malformed files, unsupported formats, and execution errors.
20. Verify that existing records and features remain intact.

Use automated tests where the project supports them. Do not claim a test passed unless it was actually executed.

---

16. Final Implementation Rules

- Analyze first; implement second.
- Extend existing code instead of rebuilding the project.
- Reuse the existing question system, editors, execution engines, validation, and revision tracking.
- Add only the new Question Generation module and the minimum necessary supporting infrastructure.
- Do not add unrelated features, new primary sidebar modules, or unnecessary design changes.
- Do not replace real execution with mock execution.
- Do not create duplicate question records or duplicate progress systems.
- Do not silently change existing behavior.
- Keep implementation maintainable, secure, and compatible with the current deployment.

Definition of Done

The feature is complete only when a user can upload a real dataset, generate a chosen number of dataset-grounded questions at the selected difficulty, open each question in the correct existing lab, execute and validate the solution, access hints and explanations, and use the existing solved/revision tracking functionality.

Most important: preserve the entire existing project and add this feature as a properly integrated extension.
