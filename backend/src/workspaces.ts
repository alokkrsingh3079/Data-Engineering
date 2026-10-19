import { mongoCollection } from "./mongo.js";
import { grantPracticeSchema, pool } from "./db.js";

export async function migrateLegacyWorkspaces(): Promise<void> {
  const { rows } = await pool.query("SELECT * FROM app_databases");
  const workspaces = mongoCollection("app_databases");
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    await workspaces.bulkWrite(batch.map((workspace: any) => ({
      updateOne: {
        filter: { _id: String(workspace.id) },
        update: { $set: { ...workspace, id: String(workspace.id) }, $setOnInsert: { _id: String(workspace.id) } },
        upsert: true
      }
    })), { ordered: false });
  }
  for (const workspace of rows) await grantPracticeSchema(String(workspace.schema_name));
}

export async function migrateUserWorkspace(userId: string): Promise<void> {
  const { rows } = await pool.query(
    "SELECT * FROM app_databases WHERE owner_user_id=$1",
    [userId]
  );
  if (!rows.length) return;
  const workspaces = mongoCollection("app_databases");
  await workspaces.bulkWrite(rows.map((workspace: any) => ({
    updateOne: {
      filter: { _id: String(workspace.id) },
      update: { $set: { ...workspace, id: String(workspace.id) }, $setOnInsert: { _id: String(workspace.id) } },
      upsert: true
    }
  })), { ordered: false });
  for (const workspace of rows) await grantPracticeSchema(String(workspace.schema_name));
}

export async function getWorkspaceById(id: string): Promise<any> {
  return mongoCollection("app_databases").findOne({ _id: id });
}

export async function getWorkspaceBySlug(slug: string): Promise<any> {
  return mongoCollection("app_databases").findOne({ slug });
}

export async function listWorkspaces(userId: string, isAdmin: boolean) {
  const filter = isAdmin ? {} : { owner_user_id: userId };
  return mongoCollection("app_databases")
    .find(filter, { projection: { id: 1, name: 1, slug: 1, schema_name: 1, dialect: 1, description: 1, created_at: 1 } })
    .sort({ created_at: -1 })
    .toArray();
}

export async function createWorkspace(workspace: Record<string, unknown>): Promise<void> {
  await mongoCollection("app_databases").insertOne({ _id: String(workspace.id), ...workspace });
}

export async function workspaceOwnedByUser(workspaceId: string, userId: string): Promise<boolean> {
  return Boolean(await mongoCollection("app_databases").findOne(
    { _id: workspaceId, owner_user_id: userId },
    { projection: { _id: 1 } }
  ));
}

export async function assignUnownedWorkspaces(userId: string): Promise<void> {
  await mongoCollection("app_databases").updateMany(
    { owner_user_id: null },
    { $set: { owner_user_id: userId } }
  );
}

export async function deleteWorkspaceRecord(workspaceId: string): Promise<void> {
  const questions = await mongoCollection("challenges").find(
    { database_id: workspaceId },
    { projection: { id: 1 } }
  ).toArray();
  const questionIds = questions.map(question => String(question.id));
  const collections = await mongoCollection("question_collections").find(
    { database_id: workspaceId },
    { projection: { id: 1 } }
  ).toArray();
  const collectionIds = collections.map(collection => String(collection.id));
  const cleanup: Promise<unknown>[] = [
    mongoCollection("app_databases").deleteOne({ _id: workspaceId }),
    mongoCollection("schema_imports").deleteMany({ database_id: workspaceId }),
    mongoCollection("database_snapshots").deleteMany({ database_id: workspaceId }),
    mongoCollection("question_sets").deleteMany({ database_id: workspaceId }),
    mongoCollection("challenges").deleteMany({ database_id: workspaceId }),
    mongoCollection("attempts").deleteMany({ database_id: workspaceId }),
    mongoCollection("question_collections").deleteMany({ database_id: workspaceId })
  ];
  if (questionIds.length) {
    cleanup.push(
      mongoCollection("attempts").deleteMany({ challenge_id: { $in: questionIds } }),
      mongoCollection("question_revision_marks").deleteMany({ challenge_id: { $in: questionIds } }),
      mongoCollection("question_reviews").deleteMany({ challenge_id: { $in: questionIds } }),
      mongoCollection("challenge_flags").deleteMany({ challenge_id: { $in: questionIds } })
    );
  }
  if (collectionIds.length) {
    cleanup.push(mongoCollection("collection_questions").deleteMany({ collection_id: { $in: collectionIds } }));
  }
  await Promise.all(cleanup);
}