import { mongoCollection } from "./mongo.js";
import { pool } from "./db.js";

export async function migrateLegacyLearningData(): Promise<void> {
  const [attempts, marks] = await Promise.all([
    pool.query("SELECT * FROM attempts"),
    pool.query("SELECT * FROM question_revision_marks")
  ]);

  const attemptCollection = mongoCollection("attempts");
  for (let offset = 0; offset < attempts.rows.length; offset += 250) {
    const batch = attempts.rows.slice(offset, offset + 250);
    await attemptCollection.bulkWrite(batch.map((attempt: any) => ({
      updateOne: {
        filter: { _id: String(attempt.id) },
        update: { $setOnInsert: { ...attempt, _id: String(attempt.id) } },
        upsert: true
      }
    })), { ordered: false });
  }

  const markCollection = mongoCollection("question_revision_marks");
  for (const mark of marks.rows) {
    const id = `${mark.session_id}:${mark.challenge_id}`;
    await markCollection.updateOne(
      { _id: id },
      { $setOnInsert: { ...mark, _id: id } },
      { upsert: true }
    );
  }
}

export async function recordAttempt(attempt: Record<string, unknown>): Promise<void> {
  await mongoCollection("attempts").insertOne({ _id: String(attempt.id), ...attempt });
}

export async function listQuestionAttempts(questionId: string, sessionId: string) {
  return mongoCollection("attempts")
    .find({ challenge_id: questionId, session_id: sessionId })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
}

export async function setRevisionMark(sessionId: string, questionId: string, marked: boolean): Promise<void> {
  const marks = mongoCollection("question_revision_marks");
  const id = `${sessionId}:${questionId}`;
  if (marked) {
    await marks.updateOne(
      { _id: id },
      { $setOnInsert: { _id: id, session_id: sessionId, challenge_id: questionId, created_at: new Date() } },
      { upsert: true }
    );
  } else {
    await marks.deleteOne({ _id: id });
  }
}

export async function clearRevisionMark(sessionId: string, questionId: string): Promise<void> {
  await mongoCollection("question_revision_marks").deleteOne({ _id: `${sessionId}:${questionId}` });
}

export async function revisionStatus(databaseId: string, sessionId: string) {
  const questionRows = await mongoCollection("challenges")
    .find({ database_id: databaseId }, { projection: { id: 1 } })
    .sort({ created_at: -1 })
    .toArray();
  const questionIds = questionRows.map((row: any) => String(row.id));
  if (!questionIds.length) return [];

  const [attempts, marks] = await Promise.all([
    mongoCollection("attempts").find({ session_id: sessionId, challenge_id: { $in: questionIds } })
      .sort({ created_at: -1 }).toArray(),
    mongoCollection("question_revision_marks").find({ session_id: sessionId, challenge_id: { $in: questionIds } })
      .toArray()
  ]);
  const counts = new Map<string, { attempts: number; revisions: number; lastCorrect: boolean | null }>();
  for (const attempt of attempts) {
    const id = String(attempt.challenge_id);
    const item = counts.get(id) || { attempts: 0, revisions: 0, lastCorrect: null };
    item.attempts += 1;
    if (attempt.is_revision) item.revisions += 1;
    if (item.lastCorrect === null) item.lastCorrect = Boolean(attempt.correct);
    counts.set(id, item);
  }
  const marked = new Set(marks.map((mark: any) => String(mark.challenge_id)));
  return questionIds.map(id => {
    const item = counts.get(id);
    return {
      id,
      attempt_count: item?.attempts || 0,
      revision_count: item?.revisions || 0,
      last_correct: item?.lastCorrect ?? null,
      marked: marked.has(id)
    };
  });
}

async function sessionAttempts(sessionId: string) {
  const attempts = await mongoCollection("attempts").find({ session_id: sessionId })
    .sort({ created_at: -1 }).toArray();
  const questionIds = [...new Set(attempts.map((attempt: any) => String(attempt.challenge_id)))];
  const questions = questionIds.length
    ? await mongoCollection("challenges").find({ id: { $in: questionIds } }, { projection: { id: 1, title: 1, topic: 1, difficulty: 1 } }).toArray()
    : [];
  return { attempts, questions: new Map(questions.map((question: any) => [String(question.id), question])) };
}

export async function progressSummary(sessionId: string) {
  const { attempts, questions } = await sessionAttempts(sessionId);
  const topicCounts = new Map<string, { attempts: number; correct: number }>();
  for (const attempt of attempts) {
    const topic = String(questions.get(String(attempt.challenge_id))?.topic || "Unknown");
    const counts = topicCounts.get(topic) || { attempts: 0, correct: 0 };
    counts.attempts += 1;
    if (attempt.correct) counts.correct += 1;
    topicCounts.set(topic, counts);
  }
  const average = attempts.length
    ? Math.round(attempts.reduce((sum: number, attempt: any) => sum + Number(attempt.execution_ms || 0), 0) / attempts.length)
    : 0;
  return {
    totals: {
      attempts: attempts.length,
      correct: attempts.filter((attempt: any) => attempt.correct).length,
      questions_attempted: new Set(attempts.map((attempt: any) => String(attempt.challenge_id))).size,
      avg_ms: average
    },
    topics: [...topicCounts].map(([topic, counts]) => ({ topic, ...counts }))
      .sort((left, right) => right.attempts - left.attempts)
  };
}

export async function analyticsOverview(sessionId: string) {
  const { attempts, questions } = await sessionAttempts(sessionId);
  const topicCounts = new Map<string, { attempts: number; correct: number; time: number }>();
  const days = new Set<string>();
  for (const attempt of attempts) {
    const topic = String(questions.get(String(attempt.challenge_id))?.topic || "Unknown");
    const counts = topicCounts.get(topic) || { attempts: 0, correct: 0, time: 0 };
    counts.attempts += 1;
    counts.correct += attempt.correct ? 1 : 0;
    counts.time += Number(attempt.execution_ms || 0);
    topicCounts.set(topic, counts);
    if (attempt.created_at) days.add(new Date(attempt.created_at).toISOString().slice(0, 10));
  }
  return {
    topics: [...topicCounts].map(([topic, counts]) => ({
      topic,
      attempts: counts.attempts,
      correct: counts.correct,
      avg_ms: counts.attempts ? Math.round(counts.time / counts.attempts) : 0
    })).sort((left, right) => right.attempts - left.attempts),
    activeDays: [...days].sort((left, right) => right.localeCompare(left)).slice(0, 60)
  };
}

export async function exportProgress(sessionId: string) {
  const { attempts, questions } = await sessionAttempts(sessionId);
  return attempts.flatMap((attempt: any) => {
    const question = questions.get(String(attempt.challenge_id));
    if (!question) return [];
    return [{
      created_at: attempt.created_at,
      title: question.title,
      topic: question.topic,
      difficulty: question.difficulty,
      correct: attempt.correct,
      execution_ms: attempt.execution_ms,
      sql: attempt.sql,
      error: attempt.error
    }];
  });
}