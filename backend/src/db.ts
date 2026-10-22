import "dotenv/config";
import crypto from "node:crypto";
import pg from "pg";
import { parse as parsePgConnectionString } from "pg-connection-string";
import type { PoolClient, FieldDef, PoolConfig } from "pg";
import { connectMongo, mongoCollection } from "./mongo.js";
import { limitPracticeResult, validatePracticeImport, validatePracticeRead } from "./sql-guard.js";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_SIZE ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

const practicePools = new Map<string, any>();
let tempFileLimitWarningShown = false;

async function configurePracticeRoleTempFileLimit(role: string): Promise<void> {
 try {
  await pool.query(`ALTER ROLE ${role} SET temp_file_limit='64MB'`);
 } catch (error) {
  if ((error as any).code !== '42501') throw error;
  if (!tempFileLimitWarningShown) {
   tempFileLimitWarningShown = true;
   console.warn('Database provider denied temp_file_limit for practice roles; statement timeouts, read-only transactions, and result limits remain enabled.');
  }
 }
}

export function derivePracticeRoleCredentials(schemaName: string, secret = process.env.PRACTICE_ROLE_SECRET || process.env.AUTH_SECRET) {
 if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))throw new Error('Invalid schema name');
 if(!secret)throw new Error('PRACTICE_ROLE_SECRET or AUTH_SECRET must be configured');
 return {name:`practice_${crypto.createHash('sha256').update(schemaName).digest('hex').slice(0,24)}`,password:crypto.createHmac('sha256',secret).update(schemaName).digest('base64url')};
}
function getPracticePool(schemaName:string){
 const connectionString=process.env.PRACTICE_DATABASE_URL||(process.env.NODE_ENV==='production'?undefined:process.env.DATABASE_URL);
 if(!connectionString)throw new Error('PRACTICE_DATABASE_URL must be configured for isolated SQL execution');
 if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))throw new Error('Invalid schema name');
 let practicePool=practicePools.get(schemaName);
 if(practicePool){practicePools.delete(schemaName);practicePools.set(schemaName,practicePool);return practicePool}
 if(practicePools.size>=64){const idle=[...practicePools].find(([,cached])=>cached.totalCount===cached.idleCount);if(!idle)throw new Error('Practice execution capacity is full');practicePools.delete(idle[0]);void idle[1].end()}
 const role=derivePracticeRoleCredentials(schemaName),parsed=parsePgConnectionString(connectionString),parsedSsl=parsed.ssl,ssl=typeof parsedSsl==='string'?parsedSsl==='true'||parsedSsl==='1':parsedSsl&&typeof parsedSsl==='object'?Object.fromEntries(Object.entries(parsedSsl).filter(([,value])=>value!==null)) as PoolConfig['ssl']:parsedSsl??undefined;practicePool=new Pool({...parsed,host:parsed.host??undefined,port:parsed.port?Number(parsed.port):undefined,database:parsed.database??undefined,ssl,user:role.name,password:role.password,max:1,idleTimeoutMillis:10_000,connectionTimeoutMillis:5_000});practicePools.set(schemaName,practicePool);
 return practicePool;
}

async function connectPracticeClient(schemaName: string): Promise<PoolClient> {
 const practicePool = getPracticePool(schemaName);
 try {
  return await practicePool.connect();
 } catch (error) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "28P01") throw error;
  if (practicePools.get(schemaName) === practicePool) practicePools.delete(schemaName);
  await practicePool.end();
  await grantPracticeSchema(schemaName);
  return await getPracticePool(schemaName).connect();
 }
}

