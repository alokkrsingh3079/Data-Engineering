import { mongoCollection } from "./mongo.js";

const modules = [
  {
    _id: "python-etl",
    id: "python-etl",
    order: 1,
    title: "Python for Data Engineering",
    category: "Python",
    description: "Transform event records safely and make batch jobs repeatable.",
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
  }
];

export async function seedCurriculum(): Promise<void> {
  const collection = mongoCollection("learning_modules");
  await collection.bulkWrite(modules.map((module) => ({
    updateOne: {
      filter: { _id: module._id },
      update: { $setOnInsert: module },
      upsert: true
    }
  })), { ordered: false });
}

export async function getLearningStudio(userId: string) {
  const [storedModules, progress] = await Promise.all([
    mongoCollection("learning_modules").find().sort({ order: 1 }).toArray(),
    mongoCollection("learning_progress").find({ user_id: userId }).toArray()
  ]);
  const completed = new Set(progress.filter((item) => item.completed).map((item) => String(item.lesson_id)));
  return storedModules.map((module) => ({
    ...module,
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