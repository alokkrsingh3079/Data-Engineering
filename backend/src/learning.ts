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
        update: { $set: { ...attempt, id: String(attempt.id) }, $setOnInsert: { _id: String(attempt.id) } },
        upsert: true
      }
    })), { ordered: false });
  }

  const markCollection = mongoCollection("question_revision_marks");
  for (const mark of marks.rows) {
    const id = `${mark.session_id}:${mark.challenge_id}`;
    await markCollection.updateOne(
      { _id: id },
      { $set: mark, $setOnInsert: { _id: id } },
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

export function summarizeQuestionAttempts(attempts: { correct?: boolean; is_revision?: boolean }[]) {
  return {
    attempt_count: attempts.length,
    revision_count: attempts.filter(attempt => attempt.is_revision).length,
    last_correct: attempts.length ? Boolean(attempts[0].correct) : null,
    solved: attempts.some(attempt => Boolean(attempt.correct))
  };
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
  const attemptsByQuestion = new Map<string, { correct: boolean; is_revision?: boolean }[]>();
  for (const attempt of attempts) {
    const id = String(attempt.challenge_id);
    const item = attemptsByQuestion.get(id) || [];
    if (typeof attempt.correct === "boolean") {
      item.push({
        correct: attempt.correct,
        is_revision: typeof attempt.is_revision === "boolean" ? attempt.is_revision : undefined
      });
    }
    attemptsByQuestion.set(id, item);
  }
  const marked = new Set(marks.map((mark: any) => String(mark.challenge_id)));
  return questionIds.map(id => {
    const item = summarizeQuestionAttempts(attemptsByQuestion.get(id) || []);
    return {
      id,
      ...item,
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

export function summarizeDailyAttempts(
  attempts: { created_at: Date | string; correct: boolean; track_id: string; question_id: string }[],
  days: number,
  timeZone: string,
  now = new Date()
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateKey = (value: Date | string) => {
    const parts = formatter.formatToParts(new Date(value));
    const part = (type: string) => parts.find(item => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const today = dateKey(now);
  const counts = new Map<string, { attempts: number; solvedQuestions: Set<string>; tracks: Map<string, { attempts: number; solvedQuestions: Set<string> }> }>();
  const solvedDates = new Set<string>();

  for (const attempt of attempts) {
    const date = dateKey(attempt.created_at);
    const day = counts.get(date) || { attempts: 0, solvedQuestions: new Set(), tracks: new Map() };
    const track = day.tracks.get(attempt.track_id) || { attempts: 0, solvedQuestions: new Set() };
    day.attempts += 1;
    track.attempts += 1;
    if (attempt.correct) {
      day.solvedQuestions.add(`${attempt.track_id}:${attempt.question_id}`);
      track.solvedQuestions.add(attempt.question_id);
      solvedDates.add(date);
    }
    day.tracks.set(attempt.track_id, track);
    counts.set(date, day);
  }

  const calendarDays = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${today}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - index);
    const key = date.toISOString().slice(0, 10);
    const count = counts.get(key);
    return {
      date: key,
      attempts: count?.attempts || 0,
      solved: count?.solvedQuestions.size || 0,
      tracks: count ? [...count.tracks].map(([trackId, values]) => ({ trackId, attempts: values.attempts, solved: values.solvedQuestions.size })).sort((left, right) => left.trackId.localeCompare(right.trackId)) : []
    };
  });

  const todayCounts = calendarDays[0];
  let streakCursor = today;
  if (!solvedDates.has(streakCursor)) {
    const yesterday = new Date(`${today}T12:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    streakCursor = yesterday.toISOString().slice(0, 10);
  }
  let streakDays = 0;
  while (solvedDates.has(streakCursor)) {
    streakDays += 1;
    const previousDay = new Date(`${streakCursor}T12:00:00.000Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    streakCursor = previousDay.toISOString().slice(0, 10);
  }

  return { timeZone, streakDays, today: todayCounts, days: calendarDays };
}

export function summarizeAllTimeSolved(
  sqlQuestionIds: string[],
  learningQuestions: { question_id: string; track_id: string }[]
) {
  const counts = new Map<string, Set<string>>();
  const sqlIds = new Set(sqlQuestionIds);
  counts.set("sql-interview-lab", sqlIds);
  for (const question of learningQuestions) {
    const questionIds = counts.get(question.track_id) || new Set<string>();
    questionIds.add(question.question_id);
    counts.set(question.track_id, questionIds);
  }
  return [...counts].map(([trackId, questionIds]) => ({ trackId, solved: questionIds.size }))
    .sort((left, right) => left.trackId.localeCompare(right.trackId));
}

export function summarizeTrackQuestionTotals(
  sqlQuestionCount: number,
  learningQuestionCounts: { trackId: string; total: number }[],
  solvedTracks: { trackId: string; solved: number }[]
) {
  const solvedByTrack = new Map(solvedTracks.map(track => [track.trackId, track.solved]));
  const totals = new Map<string, number>([["sql-interview-lab", sqlQuestionCount]]);
  for (const track of learningQuestionCounts) totals.set(track.trackId, track.total);
  return [...totals].map(([trackId, total]) => ({ trackId, total, solved: solvedByTrack.get(trackId) || 0 }))
    .sort((left, right) => left.trackId.localeCompare(right.trackId));
}

export async function dailyProgress(userId: string, days = 30, timeZone = "UTC", isAdmin = false) {
  const since = new Date(Date.now() - (days + 2) * 24 * 60 * 60 * 1000);
  const workspaces = isAdmin
    ? await pool.query("SELECT id FROM app_databases")
    : await pool.query("SELECT id FROM app_databases WHERE owner_user_id=$1", [userId]);
  const databaseIds = workspaces.rows.map((workspace: any) => String(workspace.id));
  const sqlQuestions = databaseIds.length
    ? await mongoCollection("challenges").find({ database_id: { $in: databaseIds } }, { projection: { id: 1 } }).toArray()
    : [];
  const sqlQuestionIds = sqlQuestions.map((question: any) => String(question.id || question._id));
  const [sqlAttempts, learningAttempts, sqlSolvedIds, learningCompletions] = await Promise.all([
    mongoCollection("attempts").find({ session_id: userId, challenge_id: { $in: sqlQuestionIds }, created_at: { $gte: since } }, { projection: { challenge_id: 1, correct: 1, created_at: 1 } }).toArray(),
    mongoCollection("learning_attempts").find({ user_id: userId, created_at: { $gte: since } }, { projection: { question_id: 1, correct: 1, created_at: 1 } }).toArray(),
    mongoCollection("attempts").distinct("challenge_id", { session_id: userId, challenge_id: { $in: sqlQuestionIds }, correct: true }),
    mongoCollection("learning_question_progress").find({ user_id: userId, completed: true }, { projection: { question_id: 1 } }).toArray()
  ]);
  const learningQuestionIds = [...new Set(learningAttempts.map((attempt: any) => String(attempt.question_id)))];
  const learningQuestions = learningQuestionIds.length
    ? await mongoCollection("learning_questions").find({ _id: { $in: learningQuestionIds } }, { projection: { module_id: 1 } }).toArray()
    : [];
  const moduleByQuestionId = new Map(learningQuestions.map((question: any) => [String(question._id), String(question.module_id || "unknown")]));
  const completedLearningQuestionIds = [...new Set(learningCompletions.map((item: any) => String(item.question_id)))];
  const completedLearningQuestions = completedLearningQuestionIds.length
    ? await mongoCollection("learning_questions").find({ _id: { $in: completedLearningQuestionIds } }, { projection: { module_id: 1 } }).toArray()
    : [];
  const learningQuestionCounts = await mongoCollection("learning_questions").aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$module_id", total: { $sum: 1 } } }
  ]).toArray();
  const allTimeTracks = summarizeAllTimeSolved(
    sqlSolvedIds.map((questionId: unknown) => String(questionId)),
    completedLearningQuestions.map((question: any) => ({ question_id: String(question._id), track_id: String(question.module_id || "unknown") }))
  );
  const trackTotals = summarizeTrackQuestionTotals(
    sqlQuestionIds.length,
    learningQuestionCounts.map((track: any) => ({ trackId: String(track._id), total: Number(track.total) })),
    allTimeTracks
  );
  const records = [
    ...sqlAttempts.map((attempt: any) => ({ created_at: attempt.created_at, correct: Boolean(attempt.correct), track_id: "sql-interview-lab", question_id: String(attempt.challenge_id) })),
    ...learningAttempts.map((attempt: any) => ({ created_at: attempt.created_at, correct: Boolean(attempt.correct), track_id: moduleByQuestionId.get(String(attempt.question_id)) || "unknown", question_id: String(attempt.question_id) }))
  ];
  return { ...summarizeDailyAttempts(records, days, timeZone), allTimeTracks, trackTotals };
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