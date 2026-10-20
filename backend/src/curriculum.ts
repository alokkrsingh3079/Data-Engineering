import { mongoCollection } from "./mongo.js";
import { listWorkspaces } from "./workspaces.js";

const modules = [
  {
    _id: "python-etl",
    id: "python-etl",
    order: 1,
    title: "Python for Data Engineering",
    category: "Python",
    description: "Transform event records safely and make batch jobs repeatable.",
    href: "/learn/python-etl",
    runner: "unavailable",
    lessons: [{
      id: "python-normalize-events",
      title: "Normalize an event batch",
      objective: "Design a predictable transformation that handles optional fields and malformed records.",
      content: [
        "Treat incoming JSON as untrusted data. Validate required keys and types at the boundary, normalize timestamps to one timezone, and keep rejected records separate from valid output.",
        "A useful transformation is deterministic: the same input produces the same output, and it does not mutate the caller's records. In production, record a reason for every rejected row so data loss is visible."
      ],
      example: "from datetime import datetime, timezone\n\ndef normalize_event(raw):\n    if not isinstance(raw.get(\"event_id\"), str):\n        return None\n    occurred_at = datetime.fromisoformat(raw[\"occurred_at\"].replace(\"Z\", \"+00:00\"))\n    return {\n        \"event_id\": raw[\"event_id\"],\n        \"occurred_at\": occurred_at.astimezone(timezone.utc).isoformat(),\n        \"payload\": raw.get(\"payload\", {}),\n    }"
    }]
  },
  {
    _id: "pyspark-foundations",
    id: "pyspark-foundations",
    order: 2,
    title: "PySpark and Spark",
    category: "Spark",
    description: "Reason about DataFrame transformations, shuffles, and execution.",
    href: "/pyspark",
    runner: "unavailable",
    lessons: [{
      id: "spark-transformations-actions",
      title: "Transformations are lazy",
      objective: "Explain when a Spark plan runs and why a wide transformation can be expensive.",
      content: [
        "Operations such as select and filter build a logical plan; they do not normally scan and materialize the entire result immediately. An action such as count or write triggers execution.",
        "A groupBy commonly requires a shuffle because rows with the same key must be brought together. Inspect the execution plan and reduce data before a shuffle when the semantics allow it."
      ],
      example: "clean = (events\n    .filter(events.event_id.isNotNull())\n    .select(\"event_id\", \"event_type\", \"occurred_at\"))\n\ncounts = clean.groupBy(\"event_type\").count()\ncounts.explain()  # inspect plan; this does not execute the count"
    }]
  },
  {
    _id: "azure-data-factory",
    id: "azure-data-factory",
    order: 3,
    title: "Azure Data Factory",
    category: "Azure",
    description: "Build incremental pipelines with explicit watermarks and recovery.",
    href: "/learn/azure-data-factory",
    runner: "unavailable",
    lessons: [{
      id: "adf-watermark-pattern",
      title: "Advance a watermark safely",
      objective: "Order pipeline steps so retries do not skip source records.",
      content: [
        "Read the previous committed watermark, copy the bounded source range into a durable sink, validate the write, and only then persist the new watermark.",
        "If a run fails before the watermark update, retrying may copy records again. Make the sink operation idempotent with a stable business key or deduplication rule. A linked service or pipeline diagram alone does not prove the integration is deployed."
      ],
      example: "previous_watermark = read_control_record()\nsource_batch = read_source(\n    start_exclusive=previous_watermark,\n    end_inclusive=run_cutoff,\n)\nwrite_idempotently(source_batch)\nvalidate_sink(source_batch)\ncommit_watermark(run_cutoff)"
    }]
  },
  {
    _id: "databricks-delta",
    id: "databricks-delta",
    order: 4,
    title: "Databricks and Delta Lake",
    category: "Databricks",
    description: "Understand merge keys, replay safety, and schema evolution.",
    href: "/learn/databricks-delta",
    runner: "unavailable",
    lessons: [{
      id: "delta-idempotent-merge",
      title: "Make a Delta merge replay-safe",
      objective: "Identify the conditions needed for a deterministic upsert.",
      content: [
        "A MERGE is only as reliable as its match key. Deduplicate the incoming batch by that key first, define deterministic handling for ties, and verify that the source cannot contain multiple rows matching one target row.",
        "Schema evolution should be an explicit compatibility decision. Validate required columns and types before writing, and test a replay of the same batch to confirm it does not create duplicates."
      ],
      example: "source_deduped = source.dropDuplicates([\"event_id\"])\n\n(target.alias(\"t\")\n .merge(source_deduped.alias(\"s\"), \"t.event_id = s.event_id\")\n .whenMatchedUpdateAll()\n .whenNotMatchedInsertAll()\n .execute())"
    }]
  },
  {
    _id: "etl-data-quality",
    id: "etl-data-quality",
    order: 5,
    title: "ETL Testing and Warehousing",
    category: "ETL & Warehousing",
    description: "Reconcile data movement and catch quality defects before release.",
    href: "/learn/etl-data-quality",
    runner: "unavailable",
    lessons: [{
      id: "etl-reconciliation",
      title: "Reconcile a batch load",
      objective: "Build checks that detect missing, duplicated, and altered records.",
      content: [
        "A row-count comparison is a useful first signal, not proof of correctness. Compare counts at the same batch boundary, then validate key uniqueness, null constraints, and important aggregates.",
        "For incremental loads, reconcile only the intended watermark range and account for late-arriving data. Store check results with the batch identifier so failures can be investigated and safely rerun."
      ],
      example: "SELECT batch_id, COUNT(*) AS rows_loaded,\n       COUNT(DISTINCT source_key) AS unique_keys,\n       COUNT(*) FILTER (WHERE required_value IS NULL) AS missing_values\nFROM target_events\nWHERE batch_id = :batch_id\nGROUP BY batch_id;"
    }]
  },
  {
    _id: "pipeline-system-design",
    id: "pipeline-system-design",
    order: 6,
    title: "Data Engineering System Design",
    category: "System Design",
    description: "Design ingestion systems around failure, replay, and observability.",
    href: "/learn/pipeline-system-design",
    runner: "unavailable",
    lessons: [{
      id: "design-reliable-ingestion",
      title: "Design for replay, not just the happy path",
      objective: "Explain how a batch pipeline recovers from partial failure without silent loss.",
      content: [
        "Define the source cursor, durable landing boundary, idempotency key, and commit point before choosing orchestration tools. A retry must have a clear meaning when the previous run wrote only part of its output.",
        "Track freshness, volume, schema changes, and failure counts. Alert on user-visible service objectives rather than only on whether a scheduler ran. Describe trade-offs explicitly: latency, cost, consistency, and recovery time."
      ]
    }]
  },
  {
    _id: "sql-interview-lab",
    id: "sql-interview-lab",
    order: 7,
    title: "SQL Interview Lab",
    category: "SQL",
    description: "Practice against isolated PostgreSQL workspaces with verified result checking.",
    href: "/sql",
    runner: "available",
    lessons: [{
      id: "sql-lab-start",
      title: "Start a SQL practice session",
      objective: "Use the existing SQL editor and question bank for query-based exercises.",
      content: ["SQL question counts and workspace data come from the current practice system. The learning dashboard links to that existing SQL editor rather than creating a second SQL question bank."]
    }]
  },
  {
    _id: "data-engineering-concepts",
    id: "data-engineering-concepts",
    order: 8,
    title: "Data Engineering Concepts",
    category: "Concepts",
    description: "Explore storage, quality, reliability, and ingestion trade-offs.",
    href: "/learn/data-engineering-concepts",
    runner: "unavailable",
    lessons: [{
      id: "concepts-storage-layout",
      title: "Choose storage layouts from workload evidence",
      objective: "Balance partition pruning, file counts, and query access patterns.",
      content: ["Storage layout should reflect measured query patterns and data volume. Partitioning by a unique key can create excessive directories and small files; begin with a coarse, common filter and validate it against real workloads."]
    }]
  },
  {
    _id: "ai-mock-interviews",
    id: "ai-mock-interviews",
    order: 9,
    title: "AI Mock Interviews",
    category: "Interview",
    description: "Practice SQL interview questions and review deterministic result checks.",
    href: "/interview",
    runner: "available",
    lessons: [{
      id: "interview-review",
      title: "Review a SQL interview session",
      objective: "Use question results as evidence and treat automated feedback carefully.",
      content: ["The current interview mode evaluates SQL result sets against verified expected output. It does not yet provide AI-generated rubric scoring or non-SQL interview tracks."]
    }]
  }
];

