import { mongoCollection } from "./mongo.js";
import { pool } from "./db.js";
import { migrateUserWorkspace } from "./workspaces.js";

async function copyRows(collectionName: string, rows: any[]): Promise<void> {
  const collection = mongoCollection(collectionName);
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    await collection.bulkWrite(batch.map((row: any) => ({
      updateOne: {
        filter: { _id: String(row.id) },
        update: { $setOnInsert: { ...row, _id: String(row.id) } },
        upsert: true
      }
    })), { ordered: false });
  }
}

export async function migrateLegacyQuestions(databaseId?: string): Promise<void> {
  const scoped = databaseId ? " WHERE database_id=$1" : "";
  const params = databaseId ? [databaseId] : [];
  const [sets, questions, collections, reviews, flags] = await Promise.all([
    pool.query(`SELECT * FROM question_sets${scoped}`, params),
    pool.query(`SELECT * FROM challenges${scoped}`, params),
    pool.query(`SELECT * FROM question_collections${scoped}`, params),
    pool.query("SELECT * FROM question_reviews"),
    pool.query("SELECT * FROM challenge_flags")
  ]);
  await copyRows("question_sets", sets.rows);
  await copyRows("challenges", questions.rows);
  await copyRows("question_collections", collections.rows);
  await copyRows("question_reviews", reviews.rows);
  await copyRows("challenge_flags", flags.rows);

  const collectionFilter = databaseId ? " WHERE qc.database_id=$1" : "";
  const members = await pool.query(
    `SELECT cq.* FROM collection_questions cq JOIN question_collections qc ON qc.id=cq.collection_id${collectionFilter}`,
    params
  );
  const membershipCollection = mongoCollection("collection_questions");
  for (const member of members.rows) {
    const id = `${member.collection_id}:${member.challenge_id}`;
    await membershipCollection.updateOne(
      { _id: id },
      { $setOnInsert: { ...member, _id: id } },
      { upsert: true }
    );
  }
}

  export async function migrateUserWorkspaceQuestions(userId: string): Promise<void> {
    await migrateUserWorkspace(userId);
    const workspace = await pool.query(
      "SELECT id FROM app_databases WHERE owner_user_id=$1 LIMIT 1",
      [userId]
    );
    if (workspace.rowCount) await migrateLegacyQuestions(String(workspace.rows[0].id));
  }

export async function listQuestions(databaseId: string) {
  return mongoCollection("challenges")
    .find({ database_id: databaseId }, { projection: { reference_sql: 0 } })
    .sort({ created_at: -1 })
    .toArray();
}

export async function getQuestion(questionId: string): Promise<any> {
  return mongoCollection("challenges").findOne({ _id: questionId });
}

export async function questionBelongsToUser(questionId: string, userId: string): Promise<boolean> {
  const question = await getQuestion(questionId);
  if (!question) return false;
  const workspace = await pool.query(
    "SELECT 1 FROM app_databases WHERE id=$1 AND owner_user_id=$2",
    [question.database_id, userId]
  );
  return Boolean(workspace.rowCount);
}

export async function questionSetBelongsToUser(questionSetId: string, userId: string): Promise<boolean> {
  const questionSet = await mongoCollection("question_sets").findOne({ _id: questionSetId });
  if (!questionSet) return false;
  const workspace = await pool.query(
    "SELECT 1 FROM app_databases WHERE id=$1 AND owner_user_id=$2",
    [questionSet.database_id, userId]
  );
  return Boolean(workspace.rowCount);
}

export async function getQuestionSets(databaseId: string, acceptedOnly = true) {
  const filter: Record<string, unknown> = { database_id: databaseId };
  if (acceptedOnly) Object.assign(filter, { status: { $in: ["completed", "failed"] }, accepted_count: { $gt: 0 } });
  return mongoCollection("question_sets").find(filter).sort({ created_at: -1 }).toArray();
}

export async function getQuestionSetQuestions(questionSetId: string) {
  return mongoCollection("challenges")
    .find({ question_set_id: questionSetId }, { projection: { reference_sql: 0 } })
    .sort({ position: 1, created_at: 1, _id: 1 })
    .toArray();
}

export async function createQuestionSet(questionSet: Record<string, unknown>): Promise<void> {
  await mongoCollection("question_sets").insertOne({ _id: String(questionSet.id), ...questionSet });
}

export async function updateQuestionSet(questionSetId: string, fields: Record<string, unknown>): Promise<void> {
  await mongoCollection("question_sets").updateOne({ _id: questionSetId }, { $set: fields });
}

