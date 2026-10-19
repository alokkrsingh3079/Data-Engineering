import crypto from "node:crypto";
import { mongoCollection } from "./mongo.js";
import { executeOnRunner, runnerHealth, type RunnerLanguage } from "./runners.js";

const seedQuestions = [
  {
    id: "python-batch-validation",
    module_id: "python-etl",
    topic: "Data transformation",
    subtopic: "Validation",
    tags: ["python", "etl", "data quality"],
    difficulty: "beginner",
    type: "mcq",
    title: "Validate an incoming batch",
    prompt: "A JSON batch contains events with optional fields and occasional malformed IDs. Which transformation strategy is safest for a repeatable ETL job?",
    options: [
      { id: "a", text: "Validate required fields at the boundary, normalize valid rows, and route rejects with reasons." },
      { id: "b", text: "Skip validation and let the final database insert report the first error." },
      { id: "c", text: "Mutate each input object and silently drop every row that raises an exception." },
      { id: "d", text: "Convert every value to a string so all records have matching types." }
    ],
    answer_id: "a",
    reference_answer: "Validate required fields at the boundary, normalize valid rows, and route rejected rows with explicit reasons.",
    explanation: "Boundary validation makes the accepted output predictable, while a reject stream preserves evidence of malformed source data. A deterministic, non-mutating transform can be safely tested and replayed.",
    common_mistakes: ["Silently discarding invalid records", "Relying only on downstream database errors"],
    hints: ["Consider how the pipeline should explain rejected records.", "Prefer deterministic transformations that can be replayed."],
    status: "published"
  },
  {
    id: "python-generator-memory",
    module_id: "python-etl",
    topic: "Iterators and generators",
    subtopic: "Memory efficiency",
    tags: ["python", "generators", "batch processing"],
    difficulty: "intermediate",
    type: "mcq",
    title: "Stream a large input file",
    prompt: "A job processes a multi-gigabyte newline-delimited JSON file. Which approach avoids loading the entire file into memory?",
    options: [
      { id: "a", text: "Read the file line by line and yield each decoded record." },
      { id: "b", text: "Call read() and split the complete string into lines." },
      { id: "c", text: "Decode all records into a list before processing." },
      { id: "d", text: "Increase the process memory limit and keep the full list." }
    ],
    answer_id: "a",
    reference_answer: "Iterate over the file and yield decoded records as they are consumed.",
    explanation: "An iterator or generator keeps memory proportional to the current record or batch rather than the full file size.",
    common_mistakes: ["Materializing a generator with list()", "Confusing a larger memory limit with streaming"],
    hints: ["Look for an approach with bounded memory as file size grows."],
    status: "published"
  },
  {
    id: "spark-shuffle-groupby",
    module_id: "pyspark-foundations",
    topic: "Spark execution",
    subtopic: "Shuffles",
    tags: ["spark", "groupBy", "shuffle"],
    difficulty: "intermediate",
    type: "mcq",
    title: "Understand a groupBy cost",
    prompt: "A Spark DataFrame performs a groupBy on a key spread across many input partitions. What is the usual execution cost to expect?",
    options: [
      { id: "a", text: "A shuffle moves rows with matching keys so they can be aggregated together." },
      { id: "b", text: "No data movement occurs because transformations are lazy." },
      { id: "c", text: "The driver collects every row before grouping." },
      { id: "d", text: "Spark permanently repartitions the source files." }
    ],
    answer_id: "a",
    reference_answer: "A groupBy generally requires a shuffle to bring equal keys together across partitions.",
    explanation: "Lazy evaluation defers execution; it does not remove the data movement required by a wide aggregation. The physical plan can confirm the exchange.",
    common_mistakes: ["Treating laziness as zero execution cost", "Assuming a groupBy always runs locally"],
    hints: ["Ask what must happen when equal keys begin on different workers."],
    status: "published"
  },
  {
    id: "spark-action-execution",
    module_id: "pyspark-foundations",
    topic: "Spark execution",
    subtopic: "Actions",
    tags: ["spark", "lazy evaluation", "actions"],
    difficulty: "beginner",
    type: "mcq",
    title: "Identify the Spark action",
    prompt: "A DataFrame is filtered and projected, then written to Parquet. Which operation triggers execution of the plan?",
    options: [
      { id: "a", text: "The write operation." },
      { id: "b", text: "The filter call immediately scans all source data." },
      { id: "c", text: "Creating the DataFrame variable." },
      { id: "d", text: "The projection always materializes a cached result." }
    ],
    answer_id: "a",
    reference_answer: "The write is an action and triggers execution of the lazy transformations.",
    explanation: "DataFrame transformations build a plan; actions such as write, count, and collect cause Spark to execute it.",
    common_mistakes: ["Calling every transformation an action", "Assuming a DataFrame variable contains materialized rows"],
    hints: ["Which operation must produce an externally visible result?"],
    status: "published"
  },
  {
    id: "adf-watermark-commit",
    module_id: "azure-data-factory",
    topic: "Incremental ingestion",
    subtopic: "Watermarks",
    tags: ["azure", "adf", "watermark", "retries"],
    difficulty: "intermediate",
    type: "scenario",
    title: "Commit a watermark safely",
    prompt: "An Azure Data Factory pipeline copies records after a stored watermark. Where should it advance the watermark to avoid skipping data after a failed run?",
    options: [
      { id: "a", text: "After the destination write is durable and its validation succeeds." },
      { id: "b", text: "Before starting the copy, so retries always begin at the newest value." },
      { id: "c", text: "Immediately after reading the source maximum timestamp." },
      { id: "d", text: "Only when the pipeline is manually restarted." }
    ],
    answer_id: "a",
    reference_answer: "Commit the new watermark only after the bounded write is durable and validated; make retries idempotent.",
    explanation: "Advancing before a durable sink write can permanently skip records. A failure before commit can cause replay, so the destination should support idempotent writes.",
    common_mistakes: ["Advancing the cursor before data is durable", "Ignoring duplicate-safe retries"],
    hints: ["Consider the failure window between source read and destination commit."],
    status: "published"
  },
  {
    id: "databricks-merge-duplicates",
    module_id: "databricks-delta",
    topic: "Delta Lake",
    subtopic: "MERGE",
    tags: ["databricks", "delta", "merge", "deduplication"],
    difficulty: "advanced",
    type: "scenario",
    title: "Prepare a Delta MERGE source",
    prompt: "A Delta MERGE fails because multiple source rows match the same target key. What should the pipeline do before merging?",
    options: [
      { id: "a", text: "Deduplicate by the merge key using a deterministic tie-breaking rule." },
      { id: "b", text: "Retry the unchanged source until the merge succeeds." },
      { id: "c", text: "Remove the merge predicate so every row is inserted." },
      { id: "d", text: "Enable schema evolution to resolve duplicate keys." }
    ],
    answer_id: "a",
    reference_answer: "Reduce the source to one deterministic row per merge key before executing MERGE.",
    explanation: "A deterministic one-row-per-key source avoids ambiguous multiple matches and makes retries reproducible. Schema evolution does not resolve key conflicts.",
    common_mistakes: ["Dropping duplicates without deterministic tie-breaking", "Treating schema evolution as a data-quality fix"],
    hints: ["A merge key should identify at most one source row for each target row."],
    status: "published"
  },
  {
    id: "etl-reconciliation-checks",
    module_id: "etl-data-quality",
    topic: "ETL testing",
    subtopic: "Reconciliation",
    tags: ["etl", "reconciliation", "data quality"],
    difficulty: "beginner",
    type: "mcq",
    title: "Go beyond row counts",
    prompt: "Source and target row counts match for a batch, but records may still be duplicated or altered. Which additional checks provide stronger evidence?",
    options: [
      { id: "a", text: "Check key uniqueness, required-field nulls, and selected aggregate totals for the same batch." },
      { id: "b", text: "Repeat the row-count query and treat two matching counts as proof." },
      { id: "c", text: "Compare only the newest target timestamp." },
      { id: "d", text: "Skip checks when the orchestration activity reports success." }
    ],
    answer_id: "a",
    reference_answer: "Combine count reconciliation with key, nullability, and relevant aggregate checks over the same batch boundary.",
    explanation: "Equal counts do not prove that the same records or values arrived. Independent key and content checks catch different failure classes.",
    common_mistakes: ["Treating orchestration success as data correctness", "Comparing different batch windows"],
    hints: ["Use checks that detect duplicates and changed values, not only missing rows."],
    status: "published"
  },
  {
    id: "etl-scd-type-two",
    module_id: "etl-data-quality",
    topic: "Data warehousing",
    subtopic: "Slowly changing dimensions",
    tags: ["etl", "scd type 2", "warehouse"],
    difficulty: "advanced",
    type: "mcq",
    title: "Represent a Type 2 change",
    prompt: "A customer's address changes and history must remain queryable. What is the defining Type 2 dimension behavior?",
    options: [
      { id: "a", text: "Expire the prior version and insert a new version with effective-time metadata." },
      { id: "b", text: "Overwrite the address in place and keep one row." },
      { id: "c", text: "Delete all historical versions and reload the dimension." },
      { id: "d", text: "Add a new fact row without changing the dimension." }
    ],
    answer_id: "a",
    reference_answer: "Keep the old version with an end boundary and insert a new current version with effective-time metadata.",
    explanation: "Type 2 preserves historical attribute values by creating a new dimension row and marking the previous row no longer current.",
    common_mistakes: ["Confusing Type 1 overwrite with Type 2 history", "Failing to define effective date boundaries"],
    hints: ["The requirement says historical addresses must remain queryable."],
    status: "published"
  },
  {
    id: "concept-partitioning",
    module_id: "data-engineering-concepts",
    topic: "Storage design",
    subtopic: "Partitioning",
    tags: ["partitioning", "data lake", "files"],
    difficulty: "intermediate",
    type: "scenario",
    title: "Choose a practical partition key",
    prompt: "A lake table is commonly queried by event date and has billions of rows. Which partitioning approach is usually the better starting point?",
    options: [
      { id: "a", text: "Partition by a coarse event-date unit, then measure file sizes and query pruning." },
      { id: "b", text: "Partition by a unique event ID to maximize the number of directories." },
      { id: "c", text: "Create one partition for every individual row." },
      { id: "d", text: "Partition by every column before observing query patterns." }
    ],
    answer_id: "a",
    reference_answer: "Start with a commonly filtered, reasonably coarse date partition and validate file sizes and pruning against real workloads.",
    explanation: "High-cardinality partitioning can create many small files and metadata overhead. Partition choices should follow access patterns and measured volume.",
    common_mistakes: ["Over-partitioning on unique or high-cardinality keys", "Choosing partitions without workload evidence"],
    hints: ["Balance query pruning against directory and small-file overhead."],
    status: "published"
  },
  {
    id: "design-idempotent-retry",
    module_id: "pipeline-system-design",
    topic: "Reliability",
    subtopic: "Idempotency",
    tags: ["system design", "retries", "idempotency"],
    difficulty: "intermediate",
    type: "scenario",
    title: "Make a retry safe",
    prompt: "A batch job can fail after writing some output but before recording success. Which design best supports a safe retry?",
    options: [
      { id: "a", text: "Use a stable batch identity and idempotent upsert or deduplication at the sink." },
      { id: "b", text: "Assume the scheduler can determine exactly which writes reached storage." },
      { id: "c", text: "Advance the source cursor before each write." },
      { id: "d", text: "Disable retries and ignore partial batches." }
    ],
    answer_id: "a",
    reference_answer: "Give each batch a stable identity and make sink writes idempotent, then commit progress after validation.",
    explanation: "After a partial failure, a retry may replay already-written records. Idempotent sink operations prevent replay from creating duplicates.",
    common_mistakes: ["Assuming at-least-once delivery never duplicates", "Committing progress before data durability"],
    hints: ["Assume the system cannot know whether a timed-out write completed."],
    status: "published"
  },
  {
    id: "interview-evidence-rubric",
    module_id: "ai-mock-interviews",
    topic: "Interview practice",
    subtopic: "Evaluation",
    tags: ["interviews", "rubric", "reasoning"],
    difficulty: "beginner",
    type: "scenario",
    title: "Use evidence in an interview review",
    prompt: "A conceptual interview response is partly correct but misses failure recovery. Which feedback approach is most useful?",
    options: [
      { id: "a", text: "Show a transparent rubric, identify the missing recovery concept, and provide a concrete follow-up." },
      { id: "b", text: "Return a precise-looking score without explaining how it was assigned." },
      { id: "c", text: "Mark every response correct if it uses relevant terminology." },
      { id: "d", text: "Replace the response with an answer without explaining the gap." }
    ],
    answer_id: "a",
    reference_answer: "Use explicit criteria and evidence, identify omissions, and make subjective scoring caveats clear.",
    explanation: "Transparent criteria help learners understand how to improve. AI or rubric-based conceptual feedback should not be presented as perfectly objective.",
    common_mistakes: ["Treating an unexplained score as authoritative", "Confusing keywords with sound reasoning"],
    hints: ["Feedback should make the gap and next practice step visible."],
    status: "published"
  },
  {
    id: "python-dedupe-events",
    module_id: "python-etl",
    topic: "Data transformation",
    subtopic: "Deduplication",
    tags: ["python", "etl", "deduplication"],
    difficulty: "intermediate",
    type: "coding",
    language: "python",
    title: "Keep the latest event per ID",
    prompt: "Implement `dedupe_events(records)`. Keep the record with the greatest `occurred_at` value for each `event_id`, then return records sorted by `event_id`. Inputs are valid dictionaries with ISO-8601 UTC timestamps. On timestamp ties, keep the first record encountered.",
    starter_code: "def dedupe_events(records):\n    # Return one latest record per event_id, sorted by event_id.\n    pass\n",
    input_description: "A list of dictionaries with event_id and occurred_at string fields.",
    output_description: "A list containing one complete original record per event_id, sorted by event_id.",
    public_examples: [{ input: [{ event_id: "b", occurred_at: "2025-02-01T00:00:00Z" }, { event_id: "a", occurred_at: "2025-01-01T00:00:00Z" }, { event_id: "b", occurred_at: "2025-03-01T00:00:00Z" }], expected: [{ event_id: "a", occurred_at: "2025-01-01T00:00:00Z" }, { event_id: "b", occurred_at: "2025-03-01T00:00:00Z" }] }],
    test_cases: [
      { name: "keeps latest and sorts", input: [{ event_id: "b", occurred_at: "2025-02-01T00:00:00Z" }, { event_id: "a", occurred_at: "2025-01-01T00:00:00Z" }, { event_id: "b", occurred_at: "2025-03-01T00:00:00Z" }], expected: [{ event_id: "a", occurred_at: "2025-01-01T00:00:00Z" }, { event_id: "b", occurred_at: "2025-03-01T00:00:00Z" }] },
      { name: "handles empty input", input: [], expected: [] },
      { name: "keeps first on timestamp ties", input: [{ event_id: "x", occurred_at: "2025-01-01T00:00:00Z", value: 1 }, { event_id: "x", occurred_at: "2025-01-01T00:00:00Z", value: 2 }], expected: [{ event_id: "x", occurred_at: "2025-01-01T00:00:00Z", value: 1 }] }
    ],
    reference_solution: "def dedupe_events(records):\n    latest = {}\n    for record in records:\n        event_id = record[\"event_id\"]\n        current = latest.get(event_id)\n        if current is None or record[\"occurred_at\"] > current[\"occurred_at\"]:\n            latest[event_id] = record\n    return [latest[key] for key in sorted(latest)]\n",
    explanation: "A dictionary gives one candidate per event ID. Comparing normalized UTC ISO timestamps selects the latest; using a strict greater-than comparison preserves the first record on ties. Sorting the keys makes output deterministic.",
    common_mistakes: ["Keeping the first row regardless of timestamp", "Returning dictionary values without deterministic ordering", "Mutating or partially copying records"],
    hints: ["Track the latest record by event_id.", "Compare timestamps and only replace on a strictly newer value.", "Sort the keys when constructing the result."],
    status: "published"
  },
  {
    id: "pyspark-event-counts",
    module_id: "pyspark-foundations",
    topic: "DataFrame aggregations",
    subtopic: "GroupBy",
    tags: ["pyspark", "aggregation", "groupBy"],
    difficulty: "beginner",
    type: "coding",
    language: "pyspark",
    title: "Count events by type",
    prompt: "Implement `count_by_event_type(events)`. Return a DataFrame with columns `event_type` and `count`, one row per event type, ordered by event_type ascending. Use DataFrame operations; do not collect the input to the driver.",
    starter_code: "from pyspark.sql import functions as F\n\ndef count_by_event_type(events):\n    # Return event_type and count, ordered by event_type.\n    pass\n",
    input_description: "A Spark DataFrame containing a non-null string column named event_type.",
    output_description: "A Spark DataFrame containing event_type and integer count, ordered by event_type.",
    public_examples: [{ input: [{ event_type: "view" }, { event_type: "purchase" }, { event_type: "view" }], expected: [{ event_type: "purchase", count: 1 }, { event_type: "view", count: 2 }] }],
    test_cases: [
      { name: "counts and sorts groups", input: [{ event_type: "view" }, { event_type: "purchase" }, { event_type: "view" }], expected: [{ event_type: "purchase", count: 1 }, { event_type: "view", count: 2 }] },
      { name: "single group", input: [{ event_type: "click" }], expected: [{ event_type: "click", count: 1 }] }
    ],
    reference_solution: "from pyspark.sql import functions as F\n\ndef count_by_event_type(events):\n    return events.groupBy(\"event_type\").count().orderBy(\"event_type\")\n",
    explanation: "groupBy and count build a distributed aggregation plan. orderBy makes the output ordering explicit. The operation does not collect source rows to the driver.",
    common_mistakes: ["Calling collect on the input DataFrame", "Returning a Python dictionary instead of a DataFrame", "Leaving result ordering unspecified"],
    hints: ["Use a distributed DataFrame aggregation rather than a Python loop.", "Spark DataFrame count() on a grouped frame produces the count column.", "Order the resulting frame by event_type."],
    status: "published"
  }
].map((question) => ({ ...question, created_at: new Date("2026-10-19T00:00:00.000Z"), updated_at: new Date("2026-10-19T00:00:00.000Z") }));

