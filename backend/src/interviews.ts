import crypto from "node:crypto";
import { mongoCollection } from "./mongo.js";
import { randomInterviewQuestions } from "./questions.js";

export async function startInterview(input: {
  userId: string;
  databaseId: string;
  count: number;
  difficulty: string;
  durationSeconds: number;
}) {
  const questions = await randomInterviewQuestions(input.databaseId, input.difficulty, input.count);
  const sessionId = crypto.randomUUID();
  const startedAt = new Date();
  await mongoCollection("interview_sessions").insertOne({
    _id: sessionId,
    id: sessionId,
    user_id: input.userId,
    database_id: input.databaseId,
    question_ids: questions.map((question) => String(question.id)),
    difficulty: input.difficulty,
    duration_seconds: input.durationSeconds,
    status: "in_progress",
    responses: [],
    started_at: startedAt,
    deadline_at: new Date(startedAt.getTime() + input.durationSeconds * 1000),
    created_at: startedAt
  });
  return { sessionId, startedAt: startedAt.toISOString(), durationSeconds: input.durationSeconds, questions };
}

export async function getInterviewSession(sessionId: string, userId: string): Promise<any> {
  return mongoCollection("interview_sessions").findOne({ _id: sessionId, user_id: userId });
}

export async function completeInterview(sessionId: string, userId: string, result: Record<string, unknown>): Promise<boolean> {
  const updated = await mongoCollection("interview_sessions").updateOne(
    { _id: sessionId, user_id: userId, status: "in_progress" },
    { $set: { ...result, status: "completed", completed_at: new Date() } }
  );
  return updated.matchedCount === 1;
}