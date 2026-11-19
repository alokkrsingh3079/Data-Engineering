import { loadLambdaSecrets } from "./lambda-secrets.js";
import type { BackgroundJob } from "./background-jobs.js";

type SqsEvent = { Records: Array<{ body: string }> };

export async function handler(event: SqsEvent): Promise<void> {
  await loadLambdaSecrets();
  const { initializeRuntime, processBackgroundJob } = await import("./server.js");
  await initializeRuntime();

  for (const record of event.Records) {
    const job = JSON.parse(record.body) as BackgroundJob;
    await processBackgroundJob(job);
  }
}

export async function deadLetterHandler(event: SqsEvent): Promise<void> {
  await loadLambdaSecrets();
  const { initializeRuntime } = await import("./server.js");
  const { mongoCollection } = await import("./mongo.js");
  await initializeRuntime();

  for (const record of event.Records) {
    let job: unknown;
    try {
      job = JSON.parse(record.body);
    } catch (error) {
      console.error("[Background job] Dead-letter message is invalid JSON:", error);
      continue;
    }
    if (!job || typeof job !== "object" || !("type" in job) || !("jobId" in job) || !("userId" in job)) {
      console.error("[Background job] Dead-letter message is missing required fields");
      continue;
    }

    const message = job as BackgroundJob;
    if (!["dataset-question-generation", "sql-learning-test-generation"].includes(message.type) ||
        typeof message.jobId !== "string" || typeof message.userId !== "string") {
      console.error("[Background job] Dead-letter message has unsupported fields");
      continue;
    }

    const collection = message.type === "dataset-question-generation"
      ? "question_generation_jobs"
      : "sql_learning_test_generation_jobs";
    await mongoCollection(collection).updateOne(
      { _id: message.jobId, user_id: message.userId, status: "running" },
      { $set: { status: "failed", stage: "failed", error: "Background processing failed repeatedly. Retry the request.", updated_at: new Date() } }
    );
  }
}
