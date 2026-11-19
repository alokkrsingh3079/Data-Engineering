import test from "node:test";
import assert from "node:assert/strict";
import { enqueueBackgroundJob } from "../src/background-jobs.ts";

test("local background work remains fire-and-forget when no SQS queue is configured", async () => {
  const queueUrl = process.env.BACKGROUND_JOBS_QUEUE_URL;
  const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  delete process.env.BACKGROUND_JOBS_QUEUE_URL;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  try {
    let started = false;
    await enqueueBackgroundJob(
      { type: "sql-learning-test-generation", jobId: "job", userId: "user" },
      async () => { started = true; }
    );
    assert.equal(started, true);
  } finally {
    if (queueUrl === undefined) delete process.env.BACKGROUND_JOBS_QUEUE_URL;
    else process.env.BACKGROUND_JOBS_QUEUE_URL = queueUrl;
    if (lambdaName === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = lambdaName;
  }
});

test("Lambda refuses to start jobs when its durable queue is missing", async () => {
  const queueUrl = process.env.BACKGROUND_JOBS_QUEUE_URL;
  const lambdaName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  delete process.env.BACKGROUND_JOBS_QUEUE_URL;
  process.env.AWS_LAMBDA_FUNCTION_NAME = "test-function";
  try {
    let started = false;
    await assert.rejects(
      enqueueBackgroundJob(
        { type: "sql-learning-test-generation", jobId: "job", userId: "user" },
        async () => { started = true; }
      ),
      /BACKGROUND_JOBS_QUEUE_URL must be configured/
    );
    assert.equal(started, false);
  } finally {
    if (queueUrl === undefined) delete process.env.BACKGROUND_JOBS_QUEUE_URL;
    else process.env.BACKGROUND_JOBS_QUEUE_URL = queueUrl;
    if (lambdaName === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = lambdaName;
  }
});