export async function questionExists(databaseId: string, title: string, referenceSql: string): Promise<boolean> {
  return Boolean(await mongoCollection("challenges").findOne(
    { database_id: databaseId, title, reference_sql: referenceSql },
    { projection: { _id: 1 } }
  ));
}

export async function createQuestion(question: Record<string, unknown>): Promise<void> {
  const collection = mongoCollection("challenges");
  const position = question.question_set_id
    ? await collection.countDocuments({ question_set_id: question.question_set_id }) + 1
    : question.position;
  await collection.insertOne({
    _id: String(question.id),
    ...question,
    ...(position === undefined ? {} : { position })
  });
}

export async function listAdminQuestions(databaseId: string, reviewStatus: string) {
  const reviewIds = reviewStatus
    ? (await mongoCollection("question_reviews").find({ status: reviewStatus }, { projection: { challenge_id: 1 } }).toArray())
      .map(review => String(review.challenge_id))
    : undefined;
  if (reviewIds && !reviewIds.length) return [];
  const filter: Record<string, unknown> = {};
  if (databaseId) filter.database_id = databaseId;
  if (reviewIds) filter.id = { $in: reviewIds };
  return mongoCollection("challenges")
    .find(filter, { projection: { id: 1, title: 1, difficulty: 1, topic: 1, source: 1, created_at: 1 } })
    .sort({ created_at: -1 })
    .limit(500)
    .toArray();
}

export async function saveQuestionReview(review: Record<string, unknown>): Promise<void> {
  await mongoCollection("question_reviews").insertOne({ _id: String(review.id), ...review });
}

export async function deleteQuestion(questionId: string): Promise<void> {
  await Promise.all([
    mongoCollection("challenges").deleteOne({ _id: questionId }),
    mongoCollection("attempts").deleteMany({ challenge_id: questionId }),
    mongoCollection("question_revision_marks").deleteMany({ challenge_id: questionId }),
    mongoCollection("question_reviews").deleteMany({ challenge_id: questionId }),
    mongoCollection("challenge_flags").deleteMany({ challenge_id: questionId }),
    mongoCollection("collection_questions").deleteMany({ challenge_id: questionId })
  ]);
}

export async function createQuestionCollection(collection: Record<string, unknown>): Promise<void> {
  await mongoCollection("question_collections").insertOne({ _id: String(collection.id), ...collection });
}

export async function setCollectionQuestions(collectionId: string, questionIds: string[]): Promise<void> {
  const members = mongoCollection("collection_questions");
  await members.deleteMany({ collection_id: collectionId });
  if (questionIds.length) {
    await members.insertMany(questionIds.map((questionId, position) => ({
      _id: `${collectionId}:${questionId}`,
      collection_id: collectionId,
      challenge_id: questionId,
      position
    })));
  }
}

export async function listPublishedCollections(databaseId: string) {
  return mongoCollection("question_collections")
    .find({ database_id: databaseId, is_published: true })
    .sort({ created_at: -1 })
    .toArray();
}

export async function collectionQuestions(collectionId: string) {
  const collection = await mongoCollection("question_collections").findOne({ _id: collectionId, is_published: true });
  if (!collection) return [];
  const members = await mongoCollection("collection_questions").find({ collection_id: collectionId }).sort({ position: 1 }).toArray();
  const ids = members.map(member => String(member.challenge_id));
  const questions = ids.length
    ? await mongoCollection("challenges").find({ id: { $in: ids } }, { projection: { reference_sql: 0 } }).toArray()
    : [];
  const byId = new Map(questions.map(question => [String(question.id), question]));
  return members.flatMap(member => {
    const question = byId.get(String(member.challenge_id));
    return question ? [{ ...question, position: member.position }] : [];
  });
}

export async function collectionBelongsToUser(collectionId: string, userId: string): Promise<boolean> {
  const collection = await mongoCollection("question_collections").findOne({ _id: collectionId });
  if (!collection) return false;
  const workspace = await pool.query(
    "SELECT 1 FROM app_databases WHERE id=$1 AND owner_user_id=$2",
    [collection.database_id, userId]
  );
  return Boolean(workspace.rowCount);
}

export async function randomInterviewQuestions(databaseId: string, difficulty: string, count: number) {
  const match: Record<string, unknown> = { database_id: databaseId };
  if (difficulty !== "mixed") match.difficulty = difficulty;
  return mongoCollection("challenges").aggregate([
    { $match: match },
    { $sample: { size: count } },
    { $project: { id: 1, title: 1, difficulty: 1, topic: 1, context: 1, task: 1, required_output: 1 } }
  ]).toArray();
}