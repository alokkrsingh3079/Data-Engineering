Feature: Hybrid AI Notes Builder for SQL Practice Studio

Project Context

I have an existing Data Engineering learning and interview preparation platform called SQL Practice Studio.

The platform already has a sidebar named Notes and Study Material, which contains existing features such as:

- Notes Dashboard
- Upload PDF
- Generate Notes from PDF
- Generate Notes from Topic
- Create Notes
- Existing notes management and study material workflows

I want to enhance this existing module by adding a professional Hybrid AI Notes Builder that combines manual note-taking, AI-assisted content generation, voice input, code formatting, live editing, and a review-before-save workflow.

CRITICAL INSTRUCTIONS

Before writing any code, thoroughly analyze the existing repository and implementation.

1. Inspect the current frontend framework, backend architecture, database models, API routes, authentication, AI integration, editor components, and notes-related features.
2. Identify how existing notes are created, stored, retrieved, edited, and displayed.
3. Reuse the existing database, authentication, API patterns, AI services, UI components, and design system wherever possible.
4. Do not create a separate application or duplicate the existing notes system.
5. Do not remove or break existing Notes Dashboard, PDF upload, PDF generation, topic generation, or Create Notes functionality.
6. Integrate the new feature into the existing Notes and Study Material sidebar.
7. Preserve existing routes, database records, user progress, and unrelated application features.
8. Implement the feature fully, including frontend, backend, persistence, error handling, and testing. Do not stop at a UI mockup or static prototype.
9. If an existing capability already solves part of the requirement, extend it instead of implementing a competing version.
10. Do not claim that a feature works unless it has been implemented and tested.

1. Add a New Sidebar Option

Inside the existing Notes and Study Material section, add a new option:

Hybrid Notes Builder

Place it near the existing Create Notes and Generate Notes from Topic options, following the current sidebar conventions.

When selected, it should open a dedicated note creation workspace.

Use the application's existing routing, sidebar state, responsive layouts, theme, authentication, and navigation patterns.

2. Create a Professional Notes Editor Workspace

Build a modern, professional, responsive editor with three logical areas:

A. Note structure and creation tools

B. Main editing workspace

C. AI assistant and preview/review controls

On desktop, use an efficient multi-panel layout. On mobile, use a responsive stacked layout or collapsible panels.

The interface should feel like a polished learning and documentation tool, not a basic text box.

Note metadata

Provide fields for:

- Note title
- Subject/category
- Topic
- Subtopic (optional)
- Difficulty: Beginner, Intermediate, Advanced
- Tags
- Optional source/reference

Support categories relevant to the existing application, including SQL, Python, PySpark, Data Engineering, ETL Testing, Databricks, Azure, Snowflake, Data Warehousing, and Interview Preparation.

Reuse existing categories and taxonomies if available.

3. Hybrid Manual + AI Note Creation

The user must be able to create one complete note using any combination of manual content, AI-generated content, and voice input.

A. Manual writing

Provide an editor that allows users to:

- Type definitions and explanations.
- Create headings and subheadings.
- Add paragraphs and bullet lists.
- Create numbered steps.
- Add tables.
- Insert code blocks.
- Add examples and outputs.
- Edit any content freely.
- Reorder sections.
- Delete or duplicate sections.
- Save a draft and continue later.

Manual content must never be overwritten automatically by an AI response.

B. AI-assisted writing

Add an AI assistant panel within the editor.

The user should be able to select existing text or specify a section and request actions such as:

- Generate a definition.
- Explain a concept in simple language.
- Improve an incomplete explanation.
- Generate a practical example.
- Generate PySpark, SQL, or Python code.
- Explain code line by line.
- Add expected output.
- Generate interview questions and answers.
- Add real-world Data Engineering use cases.
- Identify missing concepts.
- Improve formatting and readability.
- Summarize a long explanation.
- Expand short notes into detailed study notes.
- Generate revision points.

Provide an instruction input such as:

"Explain what a DataFrame is, why it is used in PySpark, and demonstrate how to create one from a CSV file."

Allow the user to choose the content type, if useful:

- Definition
- Explanation
- Code Example
- Interview Notes
- Practical Example
- Revision Summary
- Custom Instruction

The user must be able to generate a section, insert it into the current note, replace selected content only after confirmation, or discard it.

Never automatically replace the entire note when generating one section.

C. Mixed-content workflow

Support this workflow:

1. The user types a heading: "What is a Dataset?"
2. The user manually writes an incomplete definition.
3. The user selects the definition and asks AI to improve it.
4. AI suggests a more complete definition.
5. The user reviews the suggestion and inserts it.
6. The user adds another heading: "Creating a DataFrame in PySpark".
7. The user enters a partial code example.
8. AI completes or corrects the code.
9. The user inserts the code as a formatted code block.
10. The user manually adds their own explanation.
11. The user reviews the entire note before saving.

This hybrid workflow is the core requirement.

4. Voice-Based Note Creation

Add a microphone button to support voice-driven note creation.

The user should be able to dictate instructions such as:

"Create notes about PySpark DataFrames. Explain the definition, how to create a DataFrame from CSV, and show a filter example."

Expected workflow:

1. Request microphone permission when necessary.
2. Capture speech and transcribe it into editable text.
3. Display the transcription before executing an AI generation request.
4. Allow the user to correct the transcription.
5. Let the user choose whether to insert the transcribed text directly or ask AI to transform it into notes.
6. Insert the result into the current editor without losing existing content.

Provide clear recording, processing, success, and error states.

Use browser speech recognition if compatible with the existing application and supported browsers. If it is unavailable, use an existing speech-to-text service or an appropriate backend integration.

Do not assume a speech API or AI provider is already configured. Inspect the existing integrations first.

Handle microphone denial, unsupported browsers, empty transcription, network failures, and recording cancellation gracefully.

Voice input must be optional. Manual typing must always remain available.

5. Rich Formatting and Code Blocks

The notes must look like professional technical documentation.

Support:

- H1, H2, and H3 headings
- Bold and italic text
- Bulleted and numbered lists
- Tables
- Inline code
- Multiline code blocks
- Syntax highlighting
- Copy-code functionality
- Language labels such as Python, PySpark, SQL, and JSON
- Expected output blocks
- Notes, tips, and warning sections
- Clear separation between explanations, examples, and outputs

Use the editor and rendering libraries already present in the repository when possible.

If Markdown is the existing content format, preserve compatibility. If rich-text content is already used, extend that implementation instead of introducing an incompatible format.

Code blocks must remain editable and must not be flattened into ordinary paragraph text.

6. Example: PySpark DataFrame Notes

The editor must support notes like the following.

Title: Understanding DataFrames in PySpark

Section: Definition

A DataFrame is a distributed collection of data organized into named columns. It is used to perform structured data processing, filtering, joining, aggregation, and transformations in PySpark.

Section: Creating a DataFrame

Language: Python / PySpark

data = [
    (1, "Amit", 25),
    (2, "Neha", 28),
    (3, "Rahul", 30)
]

columns = ["id", "name", "age"]

df = spark.createDataFrame(data, columns)

df.show()

Section: Filtering Data

filtered_df = df.filter(df.age > 25)

filtered_df.show()

Section: Explanation

- "data" contains sample records.
- "columns" defines the DataFrame column names.
- "spark.createDataFrame()" creates a DataFrame from the provided records.
- "filter()" selects rows satisfying a condition.
- "show()" displays the resulting rows.

Section: Expected Output

Display the expected output in a readable table or code block.

AI should be able to generate these sections separately, and the user must be able to modify all generated content before saving.

Do not imply that this example requires a manually created SparkSession when it runs inside a standard Databricks notebook with an existing "spark" variable.

7. Review and Preview Before Saving

Create a dedicated Review / Preview step.

The user must be able to preview the complete note as it will appear in the final Notes and Study Material section.

Preview must render:

- Headings
- Paragraphs
- Lists
- Tables
- Code blocks with syntax highlighting
- Expected output
- Notes and warnings
- Tags and metadata

Provide actions such as:

- Back to Edit
- Edit Section
- Regenerate Selected Section
- Save Draft
- Publish / Save Note
- Cancel

The preview must reflect the latest editor content, not an earlier generated response.

The note editor may optionally embed user-selected PNG, JPEG, WebP, or GIF images. Resize and compress images before saving, render them in both preview and the saved Notes reader, and keep image sources restricted to embedded image data. Provide a rich text-color palette whose selected colors also remain visible in the saved reader.

AI section suggestions should stream into the review panel as tokens arrive, with a visible elapsed time. Bound generation to 30 seconds and 1,000 output tokens, and stop provider work when the client disconnects.

Code snippets should be insertable inside any text section using a language-aware, editable fenced-code template. Standalone code sections remain optional; AI-generated code should use the selected subject's language and stay in the current section when inserted.

Allow the user to navigate back to editing without losing content.

Saving must occur only after an explicit user action.

