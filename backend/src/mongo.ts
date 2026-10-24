import { MongoClient, type Collection, type Db, type Document } from "mongodb";

let client: MongoClient | undefined;
let database: Db | undefined;

export async function connectMongo(): Promise<Db> {
  if (database) return database;

  const uri = process.env.MONGODB_URI ??
    (process.env.NODE_ENV === "production" ? undefined : "mongodb://127.0.0.1:27017");
  if (!uri) throw new Error("MONGODB_URI must be configured");

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  database = client.db(process.env.MONGODB_DATABASE || "sql_software");

  const sessions = database.collection("sessions");
  if (await database.listCollections({ name: "sessions" }).hasNext()) {
    const indexes = await sessions.indexes();
    if (indexes.some(index => index.name === "tokenHash_1" && index.key?.tokenHash === 1)) {
      await sessions.dropIndex("tokenHash_1");
    }
  }

  const revisionMarks = database.collection("question_revision_marks");
  if (await database.listCollections({ name: "question_revision_marks" }).hasNext()) {
    const indexes = await revisionMarks.indexes();
    const legacyIndex = indexes.find(index =>
      index.unique &&
      index.key?.sessionId === 1 &&
      index.key?.challengeId === 1
    );
    if (legacyIndex?.name) await revisionMarks.dropIndex(legacyIndex.name);
  }

  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ token_hash: 1 }, { unique: true, name: "sessions_token_hash_unique" }),
    database.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    database.collection("app_databases").createIndex({ slug: 1 }, { unique: true }),
    database.collection("app_databases").createIndex({ owner_user_id: 1, created_at: -1 }),
    database.collection("question_datasets").createIndex({ owner_user_id: 1, created_at: -1 }),
    database.collection("challenges").createIndex({ database_id: 1, created_at: -1 }),
    database.collection("challenges").createIndex({ question_set_id: 1, created_at: 1 }),
    database.collection("question_sets").createIndex({ database_id: 1, created_at: -1 }),
    database.collection("question_collections").createIndex({ database_id: 1, is_published: 1, created_at: -1 }),
    database.collection("attempts").createIndex({ challenge_id: 1, session_id: 1, created_at: -1 }),
    revisionMarks.createIndex(
      { session_id: 1, challenge_id: 1 },
      {
        unique: true,
        name: "question_revision_marks_session_challenge_unique",
        partialFilterExpression: { session_id: { $type: "string" }, challenge_id: { $type: "string" } }
      }
    ),
    database.collection("learning_modules").createIndex({ order: 1 }),
    database.collection("learning_progress").createIndex({ user_id: 1, lesson_id: 1 }, { unique: true }),
    database.collection("learning_progress").createIndex({ user_id: 1, updated_at: -1 }),
    database.collection("learning_questions").createIndex({ module_id: 1, status: 1, difficulty: 1, type: 1, created_at: -1 }),
    database.collection("learning_attempts").createIndex({ user_id: 1, question_id: 1, created_at: -1 }),
    database.collection("learning_attempts").createIndex({ user_id: 1, created_at: -1 }),
    database.collection("learning_bookmarks").createIndex({ user_id: 1, question_id: 1 }, { unique: true }),
    database.collection("learning_revision_marks").createIndex({ user_id: 1, question_id: 1 }, { unique: true }),
    database.collection("learning_revision_marks").createIndex({ user_id: 1, marked_at: -1 }),
    database.collection("learning_question_progress").createIndex({ user_id: 1, question_id: 1 }, { unique: true }),
    database.collection("learning_question_progress").createIndex({ user_id: 1, updated_at: -1 }),
    database.collection("study_notes").createIndex({ user_id: 1, updated_at: -1 }),
    database.collection("study_notes").createIndex({ user_id: 1, bookmarked: 1, updated_at: -1 }),
    database.collection("study_sticky_notes").createIndex({ user_id: 1, pinned: -1, updated_at: -1 }),
    database.collection("study_note_documents").createIndex({ user_id: 1, created_at: -1 }),
    database.collection("ai_chat_conversations").createIndex({ user_id: 1, updated_at: -1 }),
    database.collection("ai_chat_messages").createIndex({ conversation_id: 1, created_at: 1 }),
    database.collection("ai_chat_attachments").createIndex({ conversation_id: 1, user_id: 1 }),
    database.collection("spark_execution_jobs").createIndex({ user_id: 1, created_at: -1 }),
    database.collection("spark_execution_jobs").createIndex({ expire_at: 1 }, { expireAfterSeconds: 0 }),
    database.collection("interview_sessions").createIndex({ user_id: 1, created_at: -1 }),
    database.collection("interview_sessions").createIndex({ deadline_at: 1 }, { expireAfterSeconds: 2592000 })
  ]);

  return database;
}

export function mongoCollection<T extends Document = Document & { _id?: string }>(name: string): Collection<T> {
  if (!database) throw new Error("MongoDB has not been connected");
  return database.collection<T>(name);
}

export async function closeMongo(): Promise<void> {
  if (!client) return;
  await client.close();
  client = undefined;
  database = undefined;
}