export type LearningQuestionFilters = {
  moduleId?: string;
  topic?: string;
  difficulty?: string;
  type?: string;
  state?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export function normalizeQuestionFilters(filters: LearningQuestionFilters) {
  return {
    moduleId: filters.moduleId?.trim() || "",
    topic: filters.topic?.trim().slice(0, 80) || "",
    difficulty: ["beginner", "intermediate", "advanced"].includes(filters.difficulty || "") ? filters.difficulty! : "",
    type: ["mcq", "conceptual", "sql", "coding", "debugging", "scenario"].includes(filters.type || "") ? filters.type! : "",
    state: ["completed", "incorrect", "bookmarked"].includes(filters.state || "") ? filters.state! : "all",
    search: filters.search?.trim().slice(0, 100) || "",
    page: Math.min(Math.max(Math.floor(Number(filters.page) || 1), 1), 100000),
    pageSize: Math.min(Math.max(Math.floor(Number(filters.pageSize) || 20), 1), 50)
  };
}

export function publicLearningQuestion(question: any) {
  const { answer_id, reference_answer, explanation, common_mistakes, reference_solution, test_cases, ...visible } = question;
  return visible;
}

export function validateLearningQuestion(question: any): string[] {
  const errors: string[] = [];
  if (!question || typeof question !== "object") return ["question must be an object"];
  if (typeof question.id !== "string" || !question.id.trim()) errors.push("id is required");
  if (typeof question.module_id !== "string" || !question.module_id.trim()) errors.push("module_id is required");
  if (typeof question.title !== "string" || !question.title.trim() || question.title.length > 160) errors.push("title must contain 1 to 160 characters");
  if (typeof question.prompt !== "string" || !question.prompt.trim() || question.prompt.length > 4000) errors.push("prompt must contain 1 to 4000 characters");
  if (!["beginner", "intermediate", "advanced"].includes(question.difficulty)) errors.push("difficulty is invalid");
  if (!["mcq", "scenario", "coding"].includes(question.type)) errors.push("question type is not supported for publication");
  if (question.type === "coding") {
    if (!["python", "pyspark"].includes(question.language)) errors.push("coding language is invalid");
    if (typeof question.starter_code !== "string" || question.starter_code.length > 32000) errors.push("starter code is invalid");
    if (typeof question.reference_solution !== "string" || !question.reference_solution.trim()) errors.push("reference solution is required");
    if (!Array.isArray(question.test_cases) || question.test_cases.length < 1 || question.test_cases.length > 100) errors.push("coding questions require 1 to 100 tests");
  } else if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) {
    errors.push("questions must have 2 to 6 answer options");
  } else {
    const ids = question.options.map((option: any) => option?.id);
    if (ids.some((id: unknown) => typeof id !== "string" || !id.trim()) || new Set(ids).size !== ids.length) errors.push("answer option IDs must be unique non-empty strings");
    if (question.options.some((option: any) => typeof option?.text !== "string" || !option.text.trim() || option.text.length > 500)) errors.push("answer option text is invalid");
    if (!ids.includes(question.answer_id)) errors.push("answer_id must match an available option");
  }
  if (question.type !== "coding" && (typeof question.reference_answer !== "string" || !question.reference_answer.trim())) errors.push("reference_answer is required");
  if (typeof question.explanation !== "string" || !question.explanation.trim()) errors.push("explanation is required");
  if (!Array.isArray(question.hints) || question.hints.some((hint: unknown) => typeof hint !== "string" || hint.length > 500)) errors.push("hints are invalid");
  return errors;
}

function escapedRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function userQuestionState(userId: string, questionIds: string[]) {
  if (!questionIds.length) return { bookmarks: new Set<string>(), completed: new Set<string>() };
  const [bookmarks, progress] = await Promise.all([
    mongoCollection("learning_bookmarks").find({ user_id: userId, question_id: { $in: questionIds } }, { projection: { question_id: 1 } }).toArray(),
    mongoCollection("learning_question_progress").find({ user_id: userId, question_id: { $in: questionIds }, completed: true }, { projection: { question_id: 1 } }).toArray()
  ]);
  return {
    bookmarks: new Set(bookmarks.map((item) => String(item.question_id))),
    completed: new Set(progress.map((item) => String(item.question_id)))
  };
}

export async function seedLearningQuestions(): Promise<void> {
  const invalid = seedQuestions.flatMap((question) => validateLearningQuestion(question).map((error) => `${question.id}: ${error}`));
  if (invalid.length) throw new Error(`Learning question seed validation failed: ${invalid.join("; ")}`);
  const questions = mongoCollection("learning_questions");
  await questions.bulkWrite(seedQuestions.map((question) => ({
    updateOne: {
      filter: { _id: question.id },
      update: { $setOnInsert: { ...question, _id: question.id } },
      upsert: true
    }
  })), { ordered: false });
}

