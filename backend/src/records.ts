import { mongoCollection } from "./mongo.js";
import { pool } from "./db.js";

async function copyRecords(collectionName: string, rows: any[]): Promise<void> {
  const collection = mongoCollection(collectionName);
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    await collection.bulkWrite(batch.map((row: any) => ({
      updateOne: {
        filter: { _id: String(row.id) },
        update: { $set: { ...row, id: String(row.id) }, $setOnInsert: { _id: String(row.id) } },
        upsert: true
      }
    })), { ordered: false });
  }
}

export async function migrateLegacyRecords(): Promise<void> {
  const [imports, snapshots, flags, usage, jobs] = await Promise.all([
    pool.query("SELECT * FROM schema_imports"),
    pool.query("SELECT * FROM database_snapshots"),
    pool.query("SELECT * FROM feature_flags"),
    pool.query("SELECT * FROM api_usage_daily"),
    pool.query("SELECT * FROM refresh_jobs")
  ]);
  await Promise.all([
    copyRecords("schema_imports", imports.rows),
    copyRecords("database_snapshots", snapshots.rows),
    copyRecords("feature_flags", flags.rows),
    copyRecords("api_usage_daily", usage.rows),
    copyRecords("refresh_jobs", jobs.rows)
  ]);
}

export async function createSchemaImport(record: Record<string, unknown>): Promise<void> {
  await mongoCollection("schema_imports").insertOne({ _id: String(record.id), ...record });
}

export async function getSchemaImport(importId: string, databaseId: string): Promise<any> {
  return mongoCollection("schema_imports").findOne({ _id: importId, database_id: databaseId });
}

export async function approveSchemaImport(importId: string): Promise<void> {
  await mongoCollection("schema_imports").updateOne({ _id: importId }, { $set: { status: "approved" } });
}

export async function createSnapshot(snapshot: Record<string, unknown>): Promise<void> {
  await mongoCollection("database_snapshots").insertOne({ _id: String(snapshot.id), ...snapshot });
}

export async function listSnapshots(databaseId: string) {
  return mongoCollection("database_snapshots").find(
    { database_id: databaseId },
    { projection: { id: 1, label: 1, created_at: 1 } }
  ).sort({ created_at: -1 }).toArray();
}

export async function getSnapshot(databaseId: string, snapshotId: string): Promise<any> {
  return mongoCollection("database_snapshots").findOne({ _id: snapshotId, database_id: databaseId });
}

export async function getInitialSnapshot(databaseId: string): Promise<any> {
  return mongoCollection("database_snapshots").find({ database_id: databaseId }).sort({ created_at: 1 }).limit(1).next();
}

export async function listFeatureFlags() {
  return mongoCollection("feature_flags").find().sort({ key: 1 }).toArray();
}

export async function setFeatureFlag(key: string, enabled: boolean, config: unknown): Promise<void> {
  await mongoCollection("feature_flags").updateOne(
    { key },
    { $set: { enabled, config, updated_at: new Date() }, $setOnInsert: { id: key, created_at: new Date() } },
    { upsert: true }
  );
}

export async function deleteWorkspaceRecords(databaseId: string): Promise<void> {
  await Promise.all([
    mongoCollection("schema_imports").deleteMany({ database_id: databaseId }),
    mongoCollection("database_snapshots").deleteMany({ database_id: databaseId }),
    mongoCollection("question_sets").deleteMany({ database_id: databaseId }),
    mongoCollection("challenges").deleteMany({ database_id: databaseId }),
    mongoCollection("attempts").deleteMany({ database_id: databaseId }),
    mongoCollection("question_collections").deleteMany({ database_id: databaseId })
  ]);
}