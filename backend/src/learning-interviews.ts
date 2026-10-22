import crypto from "node:crypto";
import type { Document } from "mongodb";
import { evaluateLearningInterviewAnswer, type InterviewFeedback } from "./ai.js";
import { mongoCollection } from "./mongo.js";

export async function startLearningInterview(input: {
  userId: string;
  moduleId: string;
  difficulty: string;
  count: number;
  durationSeconds: number;
}) {
  const match: Record<string, any> = { module_id: input.moduleId, status: "published", type: { $in: ["mcq", "scenario"] } };
  if (input.difficulty !== "mixed") match.difficulty = input.difficulty;
  const questions = await mongoCollection("learning_questions").aggregate([
    { $match: match },
    { $sample: { size: input.count } },
    { $project: { answer_id: 0, reference_answer: 0, explanation: 0, common_mistakes: 0, test_cases: 0, reference_solution: 0 } }
  ]).toArray();
  if (!questions.length) throw new Error("No published interview questions match this track and difficulty");

  const id = crypto.randomUUID();
  const startedAt = new Date();
  const session = {
    _id: id,
    id,
    user_id: input.userId,
    module_id: input.moduleId,
    difficulty: input.difficulty,
    duration_seconds: input.durationSeconds,
    questions: questions.map((question) => {
      const { _id, ...visible } = question;
      return { ...visible, id: String(_id) };
    }),
    question_ids: questions.map((question) => String(question._id)),
    responses: [],
    status: "in_progress",
    started_at: startedAt,
    deadline_at: new Date(startedAt.getTime() + input.durationSeconds * 1000),
    created_at: startedAt
  };
  await mongoCollection("interview_sessions").insertOne(session);
  return session;
}

export async function listLearningInterviews(userId: string) {
  return mongoCollection("interview_sessions").find(
    { user_id: userId, module_id: { $exists: true } },
    { projection: { questions: 0, responses: 0 } }
  ).sort({ created_at: -1 }).limit(50).toArray();
}

export async function getLearningInterview(sessionId: string, userId: string) {
  return mongoCollection("interview_sessions").findOne({ _id: sessionId, user_id: userId, module_id: { $exists: true } });
}

export async function answerLearningInterview(input: {
  sessionId: string;
  userId: string;
  questionId: string;
  answer: string;
  evaluate?: (evaluationInput: { track: string; topic: string; question: string; answer: string }) => Promise<InterviewFeedback>;
}) {
  const sessions = mongoCollection("interview_sessions");
  const session = await getLearningInterview(input.sessionId, input.userId);
  if (!session) return { status: "not_found" as const };
  if (session.status !== "in_progress") return { status: "closed" as const };
  if (new Date(session.deadline_at) <= new Date()) return { status: "expired" as const };
  const question = (session.questions || []).find((item: any) => String(item.id) === input.questionId);
  if (!question) return { status: "question_not_in_session" as const };

  const prior = (session.responses || []).find((item: any) => item.question_id === input.questionId);
  if (prior?.feedback) return { status: "already_answered" as const, response: prior };
  const responseId = prior?.id || crypto.randomUUID();
  const savedAnswer = {
    id: responseId,
    question_id: input.questionId,
    answer: input.answer,
    feedback_status: "pending",
    answered_at: new Date()
  };
  const filter: Record<string, any> = { _id: input.sessionId, user_id: input.userId, status: "in_progress" };
  if (prior) filter["responses.question_id"] = input.questionId;
  else filter.responses = { $not: { $elemMatch: { question_id: input.questionId } } };
  const update: Document = prior
    ? { $set: { "responses.$.answer": input.answer, "responses.$.feedback_status": "pending", "responses.$.answered_at": savedAnswer.answered_at } }
    : { $push: { responses: savedAnswer } };
  const stored = await sessions.updateOne(filter, update);
  if (!stored.matchedCount) return { status: "already_answered" as const };

  try {
    const feedback = await (input.evaluate || evaluateLearningInterviewAnswer)({
      track: String(session.module_id),
      topic: String(question.topic || "Data engineering"),
      question: String(question.prompt || ""),
      answer: input.answer
    });
    const total = feedback.correctness + feedback.completeness + feedback.reasoning + feedback.tradeoffs;
    const result = { ...feedback, score: Math.round(total * 5), evaluated_at: new Date() };
    await sessions.updateOne(
      { _id: input.sessionId, user_id: input.userId, "responses.id": responseId },
      { $set: { "responses.$.feedback": result, "responses.$.feedback_status": "complete" } }
    );
    return { status: "ok" as const, response: { ...savedAnswer, feedback: result, feedback_status: "complete" } };
  } catch {
    return { status: "feedback_unavailable" as const, response: savedAnswer };
  }
}

export async function finishLearningInterview(sessionId: string, userId: string) {
  const session = await getLearningInterview(sessionId, userId);
  if (!session) return { status: "not_found" as const };
  if (session.status === "completed") return { status: "ok" as const, session };
  if (session.status !== "in_progress") return { status: "closed" as const };
  const responses = session.responses || [];
  const evaluated = responses.filter((response: any) => response.feedback);
  const score = evaluated.length
    ? Math.round(evaluated.reduce((sum: number, response: any) => sum + Number(response.feedback.score || 0), 0) / evaluated.length)
    : null;
  const gaps = [...new Set(evaluated.flatMap((response: any) => response.feedback.gaps || []))].slice(0, 12);
  const result = {
    status: "completed",
    completed_at: new Date(),
    score,
    evaluated_count: evaluated.length,
    unanswered_count: Math.max((session.questions || []).length - responses.length, 0),
    feedback_pending_count: responses.filter((response: any) => !response.feedback).length,
    revision_recommendations: gaps
  };
  const updated = await mongoCollection("interview_sessions").updateOne(
    { _id: sessionId, user_id: userId, status: "in_progress" },
    { $set: result }
  );
  if (!updated.matchedCount) return { status: "closed" as const };
  return { status: "ok" as const, session: { ...session, ...result } };
}