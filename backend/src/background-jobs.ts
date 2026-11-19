import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

export type BackgroundJob = {
  type: "dataset-question-generation" | "sql-learning-test-generation";
  jobId: string;
  userId: string;
};

const sqs = new SQSClient({});

export async function enqueueBackgroundJob(job: BackgroundJob, runLocally: () => Promise<void>): Promise<void> {
  const queueUrl = process.env.BACKGROUND_JOBS_QUEUE_URL;
  if (!queueUrl) {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      throw new Error("BACKGROUND_JOBS_QUEUE_URL must be configured for Lambda");
    }
    void runLocally().catch(error => {
      console.error("[Background job] Local execution failed:", error);
    });
    return;
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(job)
  }));
}