export async function closePracticePools():Promise<void>{await Promise.all([...practicePools.values()].map((practicePool)=>practicePool.end()));practicePools.clear()}
export async function dropPracticeSchema(schemaName:string):Promise<void>{if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))throw new Error('Invalid schema name');const cached=practicePools.get(schemaName);if(cached){practicePools.delete(schemaName);await cached.end()}await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`);const role=derivePracticeRoleCredentials(schemaName);await pool.query(`DROP ROLE IF EXISTS ${quoteIdent(role.name)}`)}

export async function withClient<T>(fn:(client:PoolClient)=>Promise<T>):Promise<T>{const c=await pool.connect();try{return await fn(c)}finally{c.release()}}

export async function initDb(){
 await connectMongo();
 if(!process.env.DATABASE_URL)return;
 await pool.query(`
 CREATE TABLE IF NOT EXISTS app_databases(id UUID PRIMARY KEY,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,schema_name TEXT UNIQUE NOT NULL,dialect TEXT NOT NULL DEFAULT 'postgresql',description TEXT DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS challenges(id UUID PRIMARY KEY,database_id UUID NOT NULL REFERENCES app_databases(id) ON DELETE CASCADE,title TEXT NOT NULL,difficulty TEXT NOT NULL,topic TEXT NOT NULL,context TEXT NOT NULL,task TEXT NOT NULL,required_output TEXT NOT NULL,reference_sql TEXT NOT NULL,expected_json JSONB NOT NULL,tags JSONB NOT NULL DEFAULT '[]'::jsonb,source TEXT NOT NULL DEFAULT 'ai',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS attempts(id UUID PRIMARY KEY,challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,database_id UUID NOT NULL REFERENCES app_databases(id) ON DELETE CASCADE,session_id TEXT NOT NULL,sql TEXT NOT NULL,correct BOOLEAN NOT NULL DEFAULT false,execution_ms INTEGER NOT NULL DEFAULT 0,error TEXT,actual_json JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS attempts_challenge_idx ON attempts(challenge_id,created_at DESC);
 CREATE INDEX IF NOT EXISTS attempts_session_idx ON attempts(session_id,created_at DESC);
  ALTER TABLE attempts ADD COLUMN IF NOT EXISTS is_revision BOOLEAN NOT NULL DEFAULT false;
  CREATE TABLE IF NOT EXISTS question_revision_marks(session_id TEXT NOT NULL,challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),PRIMARY KEY(session_id,challenge_id));
 CREATE TABLE IF NOT EXISTS question_sets(id UUID PRIMARY KEY,database_id UUID NOT NULL REFERENCES app_databases(id) ON DELETE CASCADE,name TEXT NOT NULL,count_requested INTEGER NOT NULL,accepted_count INTEGER NOT NULL DEFAULT 0,rejected_count INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',settings JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 ALTER TABLE challenges ADD COLUMN IF NOT EXISTS question_set_id UUID REFERENCES question_sets(id) ON DELETE SET NULL;
 CREATE INDEX IF NOT EXISTS challenges_question_set_idx ON challenges(question_set_id);
 UPDATE challenges c SET question_set_id=(SELECT qs.id FROM question_sets qs WHERE qs.database_id=c.database_id AND qs.created_at<=c.created_at ORDER BY qs.created_at DESC LIMIT 1) WHERE c.question_set_id IS NULL AND EXISTS(SELECT 1 FROM question_sets qs WHERE qs.database_id=c.database_id AND qs.created_at<=c.created_at);
 CREATE OR REPLACE FUNCTION assign_running_question_set() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.question_set_id IS NULL THEN SELECT id INTO NEW.question_set_id FROM question_sets WHERE database_id=NEW.database_id AND status='running' ORDER BY created_at DESC LIMIT 1; END IF; RETURN NEW; END; $$;
 DROP TRIGGER IF EXISTS challenges_assign_question_set ON challenges;
 CREATE TRIGGER challenges_assign_question_set BEFORE INSERT ON challenges FOR EACH ROW EXECUTE FUNCTION assign_running_question_set();
 CREATE TABLE IF NOT EXISTS schema_imports(id UUID PRIMARY KEY,database_id UUID NOT NULL REFERENCES app_databases(id) ON DELETE CASCADE,source_type TEXT NOT NULL,filename TEXT,raw_text TEXT,extracted_sql TEXT,review_json JSONB,status TEXT NOT NULL DEFAULT 'draft',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS database_snapshots(id UUID PRIMARY KEY,database_id UUID NOT NULL REFERENCES app_databases(id) ON DELETE CASCADE,label TEXT NOT NULL,schema_sql TEXT NOT NULL,data_sql TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS challenge_flags(id UUID PRIMARY KEY,challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,reason TEXT NOT NULL,details TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS challenges_database_idx ON challenges(database_id);
 CREATE TABLE IF NOT EXISTS users(id UUID PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',status TEXT NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),last_login_at TIMESTAMPTZ);
  ALTER TABLE app_databases ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE app_databases DROP CONSTRAINT IF EXISTS app_databases_owner_user_id_fkey;
 CREATE TABLE IF NOT EXISTS sessions(id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT UNIQUE NOT NULL,expires_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
 CREATE TABLE IF NOT EXISTS audit_logs(id UUID PRIMARY KEY,actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,resource_type TEXT,resource_id TEXT,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,ip TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
 CREATE TABLE IF NOT EXISTS question_reviews(id UUID PRIMARY KEY,challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,status TEXT NOT NULL,notes TEXT DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS question_collections(id UUID PRIMARY KEY,database_id UUID NOT NULL REFERENCES app_databases(id) ON DELETE CASCADE,name TEXT NOT NULL,description TEXT DEFAULT '',is_published BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS collection_questions(collection_id UUID NOT NULL REFERENCES question_collections(id) ON DELETE CASCADE,challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,position INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(collection_id,challenge_id));
 CREATE TABLE IF NOT EXISTS feature_flags(id UUID PRIMARY KEY,key TEXT UNIQUE NOT NULL,enabled BOOLEAN NOT NULL DEFAULT false,config JSONB NOT NULL DEFAULT '{}'::jsonb,updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
 CREATE TABLE IF NOT EXISTS api_usage_daily(day DATE PRIMARY KEY,requests BIGINT NOT NULL DEFAULT 0,ai_requests BIGINT NOT NULL DEFAULT 0,ai_input_tokens BIGINT NOT NULL DEFAULT 0,ai_output_tokens BIGINT NOT NULL DEFAULT 0,sql_runs BIGINT NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS refresh_jobs(id UUID PRIMARY KEY,job_type TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',payload JSONB NOT NULL DEFAULT '{}'::jsonb,progress INTEGER NOT NULL DEFAULT 0,error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),finished_at TIMESTAMPTZ);

 `);
 await pool.query('SELECT 1');
}

export async function grantPracticeSchema(schemaName: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) throw new Error("Invalid schema name");
  const schema = quoteIdent(schemaName);
  const roleData = derivePracticeRoleCredentials(schemaName);
  const role = quoteIdent(roleData.name);

  await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${roleData.name}') THEN CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT; END IF; END $$`);
  await pool.query(`ALTER ROLE ${role} WITH LOGIN NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${roleData.password}'`);
  await configurePracticeRoleTempFileLimit(role);
  await pool.query(`REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`);

  const legacyRole = await pool.query("SELECT 1 FROM pg_roles WHERE rolname='practice_executor'");
  if (legacyRole.rowCount) {
    await pool.query(`REVOKE ALL ON SCHEMA ${schema} FROM practice_executor`);
    await pool.query(`REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM practice_executor`);
    await pool.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${schema} FROM practice_executor`);
  }

  await pool.query(`GRANT USAGE, CREATE ON SCHEMA ${schema} TO ${role}`);
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`);
  await pool.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`);
}
export async function createPracticeSchema(schemaName:string){if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName))throw new Error("Invalid schema name");await pool.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`);await grantPracticeSchema(schemaName)}
export function quoteIdent(v:string){if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v))throw new Error("Invalid identifier");return `"${v}"`}

export async function listTables(schemaName:string){
 const t=await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name`,[schemaName]);const out:any[]=[];
 for(const row of t.rows){const c=await pool.query(`SELECT c.column_name,c.data_type,c.udt_name,c.is_nullable,c.column_default,c.ordinal_position,CASE WHEN EXISTS(SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage k ON k.constraint_name=tc.constraint_name AND k.constraint_schema=tc.constraint_schema WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_schema=c.table_schema AND tc.table_name=c.table_name AND k.column_name=c.column_name) THEN true ELSE false END is_primary_key FROM information_schema.columns c WHERE c.table_schema=$1 AND c.table_name=$2 ORDER BY c.ordinal_position`,[schemaName,row.table_name]);out.push({name:row.table_name,columns:c.rows})}return out;
}
export async function schemaSnapshot(schemaName:string){
 const tables=await listTables(schemaName);const fks=await pool.query(`SELECT tc.constraint_name,tc.table_name,kcu.column_name,ccu.table_name foreign_table_name,ccu.column_name foreign_column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.constraint_schema JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema=$1`,[schemaName]);return{schemaName,tables,relationships:fks.rows};
}

export async function executeReadOnly(schemaName:string,sql:string){
 const cleaned=validatePracticeRead(schemaName,sql);
 if(cleaned.includes(';'))throw new Error("Only one SQL statement is allowed per practice run.");
 const client=await connectPracticeClient(schemaName);const started=Date.now();try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5000ms'");await client.query("SET LOCAL idle_in_transaction_session_timeout='6000ms'");await client.query("SET LOCAL transaction_read_only=on");await client.query("SET LOCAL work_mem='16MB'");await client.query(`SET LOCAL search_path TO ${quoteIdent(schemaName)}`);const r=await client.query(`SELECT * FROM (${cleaned}) AS practice_result LIMIT 1000`);await client.query('ROLLBACK');const limited=limitPracticeResult(r.rows);return{columns:r.fields.map((f:FieldDef)=>f.name),rows:limited.rows,rowCount:r.rowCount??r.rows.length,truncated:limited.truncated||r.rows.length===1000,executionMs:Date.now()-started};}catch(e){try{await client.query('ROLLBACK')}catch{}throw e}finally{client.release()}
}

export async function executeImport(schemaName:string,sql:string){const validated=validatePracticeImport(schemaName,sql);const c=await connectPracticeClient(schemaName);try{await c.query('BEGIN');await c.query("SET LOCAL statement_timeout='30000ms'");await c.query(`SET LOCAL search_path TO ${quoteIdent(schemaName)}`);await c.query(validated);await c.query('COMMIT')}catch(e){try{await c.query('ROLLBACK')}catch{}throw e}finally{c.release()}}

export async function clearPracticeSchema(schemaName:string){await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`);await createPracticeSchema(schemaName)}
export async function schemaDDL(schemaName:string){const tables=await listTables(schemaName);const lines:string[]=[];for(const t of tables){lines.push(`CREATE TABLE ${quoteIdent(t.name)} (`);lines.push(t.columns.map((c:any)=>`  ${quoteIdent(c.column_name)} ${c.data_type.toUpperCase()}${c.is_nullable==='NO'?' NOT NULL':''}${c.is_primary_key?' PRIMARY KEY':''}`).join(',\n'));lines.push(');')}const snap=await schemaSnapshot(schemaName);for(const fk of snap.relationships)lines.push(`ALTER TABLE ${quoteIdent(fk.table_name)} ADD CONSTRAINT ${quoteIdent(fk.constraint_name)} FOREIGN KEY (${quoteIdent(fk.column_name)}) REFERENCES ${quoteIdent(fk.foreign_table_name)} (${quoteIdent(fk.foreign_column_name)});`);return lines.join('\n')}
export async function dataSQL(schemaName:string){const tables=await listTables(schemaName),relationships=(await schemaSnapshot(schemaName)).relationships,pending=new Set(tables.map(table=>table.name)),order:string[]=[];while(pending.size){const ready=[...pending].filter(table=>relationships.filter((relation:any)=>relation.table_name===table&&relation.foreign_table_name!==table).every((relation:any)=>!pending.has(relation.foreign_table_name)));if(!ready.length)throw new Error('Cannot export data with circular foreign-key dependencies');for(const table of ready){pending.delete(table);order.push(table)}}const byName=new Map(tables.map(table=>[table.name,table])),out:string[]=[];for(const name of order){const table=byName.get(name)!;const r=await pool.query(`SELECT * FROM ${quoteIdent(schemaName)}.${quoteIdent(table.name)}`);if(!r.rows.length)continue;const cols=r.fields.map(f=>quoteIdent(f.name)).join(', ');for(const row of r.rows){const vals=r.fields.map(f=>{const v=row[f.name];if(v===null)return 'NULL';if(typeof v==='number'&&!Number.isNaN(v))return String(v);if(v instanceof Date)return `'${v.toISOString().replace(/'/g,"''")}'`;return `'${String(v).replace(/'/g,"''")}'`}).join(', ');out.push(`INSERT INTO ${quoteIdent(table.name)} (${cols}) VALUES (${vals});`)}}return out.join('\n')}
export async function snapshotDatabase(databaseId:string,label:string){const d=(await pool.query('SELECT * FROM app_databases WHERE id=$1',[databaseId])).rows[0];if(!d)throw new Error('Database not found');const schema_sql=await schemaDDL(d.schema_name);const data_sql=await dataSQL(d.schema_name);const id=crypto.randomUUID();await mongoCollection('database_snapshots').insertOne({_id:id,id,database_id:databaseId,label,schema_sql,data_sql,created_at:new Date()});return{id,label}}
export async function restoreSnapshot(databaseId:string,snapshotId:string){const d=(await pool.query('SELECT * FROM app_databases WHERE id=$1',[databaseId])).rows[0],s=await mongoCollection('database_snapshots').findOne({_id:snapshotId,database_id:databaseId});if(!d||!s)throw new Error('Snapshot not found');await clearPracticeSchema(d.schema_name);await executeImport(d.schema_name,String(s.schema_sql)+'\n'+String(s.data_sql));return schemaSnapshot(d.schema_name)}

export async function ensureDemoDatabase(){
 const existing=await pool.query('SELECT * FROM app_databases WHERE slug=$1',['demo-ecommerce']);
 const id=existing.rows[0]?.id||crypto.randomUUID(),schema=existing.rows[0]?.schema_name||'demo_ecommerce';
 await createPracticeSchema(schema);
 if(existing.rowCount){
  const tables=await pool.query('SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_type=$2 LIMIT 1',[schema,'BASE TABLE']);
  if(tables.rowCount)return existing.rows[0];
 }else{
  await pool.query('INSERT INTO app_databases(id,name,slug,schema_name,description) VALUES($1,$2,$3,$4,$5)',[id,'Demo E-Commerce','demo-ecommerce',schema,'Built-in practice database for first-run testing']);
 }
 await executeImport(schema,`CREATE TABLE departments(department_id INT PRIMARY KEY,department_name TEXT NOT NULL,location TEXT);CREATE TABLE jobs(job_id TEXT PRIMARY KEY,job_title TEXT NOT NULL,min_salary NUMERIC,max_salary NUMERIC);CREATE TABLE employees(employee_id INT PRIMARY KEY,first_name TEXT,last_name TEXT,email TEXT,department_id INT,job_id TEXT,salary NUMERIC,FOREIGN KEY(department_id) REFERENCES departments(department_id),FOREIGN KEY(job_id) REFERENCES jobs(job_id));CREATE TABLE exclusion_rules(rule_id INT PRIMARY KEY,blocked_job_id TEXT,reason TEXT);INSERT INTO departments VALUES(1,'Engineering','Kolkata'),(2,'HR','Delhi'),(3,'Sales','Mumbai');INSERT INTO jobs VALUES('ENG_DEV','Developer',40000,120000),('HR_REP','HR Representative',30000,90000),('SALES_REP','Sales Representative',25000,100000),('DATA_ENG','Data Engineer',50000,140000);INSERT INTO employees VALUES(1,'Chris','Anderson','chris@example.com',3,'SALES_REP',65000),(2,'Emma','Thomas','emma@example.com',2,'HR_REP',72000),(3,'Jane','Smith','jane@example.com',2,'HR_REP',68000),(4,'Lisa','Davis','lisa@example.com',2,'HR_REP',75000),(5,'Sarah','Williams','sarah@example.com',3,'SALES_REP',71000),(6,'Tom','Wilson','tom@example.com',3,'SALES_REP',62000),(7,'Amit','Kumar','amit@example.com',1,'DATA_ENG',105000),(8,'Neha','Roy','neha@example.com',1,'ENG_DEV',98000);INSERT INTO exclusion_rules VALUES(1,'ENG_DEV','Restricted'),(2,NULL,'Legacy rule');`);
 return(await pool.query('SELECT * FROM app_databases WHERE id=$1',[id])).rows[0]
}