const additionalLessons: Record<string, any[]> = {
  "python-etl": [
    { id: "python-collections", title: "Choose the right collection", objective: "Select Python containers from lookup and ordering requirements.", content: ["Use a list when sequence and duplicates matter, a set for membership, and a dictionary for key-based lookup. A set or dictionary gives average constant-time membership, while preserving a list can be important for deterministic output.", "Avoid repeatedly scanning a list for keys when processing large batches. Build an index once, and document the rule used when duplicate keys appear."] },
    { id: "python-json-csv", title: "Read CSV and JSON at the boundary", objective: "Handle serialized source data without silently changing types.", content: ["CSV fields arrive as text. Parse dates and numeric fields explicitly, validate required columns, and keep a reject record when conversion fails.", "For JSON, distinguish a missing key from an explicit null and validate nested structures before transformation. Keep the raw source separately when audit and replay requirements justify it."] },
    { id: "python-exceptions", title: "Make transformation failures observable", objective: "Separate expected bad records from pipeline failures.", content: ["Catch narrow conversion or validation exceptions at the record boundary and attach a rejection reason. Let infrastructure and programming failures fail the task rather than silently turning them into dropped data.", "Track accepted and rejected counts per batch, and assert that they reconcile with the input count."] },
    { id: "python-batch-idempotency", title: "Design a replayable Python batch", objective: "Make retries deterministic and safe at the destination.", content: ["Give each batch a stable identity, transform without mutating inputs, and write with an idempotent key. Advance checkpoints only after destination validation succeeds.", "Unit tests should cover empty input, duplicate keys, invalid values, and replay of the same batch."] }
  ],
  "pyspark-foundations": [
    { id: "spark-dataframe-schema", title: "Define a schema at ingestion", objective: "Avoid unstable type inference in recurring data pipelines.", content: ["Explicit schemas make expected types and nullability reviewable. Inference can vary with sampled input and can misread fields when early files do not represent the full dataset.", "Validate required columns and data types before transformations, and route malformed records through a deliberate corrupt-record policy."] },
    { id: "spark-joins-skew", title: "Diagnose join skew", objective: "Recognize when a small number of keys dominate a distributed join.", content: ["A skewed key sends disproportionate work to a few partitions, creating straggler tasks. Inspect key frequencies and the physical plan before choosing a mitigation.", "Filtering, pre-aggregation, salting, or broadcasting can help in different cases. Broadcasting is appropriate only when the build side fits safely in executor memory."] },
    { id: "spark-window-functions", title: "Use a window for row-level ranking", objective: "Choose a window function when results must retain detail rows.", content: ["A groupBy collapses rows to one row per key. A window computes ranks or running values while preserving each input row.", "Window partitions and ordering must be explicit. Add a deterministic tie-breaker when downstream behavior depends on stable row order."] },
    { id: "spark-partitions-files", title: "Balance partitions and file sizes", objective: "Avoid both excessive task overhead and oversized output partitions.", content: ["Too few partitions can underuse parallelism and create large output files; too many can create task and small-file overhead. Measure representative batch size and inspect output file distributions.", "Use repartition when redistribution is needed; coalesce can reduce partition count with less movement when appropriate. Neither is a universal tuning fix."] }
  ],
  "azure-data-factory": [
    { id: "adf-linked-services", title: "Separate connections from datasets", objective: "Explain the roles of linked services, datasets, and pipeline activities.", content: ["A linked service describes a connection to a data store or compute service. A dataset describes the data shape or location used by an activity. The activity defines the operation in a pipeline.", "Keep credentials in a managed secret mechanism and use managed identities where supported. Never place credentials in pipeline parameters or committed JSON."] },
    { id: "adf-retry-idempotency", title: "Make pipeline retries safe", objective: "Pair retry policies with idempotent destination behavior.", content: ["Retries can repeat work after a timeout whose commit state is unknown. Use stable batch identifiers, idempotent upserts, or staging-and-swap patterns so repetition does not duplicate output.", "Choose retry count and interval from the failure mode and service limits, and alert when retry budgets are exhausted."] },
    { id: "adls-layout", title: "Lay out ADLS data for access patterns", objective: "Connect file organization to downstream query patterns.", content: ["Use clear data zones, consistent formats, and partition keys chosen from common filters and cardinality. Avoid creating one tiny directory or file per entity.", "Apply least-privilege identity access and make retention, encryption, and lifecycle policy explicit for each data zone."] }
  ],
  "databricks-delta": [
    { id: "delta-medallion", title: "Separate raw, validated, and serving layers", objective: "Use medallion layers to make quality and transformation boundaries visible.", content: ["Bronze retains source-oriented data and ingestion metadata. Silver applies validation, deduplication, and conformance. Gold presents business-ready aggregates or dimensions.", "The names are a design pattern, not a guarantee of quality. Define contracts, ownership, and replay behavior at each transition."] },
    { id: "delta-schema-evolution", title: "Treat schema evolution as a contract change", objective: "Make additive or incompatible schema changes deliberate.", content: ["Schema evolution can help with compatible additive changes, but it should not silently accept misspelled or semantically incompatible columns.", "Validate expected fields and types, review downstream readers, and test both old and new data before enabling an evolution policy."] },
    { id: "delta-incremental", title: "Make incremental Delta processing observable", objective: "Track exactly which input range a Delta job committed.", content: ["Persist a source cursor or batch identifier with each successful load, and make writes idempotent. Verify the Delta transaction committed before advancing external checkpoints.", "Monitor input and output counts, rejected records, freshness, and schema changes per batch."] }
  ],
  "etl-data-quality": [
    { id: "etl-source-target", title: "Compare source and target at one boundary", objective: "Prevent misleading reconciliation across different batch windows.", content: ["Select the same batch ID or watermark range in both systems before comparing counts and aggregates. Include late-arrival and reprocessing rules in the definition.", "A mismatch should preserve enough batch metadata to trace missing, duplicate, or changed records."] },
    { id: "etl-scd-type-one", title: "Distinguish Type 1 and Type 2 changes", objective: "Choose whether a dimension update preserves history.", content: ["Type 1 overwrites an attribute when history is not required. Type 2 inserts a new version and retains prior values with validity boundaries when historical reporting is required.", "Document the business key, current-row indicator, effective dates, and late-arriving correction behavior."] },
    { id: "etl-data-contracts", title: "Turn data quality into an explicit contract", objective: "Define measurable requirements for a delivered dataset.", content: ["A contract can specify schema, nullability, uniqueness, accepted value ranges, freshness, and ownership. Checks should run at a defined boundary and report failures with batch context.", "Choose whether a failed check blocks publication, quarantines records, or raises an alert based on the impact and recovery design."] }
  ],
  "data-engineering-concepts": [
    { id: "concept-batch-stream", title: "Choose batch or streaming from latency needs", objective: "Compare latency, complexity, and recovery requirements.", content: ["Batch processing groups work into bounded runs and is often simpler to backfill and reconcile. Streaming can reduce latency but introduces event-time, state, watermark, and late-data considerations.", "Choose from the service-level need and operational capacity, not from a tool preference. Many systems combine streaming ingestion with batch correction."] },
    { id: "concept-parquet", title: "Choose a columnar file format deliberately", objective: "Explain why analytical workloads often use Parquet.", content: ["Columnar formats can read only required columns and encode similar values efficiently. They are useful for analytical scans but do not automatically solve partitioning or small-file problems.", "Validate schema compatibility and compression choices with representative workload measurements."] },
    { id: "concept-data-quality", title: "Observe freshness and completeness", objective: "Monitor data outcomes rather than only scheduler health.", content: ["A pipeline can report success while producing stale or incomplete data. Track freshness, volume, schema changes, rejected rows, and key quality checks.", "Tie alerts to consumer-facing objectives, and provide batch identifiers and run links for investigation."] }
  ],
  "pipeline-system-design": [
    { id: "design-batch-stream", title: "Specify a pipeline service objective", objective: "Make latency and recovery expectations testable.", content: ["Define freshness target, tolerated data loss, recovery time, expected volume, and replay window before selecting tools.", "An architecture should explain how partial writes, duplicates, late data, schema changes, and downstream outages are handled."] },
    { id: "design-observability", title: "Design observability around data outcomes", objective: "Choose signals that reveal silent pipeline failures.", content: ["Capture run status, source and target counts, freshness, schema versions, reject counts, and key business aggregates.", "Attach stable run and batch identifiers to metrics and logs. Avoid logging credentials or full sensitive row payloads."] },
    { id: "design-backfill", title: "Plan backfills before an incident", objective: "Make historical reprocessing bounded and safe.", content: ["Define a replay window, deterministic transformations, idempotent writes, and a way to compare corrected output before publication.", "Backfills compete for compute and can affect current loads; schedule and throttle them under explicit resource limits."] }
  ],
  "ai-mock-interviews": [
    { id: "interview-rubric", title: "Read rubric-based feedback carefully", objective: "Separate evidence-based scoring from subjective interviewer judgment.", content: ["A rubric should name criteria and cite specific evidence in the response. Correctness, completeness, reasoning, and trade-offs are different dimensions.", "AI-generated feedback can be incomplete or wrong. Use the explanation as practice guidance, not as an authoritative hiring decision."] },
    { id: "interview-technical-reasoning", title: "Explain trade-offs, not just tool names", objective: "Communicate operational reasoning in a technical interview.", content: ["State assumptions, identify failure modes, and compare latency, reliability, cost, and complexity. Tie the choice to the stated workload.", "A concise answer with a clear recovery plan is more useful than listing every service you have used."] }
  ]
};