8. Drafts, Saving, and Existing Notes Integration

Integrate with the existing notes persistence layer.

Required behavior:

- Save incomplete notes as drafts.
- Save complete notes through the existing note creation mechanism where compatible.
- Edit previously saved notes.
- Reopen drafts.
- Delete notes using the application's existing confirmation and permission patterns.
- Associate notes with the authenticated user.
- Preserve ownership and access restrictions.
- Display saved notes in the existing Notes Dashboard.
- Allow saved notes to be opened, edited, and reviewed later.
- Preserve the existing PDF upload and note generation workflows.

Prevent accidental data loss by warning the user about unsaved changes when navigating away.

Use the existing database and data model whenever possible. Add migrations only when genuinely required.

If autosave is implemented, provide a visible saving/saved/error indicator and avoid race conditions or overwriting newer edits with stale requests.

9. AI Generation Architecture

Use the existing AI integration and backend conventions.

All AI requests must be validated and handled safely by the backend when appropriate. Do not expose secret API keys in frontend code.

The AI prompt must instruct the model to:

- Generate technically accurate study notes.
- Match the requested topic, difficulty, and language.
- Explain concepts in an understandable way.
- Include practical examples where appropriate.
- Use valid syntax for the requested programming language.
- Keep code and explanations in separate sections.
- Include expected output when it can be determined reliably.
- Avoid inventing unsupported claims or pretending untested code has been executed.
- Preserve existing user-written material unless the user explicitly asks to replace it.
- Generate only the requested section when section-level generation is selected.

For code generation, clearly distinguish generated code from verified execution results. Do not claim that code has passed tests unless it has actually been run successfully.

Support regeneration and retries without duplicating existing sections.

10. AI Usage and Error Handling

Follow existing application limits, authentication, and AI service configuration.

Provide:

- Loading indicators
- Clear API errors
- Retry controls
- Empty states
- Validation messages
- Appropriate handling of timeouts
- Protection against duplicate submissions
- Reasonable limits on input size and generated content

Do not create fake AI responses or static sample data as substitutes for the actual AI integration.

If the AI provider is unavailable, manual editing and draft saving should continue to work.

11. Professional UI/UX

Follow the existing platform's visual design, typography, spacing, colors, cards, buttons, navigation, and responsive behavior.

The editor should include:

- A clear note title area
- A formatting toolbar
- A multi-color text palette
- Optional compressed images embedded in notes and shown in preview
- A central writing area
- An AI assistance panel
- A microphone control
- A section outline, where useful
- A clear Review and Save workflow
- Unsaved-change indicators
- A readable rendered preview

Avoid excessive gradients, unnecessary animations, oversized cards, or cluttered controls.

Use accessible labels, keyboard navigation, and responsive layouts.

12. Testing Requirements

After implementation, test the following:

1. Create a note manually.
2. Create a note using AI generation.
3. Generate and insert a single section without replacing the whole note.
4. Combine manual and AI-generated content.
5. Dictate a note where speech recognition is supported.
6. Edit generated code blocks.
7. Preview headings, tables, lists, code formatting, colored text, and embedded images.
8. Save a draft and reopen it.
9. Save a complete note and find it in the existing Notes Dashboard.
10. Edit a previously saved note.
11. Navigate away with unsaved changes.
12. Handle AI failures and microphone permission denial.
13. Verify authentication and note ownership.
14. Confirm all existing PDF upload and topic-generation workflows still work.
15. Run the existing test suite and relevant build/lint checks.

Add automated tests following the existing testing conventions.

Do not weaken or remove existing tests to make the feature pass.

13. Implementation Process and Final Report

Work in the following order:

Phase 1: Inspect the repository and document the current notes architecture.

Phase 2: Identify reusable editor components, APIs, database models, AI services, and storage mechanisms.

Phase 3: Implement the new Hybrid Notes Builder and its integration with the existing sidebar.

Phase 4: Implement AI-assisted editing, voice input, preview, drafts, and persistence.

Phase 5: Test the new workflow and all affected existing features.

Phase 6: Provide a concise implementation report.

The report must include:

- Files created or modified.
- Existing components and services reused.
- Database changes, if any.
- API endpoints added or changed.
- AI and speech-to-text integration details.
- Features actually implemented.
- Tests run and their results.
- Any remaining configuration or deployment steps.

IMPORTANT: Do not stop after describing a plan. Implement the feature in the existing repository using its actual architecture. Do not rewrite unrelated modules or replace working features with mock implementations.