export async function listLearningQuestions(userId: string, input: LearningQuestionFilters) {
  const filters = normalizeQuestionFilters(input);
  const query: Record<string, any> = { status: "published" };
  if (filters.moduleId) query.module_id = filters.moduleId;
  if (filters.topic) query.topic = filters.topic;
  if (filters.difficulty) query.difficulty = filters.difficulty;
  if (filters.type) query.type = filters.type;
  if (filters.search) {
    const regex = new RegExp(escapedRegex(filters.search), "i");
    query.$or = [{ title: regex }, { prompt: regex }, { topic: regex }, { tags: regex }];
  }

  if (filters.state === "completed") {
    const rows = await mongoCollection("learning_question_progress").find({ user_id: userId, completed: true }, { projection: { question_id: 1 } }).toArray();
    query._id = { $in: rows.map((row) => String(row.question_id)) };
  } else if (filters.state === "bookmarked") {
    const rows = await mongoCollection("learning_bookmarks").find({ user_id: userId }, { projection: { question_id: 1 } }).toArray();
    query._id = { $in: rows.map((row) => String(row.question_id)) };
  } else if (filters.state === "incorrect") {
    const rows = await mongoCollection("learning_attempts").find({ user_id: userId }).sort({ created_at: -1 }).limit(5000).toArray();
    const latest = new Map<string, boolean>();
    for (const row of rows) if (!latest.has(String(row.question_id))) latest.set(String(row.question_id), Boolean(row.correct));
    query._id = { $in: [...latest].filter(([, correct]) => !correct).map(([id]) => id) };
  }

  const collection = mongoCollection("learning_questions");
  const [total, questions] = await Promise.all([
    collection.countDocuments(query),
    collection.find(query, { projection: { answer_id: 0, reference_answer: 0, explanation: 0, common_mistakes: 0 } })
      .sort({ module_id: 1, topic: 1, created_at: -1 })
      .skip((filters.page - 1) * filters.pageSize)
      .limit(filters.pageSize)
      .toArray()
  ]);
  const ids = questions.map((question) => String(question._id));
  const state = await userQuestionState(userId, ids);
  return {
    items: questions.map((question) => ({
      ...question,
      id: String(question._id),
      bookmarked: state.bookmarks.has(String(question._id)),
      completed: state.completed.has(String(question._id))
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    total,
    totalPages: Math.ceil(total / filters.pageSize)
  };
}

export async function getLearningQuestion(questionId: string, userId: string) {
  const question = await mongoCollection("learning_questions").findOne({ _id: questionId, status: "published" });
  if (!question) return null;
  const state = await userQuestionState(userId, [questionId]);
  return {
    ...publicLearningQuestion(question),
    id: questionId,
    bookmarked: state.bookmarks.has(questionId),
    completed: state.completed.has(questionId)
  };
}

export async function submitLearningAnswer(userId: string, questionId: string, optionId: string) {
  const question = await mongoCollection("learning_questions").findOne({ _id: questionId, status: "published" });
  if (!question) return { status: "not_found" as const };
  if (question.type !== "mcq" && question.type !== "scenario") return { status: "unsupported" as const };
  if (!(question.options || []).some((option: any) => option.id === optionId)) return { status: "invalid_answer" as const };

  const correct = question.answer_id === optionId;
  const attemptId = crypto.randomUUID();
  const createdAt = new Date();
  await mongoCollection("learning_attempts").insertOne({
    _id: attemptId,
    id: attemptId,
    user_id: userId,
    question_id: questionId,
    selected_option_id: optionId,
    correct,
    created_at: createdAt
  });
  if (correct) {
    await mongoCollection("learning_question_progress").updateOne(
      { user_id: userId, question_id: questionId },
      { $set: { completed: true, completion_source: "correct_answer", updated_at: createdAt }, $setOnInsert: { created_at: createdAt } },
      { upsert: true }
    );
  }
  return {
    status: "ok" as const,
    attemptId,
    correct,
    explanation: question.explanation,
    referenceAnswer: question.reference_answer,
    commonMistakes: question.common_mistakes || []
  };
}

export async function submitLearningCode(userId: string, questionId: string, code: string) {
  const question = await mongoCollection("learning_questions").findOne({ _id: questionId, status: "published", type: "coding" });
  if (!question) return { status: "not_found" as const };
  const language = question.language as RunnerLanguage;
  const result = await executeOnRunner({ language, taskId: questionId, code, testCases: question.test_cases || [] });
  if (result.status === "unavailable") return { status: "unavailable" as const, message: result.message };
  if (result.status === "invalid") return { status: "invalid" as const, message: result.message };
  if (result.status === "error") return { status: "runner_error" as const, message: result.message };
  const correct = result.correct;
  const attemptId = crypto.randomUUID();
  const createdAt = new Date();
  await mongoCollection("learning_attempts").insertOne({
    _id: attemptId,
    id: attemptId,
    user_id: userId,
    question_id: questionId,
    language,
    code,
    correct,
    status: result.status,
    execution_ms: result.executionMs,
    tests: result.tests,
    created_at: createdAt
  });
  const staleAttempts = await mongoCollection("learning_attempts").find({ user_id: userId, question_id: questionId })
    .sort({ created_at: -1 }).skip(50).project({ _id: 1 }).toArray();
  if (staleAttempts.length) await mongoCollection("learning_attempts").deleteMany({ _id: { $in: staleAttempts.map((attempt) => attempt._id) } });
  if (correct) {
    await mongoCollection("learning_question_progress").updateOne(
      { user_id: userId, question_id: questionId },
      { $set: { completed: true, completion_source: "runner_tests", updated_at: createdAt }, $setOnInsert: { created_at: createdAt } },
      { upsert: true }
    );
  }
  return { status: "ok" as const, attemptId, correct, executionMs: result.executionMs, tests: result.tests };
}

export async function learningRunnerStatus() {
  const [python, pyspark] = await Promise.all([runnerHealth("python"), runnerHealth("pyspark")]);
  return { python, pyspark };
}

export async function setLearningBookmark(userId: string, questionId: string, marked: boolean) {
  const questionExists = await mongoCollection("learning_questions").findOne({ _id: questionId, status: "published" }, { projection: { _id: 1 } });
  if (!questionExists) return false;
  const bookmarks = mongoCollection("learning_bookmarks");
  if (!marked) {
    await bookmarks.deleteOne({ user_id: userId, question_id: questionId });
  } else {
    await bookmarks.updateOne(
      { user_id: userId, question_id: questionId },
      { $setOnInsert: { user_id: userId, question_id: questionId, created_at: new Date() } },
      { upsert: true }
    );
  }
  return true;
}

export async function listLearningAttempts(userId: string, questionId?: string, limit = 50) {
  const query: Record<string, string> = { user_id: userId };
  if (questionId) query.question_id = questionId;
  return mongoCollection("learning_attempts").find(query).sort({ created_at: -1 }).limit(Math.min(Math.max(limit, 1), 100)).toArray();
}

export async function listLearningBookmarks(userId: string) {
  const rows = await mongoCollection("learning_bookmarks").find({ user_id: userId }).sort({ created_at: -1 }).limit(500).toArray();
  const ids = rows.map((row) => String(row.question_id));
  if (!ids.length) return [];
  const questions = await mongoCollection("learning_questions").find(
    { _id: { $in: ids }, status: "published" },
    { projection: { answer_id: 0, reference_answer: 0, explanation: 0, common_mistakes: 0 } }
  ).toArray();
  const byId = new Map(questions.map((question) => [String(question._id), question]));
  return ids.flatMap((id) => {
    const question = byId.get(id);
    return question ? [{ ...question, id, bookmarked: true }] : [];
  });
}

export async function topicProgress(userId: string) {
  const [questions, completed] = await Promise.all([
    mongoCollection("learning_questions").find({ status: "published" }, { projection: { module_id: 1, topic: 1 } }).toArray(),
    mongoCollection("learning_question_progress").find({ user_id: userId, completed: true }, { projection: { question_id: 1 } }).toArray()
  ]);
  const completeIds = new Set(completed.map((row) => String(row.question_id)));
  const groups = new Map<string, { module_id: string; topic: string; total: number; completed: number }>();
  for (const question of questions) {
    const moduleId = String(question.module_id);
    const topic = String(question.topic);
    const key = `${moduleId}:${topic}`;
    const group = groups.get(key) || { module_id: moduleId, topic, total: 0, completed: 0 };
    group.total += 1;
    if (completeIds.has(String(question._id))) group.completed += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.module_id.localeCompare(right.module_id) || left.topic.localeCompare(right.topic));
}

export async function listLearningTopics(moduleId: string) {
  const topics = await mongoCollection("learning_questions").distinct("topic", { module_id: moduleId, status: "published" });
  return topics.filter((topic): topic is string => typeof topic === "string").sort((left, right) => left.localeCompare(right));
}

export async function recentLearningQuestion(userId: string) {
  return mongoCollection("learning_attempts").findOne({ user_id: userId }, { sort: { created_at: -1 } });
}