for (const module of modules) module.lessons.push(...(additionalLessons[module.id] || []));

export async function seedCurriculum(): Promise<void> {
  const collection = mongoCollection("learning_modules");
  await collection.bulkWrite(modules.map((module) => {
    const { _id, ...fields } = module;
    return {
      updateOne: {
        filter: { _id },
        update: { $set: fields, $setOnInsert: { _id } },
        upsert: true
      }
    };
  }), { ordered: false });
}

export async function getLearningStudio(userId: string) {
  const [workspaces, storedModules, progress, questionCounts, questionRows, recentAttempt] = await Promise.all([
    listWorkspaces(userId, false),
    mongoCollection("learning_modules").find().sort({ order: 1 }).toArray(),
    mongoCollection("learning_progress").find({ user_id: userId }).toArray(),
    mongoCollection("learning_questions").aggregate([{ $match: { status: "published", $or: [{ owner_user_id: { $exists: false } }, { owner_user_id: null }, { owner_user_id: userId }] } }, { $group: { _id: "$module_id", count: { $sum: 1 } } }]).toArray(),
    mongoCollection("learning_question_progress").find({ user_id: userId, completed: true }, { projection: { question_id: 1 } }).toArray(),
    mongoCollection("learning_attempts").findOne({ user_id: userId }, { sort: { created_at: -1 }, projection: { question_id: 1 } })
  ]);
  const workspaceIds = workspaces.map((workspace: any) => String(workspace.id || workspace._id));
  const sqlQuestions = workspaceIds.length
    ? await mongoCollection("challenges").find({ database_id: { $in: workspaceIds } }, { projection: { id: 1 } }).toArray()
    : [];
  const completed = new Set(progress.filter((item) => item.completed).map((item) => String(item.lesson_id)));
  const counts = new Map(questionCounts.map((row) => [String(row._id), Number(row.count)]));
  const completedQuestionIds = new Set(questionRows.map((item) => String(item.question_id)));
  const completedModules = new Map<string, number>();
  const sqlQuestionIds = sqlQuestions.map((question: any) => String(question.id));
  const recentId = String(recentAttempt?.question_id || "");
  const [completedQuestions, completedSql, recentQuestion] = await Promise.all([
    completedQuestionIds.size
      ? mongoCollection("learning_questions").find({ _id: { $in: [...completedQuestionIds] }, $or: [{ owner_user_id: { $exists: false } }, { owner_user_id: null }, { owner_user_id: userId }] }, { projection: { module_id: 1 } }).toArray()
      : Promise.resolve([]),
    sqlQuestionIds.length
      ? mongoCollection("attempts").distinct("challenge_id", { session_id: userId, challenge_id: { $in: sqlQuestionIds }, correct: true })
      : Promise.resolve([]),
    recentId
      ? mongoCollection("learning_questions").findOne({ _id: recentId, $or: [{ owner_user_id: { $exists: false } }, { owner_user_id: null }, { owner_user_id: userId }] }, { projection: { module_id: 1 } })
      : Promise.resolve(null)
  ]);
  if (completedQuestions.length) {
    for (const question of completedQuestions) completedModules.set(String(question.module_id), (completedModules.get(String(question.module_id)) || 0) + 1);
  }
  return storedModules.map((module) => ({
    ...module,
    questionCount: module.id === "sql-interview-lab" ? sqlQuestionIds.length : counts.get(String(module.id)) || 0,
    completedQuestions: module.id === "sql-interview-lab" ? completedSql.length : completedModules.get(String(module.id)) || 0,
    continueQuestionId: recentQuestion?.module_id === module.id ? recentId : null,
    lessons: (module.lessons || []).map((lesson: any) => ({ ...lesson, completed: completed.has(String(lesson.id)) }))
  }));
}

export async function setLessonCompletion(userId: string, lessonId: string, completed: boolean): Promise<boolean> {
  const module = await mongoCollection("learning_modules").findOne({ "lessons.id": lessonId }, { projection: { _id: 1 } });
  if (!module) return false;
  const progress = mongoCollection("learning_progress");
  if (!completed) {
    await progress.deleteOne({ user_id: userId, lesson_id: lessonId });
    return true;
  }
  await progress.updateOne(
    { user_id: userId, lesson_id: lessonId },
    { $set: { completed: true, updated_at: new Date() }, $setOnInsert: { user_id: userId, lesson_id: lessonId, created_at: new Date() } },
    { upsert: true }
  );
  return true;
}