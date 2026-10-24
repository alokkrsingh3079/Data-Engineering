import crypto from "node:crypto";
import type { Document } from "mongodb";
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
    question_duration_seconds: Math.max(30, Math.floor(input.durationSeconds / input.count)),
    question_started_at: startedAt,
    status: "in_progress",
    answers_recorded_on_server: true,
    responses: [],
    started_at: startedAt,
    deadline_at: new Date(startedAt.getTime() + input.durationSeconds * 1000),
    created_at: startedAt
  });
  return { sessionId, startedAt: startedAt.toISOString(), durationSeconds: input.durationSeconds, questions };
}

export async function saveInterviewAnswer(input: {
  sessionId: string;
  userId: string;
  questionId: string;
  sql: string;
  skipped: boolean;
}) {
  const session = await getInterviewSession(input.sessionId, input.userId);
  if (!session) return { status: "not_found" as const };
  if (session.status !== "in_progress") return { status: "closed" as const };
  if (new Date(session.deadline_at) <= new Date()) return { status: "expired" as const };
  const existing = (session.responses || []).find((response: any) => String(response.question_id) === input.questionId);
  if (existing) {
    return String(existing.sql || "") === (input.skipped ? "" : input.sql) && Boolean(existing.skipped) === input.skipped
      ? { status: "ok" as const, response: existing }
      : { status: "already_answered" as const };
  }
  const questionIndex = (session.responses || []).length;
  if (String(session.question_ids?.[questionIndex] || "") !== input.questionId) return { status: "question_order" as const };
  const questionStartedAt = new Date(session.question_started_at || session.started_at).getTime();
  const questionDurationSeconds = Number(session.question_duration_seconds || Math.max(30, Math.floor(Number(session.duration_seconds) / Math.max(session.question_ids?.length || 1, 1))));
  if (!input.skipped && Date.now() - questionStartedAt >= questionDurationSeconds * 1000) return { status: "question_expired" as const };

  const now = new Date();
  const response = {
    question_id: input.questionId,
    sql: input.skipped ? "" : input.sql,
    skipped: input.skipped,
    answered_at: now
  };
  const update: Document = { $push: { responses: response }, $set: { question_started_at: now } };
  const stored = await mongoCollection("interview_sessions").updateOne(
    {
      _id: input.sessionId,
      user_id: input.userId,
      status: "in_progress",
      responses: { $size: questionIndex }
    },
    update
  );
  return stored.matchedCount ? { status: "ok" as const, response } : { status: "question_order" as const };
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