import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowLeft, ArrowRight, Clock3, Database, Play, SkipForward } from "lucide-react";
import "./timed-interview.css";

type TrackId = "sql-interview-lab" | "python-etl" | "pyspark-foundations" | "azure-data-factory" | "databricks-delta" | "etl-data-quality";
type Track = { id: TrackId; title: string; mode: "sql" | "learning"; language: "sql" | "python" | "text" };
type DatabaseWorkspace = { id: string; name: string; schema_name: string; dialect: string };
type SchemaColumn = { column_name: string; data_type: string; is_nullable?: string };
type SchemaTable = { name: string; columns: SchemaColumn[] };
type TablePreview = { table: string; columns: string[]; rows: Record<string, unknown>[]; total: number; limit: number; offset: number };
type PublicExample = { input: unknown; expected: unknown };
type InterviewQuestion = {
  id: string;
  title: string;
  prompt?: string;
  task?: string;
  topic: string;
  difficulty: string;
  type?: string;
  starter_code?: string;
  input_description?: string;
  output_description?: string;
  public_examples?: PublicExample[];
};
type LearningSession = {
  id: string;
  module_id: TrackId;
  status: string;
  duration_seconds: number;
  deadline_at: string;
  question_started_at: string;
  questions: InterviewQuestion[];
  responses: { question_id: string; answer: string; skipped?: boolean; feedback_status?: string; feedback?: { score?: number; correctness: number; completeness: number; reasoning: number; tradeoffs: number; strengths: string[]; gaps: string[]; referenceAnswer: string; followUpQuestion: string } }[];
  score?: number | null;
  unanswered_count?: number;
  revision_recommendations?: string[];
};
type SqlSession = { sessionId: string; startedAt: string; durationSeconds: number; questions: InterviewQuestion[] };
type SqlReview = { questionId: string; referenceSql: string; task: string };

const API = "";
const tracks: Track[] = [
  { id: "sql-interview-lab", title: "SQL", mode: "sql", language: "sql" },
  { id: "python-etl", title: "Python", mode: "learning", language: "python" },
  { id: "pyspark-foundations", title: "PySpark", mode: "learning", language: "python" },
  { id: "azure-data-factory", title: "Azure Data Factory", mode: "learning", language: "text" },
  { id: "databricks-delta", title: "Databricks & Delta Lake", mode: "learning", language: "text" },
  { id: "etl-data-quality", title: "ETL Testing", mode: "learning", language: "text" },
];

function clock(seconds: number) {
  return `${Math.floor(Math.max(seconds, 0) / 60)}:${String(Math.max(seconds, 0) % 60).padStart(2, "0")}`;
}

export default function TimedInterview() {
  const requestedTrack = new URLSearchParams(location.search).get("track") as TrackId | null;
  const [trackId, setTrackId] = useState<TrackId>(tracks.some((track) => track.id === requestedTrack) ? requestedTrack! : "sql-interview-lab");
  const [databases, setDatabases] = useState<DatabaseWorkspace[]>([]);
  const [databaseId, setDatabaseId] = useState("");
  const [schema, setSchema] = useState<{ schemaName: string; tables: SchemaTable[] } | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [previewTable, setPreviewTable] = useState("");
  const [tablePreview, setTablePreview] = useState<TablePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [count, setCount] = useState(5);
  const [countInput, setCountInput] = useState("5");
  const [durationSeconds, setDurationSeconds] = useState(1800);
  const [difficulty, setDifficulty] = useState("mixed");
  const [sqlSession, setSqlSession] = useState<SqlSession | null>(null);
  const [learningSession, setLearningSession] = useState<LearningSession | null>(null);
  const [sessionMode, setSessionMode] = useState<"sql" | "learning" | null>(null);
  const [index, setIndex] = useState(0);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [sqlAnswers, setSqlAnswers] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState("");
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [score, setScore] = useState<any>(null);
  const [sqlReview, setSqlReview] = useState<Record<string, SqlReview>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const advancing = useRef(false);
  const finishing = useRef(false);

  const track = tracks.find((item) => item.id === trackId) || tracks[0];
  const usesDatasetContext = track.mode === "sql" || track.id === "python-etl" || track.id === "pyspark-foundations";
  const session = sessionMode === "sql" ? sqlSession : learningSession;
  const questions = session?.questions || [];
  const activeQuestion = questions[index];
  const publicExamples = activeQuestion?.public_examples || [];
  const activeExample = publicExamples[exampleIndex] || publicExamples[0];
  const dataset = databases.find((item) => item.id === databaseId);
  const questionSeconds = Math.max(30, Math.floor(durationSeconds / count));
  const validCountInput = Number.isInteger(Number(countInput)) && Number(countInput) >= 1 && Number(countInput) <= 50;
  const questionRemaining = questionStartedAt ? Math.max(0, questionSeconds - Math.floor((now - questionStartedAt) / 1000)) : questionSeconds;
  const overallDeadline = sessionMode === "sql" && sqlSession
    ? new Date(new Date(sqlSession.startedAt).getTime() + sqlSession.durationSeconds * 1000).getTime()
    : learningSession ? new Date(learningSession.deadline_at).getTime() : 0;
  const overallRemaining = overallDeadline ? Math.max(0, Math.floor((overallDeadline - now) / 1000)) : 0;
  const isActive = Boolean(session && (sessionMode === "sql" || learningSession?.status !== "completed"));

  useEffect(() => {
    fetch(`${API}/api/databases`, { credentials: "include" }).then(async (response) => {
      if (response.status === 401) { location.href = "/login"; return; }
      if (!response.ok) throw new Error("Could not load SQL datasets.");
      const items = await response.json() as DatabaseWorkspace[];
      setDatabases(items);
      const requestedDatabase = new URLSearchParams(location.search).get("databaseId");
      setDatabaseId(items.find((item) => item.id === requestedDatabase)?.id || items[0]?.id || "");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load SQL datasets."));
  }, []);

  useEffect(() => {
    if (!usesDatasetContext || !databaseId) { setSchema(null); setPreviewTable(""); return; }
    const controller = new AbortController();
    setSchema(null);
    setSchemaLoading(true);
    fetch(`${API}/api/databases/${databaseId}/schema`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this dataset's schema.");
        const raw = await response.json();
        const data = {
          schemaName: String(raw.schemaName ?? raw.schema_name ?? dataset?.schema_name ?? ""),
          tables: (Array.isArray(raw.tables) ? raw.tables : []).map((table: any) => ({
            name: String(table.name ?? table.table_name ?? ""),
            columns: (Array.isArray(table.columns) ? table.columns : []).map((column: any) => ({
              column_name: String(typeof column === "string" ? column : column.column_name ?? column.columnName ?? column.name ?? ""),
              data_type: String(column.data_type ?? column.dataType ?? column.udt_name ?? column.type ?? "unknown"),
              is_nullable: column.is_nullable == null && column.isNullable == null ? undefined : String(column.is_nullable ?? column.isNullable),
            })).filter((column: SchemaColumn) => column.column_name),
          })).filter((table: SchemaTable) => table.name),
        };
        setSchema(data);
        setPreviewTable((current) => data.tables.some((table: SchemaTable) => table.name === current) ? current : data.tables[0]?.name || "");
      })
      .catch((cause) => { if (cause.name !== "AbortError") setError(cause instanceof Error ? cause.message : "Could not load this dataset's schema."); })
      .finally(() => { if (!controller.signal.aborted) setSchemaLoading(false); });
    return () => controller.abort();
  }, [usesDatasetContext, databaseId, dataset?.schema_name]);

  useEffect(() => {
    if (!usesDatasetContext || !databaseId || !previewTable) {
      setTablePreview(null);
      setPreviewError("");
      return;
    }
    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError("");
    fetch(`${API}/api/databases/${databaseId}/tables/${encodeURIComponent(previewTable)}/rows?limit=10`, {
      credentials: "include",
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load table rows.");
      setTablePreview(result);
    }).catch((cause) => {
      if (cause.name !== "AbortError") {
        setTablePreview(null);
        setPreviewError(cause instanceof Error ? cause.message : "Could not load table rows.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewLoading(false);
    });
    return () => controller.abort();
  }, [databaseId, previewTable, usesDatasetContext]);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const schemaTables = useMemo(() => schema?.tables || [], [schema]);

  async function start() {
    setBusy(true);
    setError("");
    setScore(null);
    finishing.current = false;
    try {
      const isSql = track.mode === "sql";
      const response = await fetch(`${API}/api/interview/${isSql ? "start" : "learning/start"}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isSql
          ? { databaseId, count, difficulty, durationSeconds }
          : { moduleId: track.id, difficulty, count, durationSeconds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start interview.");
      setCount(data.questions?.length || count);
      setIndex(0);
      setExampleIndex(0);
      setSqlAnswers({});
      setAnswer(data.questions?.[0]?.starter_code || "");
      setQuestionStartedAt(Date.now());
      setNow(Date.now());
      setSessionMode(isSql ? "sql" : "learning");
      if (isSql) setSqlSession(data);
      else setLearningSession(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start interview.");
    } finally {
      setBusy(false);
    }
  }

  async function finishInterview(finalSqlAnswers = sqlAnswers) {
    if (!sessionMode || finishing.current) return;
    finishing.current = true;
    setBusy(true);
    setError("");
    try {
      if (sessionMode === "sql" && sqlSession) {
        const response = await fetch(`${API}/api/interview/score`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewSessionId: sqlSession.sessionId,
            answers: sqlSession.questions.map((question) => ({ questionId: question.id, sql: finalSqlAnswers[question.id] || "" })),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Interview could not be scored.");
        setScore(result);
        const reviewResponse = await fetch(`${API}/api/interview/${sqlSession.sessionId}/review`, { credentials: "include" });
        const review = await reviewResponse.json();
        if (!reviewResponse.ok) throw new Error(review.error || "Interview solutions could not be loaded.");
        setSqlReview(Object.fromEntries((review as SqlReview[]).map((item) => [item.questionId, item])));
      } else if (learningSession) {
        const response = await fetch(`${API}/api/interview/learning/${learningSession.id}/finish`, { method: "POST", credentials: "include" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Interview could not be completed.");
        setLearningSession(result.session);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Interview could not be completed.");
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  }

  async function advance(skip: boolean) {
    if (!activeQuestion || !sessionMode || advancing.current) return;
    advancing.current = true;
    setBusy(true);
    setError("");
    try {
      if (sessionMode === "learning" && learningSession) {
        const response = await fetch(`${API}/api/interview/learning/${learningSession.id}/${skip ? "skip" : "answer"}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(skip ? { questionId: activeQuestion.id } : { questionId: activeQuestion.id, answer }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Your response could not be saved.");
        setLearningSession((current) => current ? {
          ...current,
          responses: [...(current.responses || []), result.response],
          question_started_at: new Date().toISOString(),
        } : current);
      } else if (sessionMode === "sql") {
        const nextAnswers = { ...sqlAnswers, [activeQuestion.id]: skip ? "" : answer };
        const response = await fetch(`${API}/api/interview/${sqlSession?.sessionId}/answer`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: activeQuestion.id, sql: skip ? "" : answer, skipped: skip }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "SQL answer could not be saved.");
        setSqlAnswers(nextAnswers);
        if (index + 1 >= questions.length) {
          setIndex(questions.length);
          await finishInterview(nextAnswers);
          return;
        }
      }
      if (index + 1 >= questions.length) {
        setIndex(questions.length);
        await finishInterview();
      } else {
        setIndex((current) => current + 1);
        setExampleIndex(0);
        const nextQuestion = questions[index + 1];
        setAnswer(nextQuestion?.starter_code || "");
        setQuestionStartedAt(Date.now());
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your response could not be saved.");
    } finally {
      advancing.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isActive || !activeQuestion || busy) return;
    if (overallRemaining <= 0) {
      void finishInterview();
      return;
    }
    if (questionRemaining <= 0) void advance(true);
  }, [activeQuestion, busy, isActive, overallRemaining, questionRemaining]);

  const currentQuestionType = activeQuestion?.type;
  const language = sessionMode === "sql" ? "sql" : track.language === "python" ? "python" : "text";

  if (score || learningSession?.status === "completed") {
    const finalScore = score?.score ?? learningSession?.score;
    const sqlQuestions = sqlSession?.questions || [];
    const learningResponses = learningSession?.responses || [];
    return <main className="timedInterviewPage dataInterviewPage">
      <header className="timedInterviewHeader"><a href="/"><ArrowLeft size={15} /> Learning path</a><span>INTERVIEW REPORT</span></header>
      <section className="timedInterviewReport"><span className="timedInterviewEyebrow">{track.title} timed practice</span><h1>Session complete</h1>
        <div className="timedInterviewMetrics"><div><strong>{finalScore === null || finalScore === undefined ? "—" : `${finalScore}%`}</strong><span>{sessionMode === "sql" ? "Verified query score" : "AI rubric score"}</span></div><div><strong>{score?.correct ?? learningSession?.responses?.filter((response) => response.feedback).length ?? 0}</strong><span>{sessionMode === "sql" ? `Correct answers · ${score?.total || 0} total` : "Responses evaluated"}</span></div><div><strong>{learningSession?.unanswered_count ?? 0}</strong><span>Unanswered or skipped</span></div></div>
        {learningSession?.revision_recommendations?.length ? <section className="timedInterviewReview"><h2>Recommended review</h2><ul>{learningSession.revision_recommendations.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
        {sessionMode === "learning" && learningSession && <section className="timedInterviewAnswerReviews"><h2>Question-by-question feedback</h2>{learningSession.questions.map((question, questionIndex) => {
          const response = learningResponses.find((item) => item.question_id === question.id);
          const feedback = response?.feedback;
          return <article className="timedInterviewAnswerReview" key={question.id}><h3>Q{questionIndex + 1} · {question.title}</h3>
            <p><strong>Your response</strong>{response?.skipped ? "Skipped or timed out." : response?.answer || "No answer was saved."}</p>
            {feedback ? <>
              <div className="timedInterviewFeedbackGrid">{(["correctness", "completeness", "reasoning", "tradeoffs"] as const).map((criterion) => <div key={criterion}><strong>{feedback[criterion]}/5</strong><span>{criterion}</span></div>)}</div>
              <p><strong>Question score</strong>{feedback.score}/100</p>
              <div className="timedInterviewFeedbackLists"><div><h4>What you did well</h4>{feedback.strengths.length ? <ul>{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No specific strengths were identified.</p>}</div><div><h4 className="feedbackGaps">What to improve</h4>{feedback.gaps.length ? <ul>{feedback.gaps.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No major gaps were identified.</p>}</div></div>
              <div className="timedInterviewReference"><strong>Example of a strong answer</strong><p>{feedback.referenceAnswer}</p><strong>Follow-up to consider</strong><p>{feedback.followUpQuestion}</p></div>
            </> : <p>{response?.feedback_status === "skipped" ? "Skipped answers are not scored." : "Detailed AI feedback was unavailable for this response."}</p>}
          </article>;
        })}</section>}
        {score?.details?.map((item: any, questionIndex: number) => <article className="timedInterviewScoreDetail" key={item.questionId}><strong>Q{questionIndex + 1} · {sqlQuestions[questionIndex]?.title || "SQL answer"} · {item.correct ? "100/100 · Correct" : "0/100 · Needs improvement"}</strong>
          {item.correct ? <p>Your query ran successfully and matched the expected result.</p> : item.error ? <p className="failedFeedback"><strong>What went wrong:</strong> {item.error}<br /><strong>Next step:</strong> Fix the reported SQL issue, then verify the selected columns, filters, and sorting against the prompt.</p> : <p className="failedFeedback">The query ran, but its result did not match the expected rows. Recheck the requested columns and filtering conditions; compare NULL handling and ordering if they are part of the task.</p>}
          {item.executionMs ? <small>Execution time: {item.executionMs} ms</small> : null}
          {sqlAnswers[item.questionId] ? <><strong>Your query</strong><pre>{sqlAnswers[item.questionId]}</pre></> : <p>No query was submitted (skipped or timed out).</p>}
          {!item.correct && sqlReview[item.questionId]?.referenceSql && <div className="timedInterviewReference"><strong>One correct reference query</strong><pre>{sqlReview[item.questionId].referenceSql}</pre></div>}
        </article>)}
        {error && <div className="timedInterviewAlert" role="alert">{error}</div>}
        <a className="timedInterviewButton" href={`/interview?track=${trackId}`}>Start another interview</a>
      </section>
    </main>;
  }

  return <main className="timedInterviewPage dataInterviewPage">
    <header className="timedInterviewHeader"><a href="/"><ArrowLeft size={15} /> Back to learning</a><span>TIME-BOUND PRACTICE</span></header>
    <section className="timedInterviewIntro"><span className="timedInterviewEyebrow">INTERVIEW MODE</span><h1>Practice under<br />real interview timing.</h1><p>One question at a time. Each question has its own countdown, and the session also has a hard time limit.</p></section>
    {error && <div className="timedInterviewAlert" role="alert">{error}</div>}
    {!isActive ? <section className="timedInterviewSetup">
      <h2>Configure your interview</h2>
      <label>Practice track<select value={trackId} onChange={(event) => { setTrackId(event.target.value as TrackId); setError(""); }}>{
        tracks.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)
      }</select></label>
      {usesDatasetContext && <label>Dataset<select value={databaseId} onChange={(event) => setDatabaseId(event.target.value)}>{databases.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      <div className="timedInterviewOptions">
        <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="mixed">Mixed</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
        <label>Number of questions<input type="number" inputMode="numeric" min={1} max={50} step={1} value={countInput} onChange={(event) => { setCountInput(event.target.value); const parsed = Number(event.target.value); if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 50) setCount(parsed); }} onBlur={() => setCountInput(String(count))} aria-describedby="interview-count-help" /><small id="interview-count-help">Choose 1–50 questions.</small></label>
        <label>Session time<select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))}><option value={900}>15 minutes</option><option value={1800}>30 minutes</option><option value={3600}>60 minutes</option></select></label>
      </div>
      {usesDatasetContext && <section className="timedInterviewSchema">
        <div className="timedInterviewSchemaTitle"><Database size={16} /><span><strong>{dataset?.name || "Selected dataset"}</strong><small>{schema?.schemaName ? `Schema: ${schema.schemaName}` : schemaLoading ? "Loading schema…" : "Schema unavailable"}</small></span></div>
        {schemaTables.length ? <div className="timedInterviewTables">{schemaTables.map((table) => <details key={table.name}><summary>{table.name}<small>{table.columns.length} columns</small></summary><ul>{table.columns.map((column) => <li key={column.column_name}><code>{column.column_name}</code><span>{column.data_type}{column.is_nullable === "NO" ? " · required" : ""}</span></li>)}</ul></details>)}</div> : <p>{schemaLoading ? "Inspecting dataset tables…" : "No table schema is available for this dataset."}</p>}
        {schemaTables.length > 0 && <div className="timedInterviewSetupPreview">
          <label>Preview table<select value={previewTable} onChange={(event) => setPreviewTable(event.target.value)}>{schemaTables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}</select></label>
          <div className="timedInterviewSidebarDataHeading"><strong>TABLE DATA</strong><span>{tablePreview ? `${tablePreview.rows.length} of ${tablePreview.total} rows` : "First 10 rows"}</span></div>
          {previewLoading ? <p className="timedInterviewTableNotice">Loading table rows…</p> : previewError ? <p className="timedInterviewTableNotice error" role="alert">{previewError}</p> : tablePreview?.rows.length ? <div className="timedInterviewDataTable"><table><thead><tr>{tablePreview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{tablePreview.rows.map((row, rowIndex) => <tr key={rowIndex}>{tablePreview.columns.map((column) => <td key={column}>{row[column] == null ? <i>NULL</i> : String(row[column])}</td>)}</tr>)}</tbody></table></div> : !previewLoading && <p className="timedInterviewTableNotice">This table has no rows to preview.</p>}
        </div>}
      </section>}
      {track.mode === "learning" && <p className="timedInterviewNote">{usesDatasetContext ? "Your selected dataset schema and sample rows will stay visible beside Python/PySpark questions." : track.language === "python" ? "Coding questions open an in-browser editor. Responses are reviewed with the interview rubric." : "Scenario questions are answered in the response editor and reviewed with the interview rubric."}</p>}
      <button className="timedInterviewButton" disabled={busy || !validCountInput || (usesDatasetContext && (!databaseId || !schema || schemaLoading))} onClick={() => void start()}><Play size={15} />{busy ? "Starting…" : "Start timed interview"}</button>
    </section> : activeQuestion ? <section className="timedInterviewWorkspace">
      <div className="timedInterviewSessionBar"><span>{track.title} · Question {index + 1} of {questions.length}</span><div><span><Clock3 size={14} /> Question {clock(questionRemaining)}</span><span>Session {clock(overallRemaining)}</span></div></div>
      <div className={`timedInterviewColumns ${sessionMode === "sql" || sessionMode === "learning" ? "hasTableSidebar" : ""}`}>
        <div className="timedInterviewMainColumn">
          <div className="timedInterviewQuestionHeading"><div><span>{activeQuestion.difficulty}</span><span>{activeQuestion.topic}</span></div><h2>{activeQuestion.title}</h2><p>{activeQuestion.task || activeQuestion.prompt}</p></div>
          <div className={`timedInterviewEditor ${sessionMode === "sql" ? "sqlEditor" : ""}`}>
            <div className="timedInterviewEditorHeading"><strong>{sessionMode === "sql" ? "SQL EDITOR" : currentQuestionType === "coding" ? `${track.title.toUpperCase()} EDITOR` : "RESPONSE EDITOR"}</strong><small>Autosave disabled · submit before the question timer expires</small></div>
            <CodeMirror value={sessionMode === "sql" ? (sqlAnswers[activeQuestion.id] ?? answer) : answer} height="360px" extensions={language === "python" ? [python()] : []} theme={oneDark} editable={!busy} onChange={(value) => setAnswer(value.slice(0, 8000))} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} />
          </div>
          <div className="timedInterviewActions"><button className="timedInterviewSkip" disabled={busy} onClick={() => void advance(true)}><SkipForward size={15} />Skip question</button><button className="timedInterviewButton" disabled={busy || !answer.trim()} onClick={() => void advance(false)}>{busy ? "Saving…" : index + 1 === questions.length ? "Submit final answer" : "Submit and continue"}<ArrowRight size={15} /></button></div>
        </div>
        {sessionMode === "sql" && schema && <aside className="timedInterviewTableSidebar" aria-label="Dataset table preview">
          <header><Database size={15} /><span><strong>{dataset?.name || "Selected dataset"}</strong><small>{schema.schemaName}</small></span></header>
          <label>Table<select value={previewTable} onChange={(event) => setPreviewTable(event.target.value)}>{schemaTables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}</select></label>
          {schemaTables.find((table) => table.name === previewTable) && <div className="timedInterviewSidebarColumns"><strong>COLUMNS</strong><ul>{schemaTables.find((table) => table.name === previewTable)?.columns.map((column) => <li key={column.column_name}><code>{column.column_name}</code><span>{column.data_type}</span></li>)}</ul></div>}
          <div className="timedInterviewSidebarDataHeading"><strong>TABLE DATA</strong><span>{tablePreview ? `${tablePreview.rows.length} of ${tablePreview.total} rows` : "First 10 rows"}</span></div>
          {previewLoading ? <p className="timedInterviewTableNotice">Loading table rows…</p> : previewError ? <p className="timedInterviewTableNotice error" role="alert">{previewError}</p> : tablePreview?.rows.length ? <div className="timedInterviewDataTable"><table><thead><tr>{tablePreview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{tablePreview.rows.map((row, rowIndex) => <tr key={rowIndex}>{tablePreview.columns.map((column) => <td key={column}>{row[column] == null ? <i>NULL</i> : String(row[column])}</td>)}</tr>)}</tbody></table></div> : <p className="timedInterviewTableNotice">This table has no rows to preview.</p>}
        </aside>}
        {sessionMode === "learning" && <aside className="timedInterviewTableSidebar" aria-label={`${track.title} dataset and question data`}>
          {usesDatasetContext && schema && <>
          <header><Database size={15} /><span><strong>{dataset?.name || "Selected dataset"}</strong><small>{schema.schemaName}</small></span></header>
          <label>Dataset table<select value={previewTable} onChange={(event) => setPreviewTable(event.target.value)}>{schemaTables.map((table) => <option key={table.name} value={table.name}>{table.name}</option>)}</select></label>
          {schemaTables.find((table) => table.name === previewTable) && <div className="timedInterviewSidebarColumns"><strong>SCHEMA · {previewTable}</strong><ul>{schemaTables.find((table) => table.name === previewTable)?.columns.map((column) => <li key={column.column_name}><code>{column.column_name}</code><span>{column.data_type}</span></li>)}</ul></div>}
          <div className="timedInterviewSidebarDataHeading"><strong>DATASET SAMPLE</strong><span>{tablePreview ? `${tablePreview.rows.length} of ${tablePreview.total} rows` : "First 10 rows"}</span></div>
          {previewLoading ? <p className="timedInterviewTableNotice">Loading table rows…</p> : previewError ? <p className="timedInterviewTableNotice error" role="alert">{previewError}</p> : tablePreview?.rows.length ? <div className="timedInterviewDataTable"><table><thead><tr>{tablePreview.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{tablePreview.rows.map((row, rowIndex) => <tr key={rowIndex}>{tablePreview.columns.map((column) => <td key={column}>{row[column] == null ? <i>NULL</i> : String(row[column])}</td>)}</tr>)}</tbody></table></div> : !previewLoading && <p className="timedInterviewTableNotice">This table has no rows to preview.</p>}
          <div className="timedInterviewSidebarDataHeading"><strong>QUESTION CONTEXT</strong></div>
          </>}
          <header><Database size={15} /><span><strong>{track.title} · question data</strong><small>{activeQuestion.title}</small></span></header>
          {activeQuestion.input_description && <section className="timedInterviewExampleDescription"><strong>INPUT / DATA SHAPE</strong><p>{activeQuestion.input_description}</p></section>}
          {publicExamples.length > 1 && <label>Example<select value={exampleIndex} onChange={(event) => setExampleIndex(Number(event.target.value))}>{publicExamples.map((_example, exampleNumber) => <option value={exampleNumber} key={exampleNumber}>Example {exampleNumber + 1}</option>)}</select></label>}
          {activeExample ? <>
            <div className="timedInterviewSidebarDataHeading"><strong>INPUT DATA</strong><span>Example {exampleIndex + 1}</span></div>
            <pre className="timedInterviewExampleJson">{JSON.stringify(activeExample.input, null, 2)}</pre>
            <div className="timedInterviewSidebarDataHeading"><strong>EXPECTED OUTPUT</strong></div>
            <pre className="timedInterviewExampleJson">{JSON.stringify(activeExample.expected, null, 2)}</pre>
          </> : <p className="timedInterviewTableNotice">This question does not include a sample input/output record.</p>}
          {activeQuestion.output_description && <section className="timedInterviewExampleDescription"><strong>OUTPUT SHAPE</strong><p>{activeQuestion.output_description}</p></section>}
          {track.language === "text" && !activeQuestion.input_description && !activeExample && <section className="timedInterviewExampleDescription"><strong>SCENARIO</strong><p>{activeQuestion.prompt || activeQuestion.task || "Use the question statement to reason through your response."}</p></section>}
        </aside>}
      </div>
    </section> : <section className="timedInterviewWorkspace timedInterviewFinishing">
      {busy ? <><h2>Finishing your interview…</h2><p>Your saved answers are being scored and reviewed.</p></> : <>
        <h2>Interview could not be finished</h2>
        <p>{error || "Your answers are saved. Try finishing again to load your results."}</p>
        <button className="timedInterviewButton" disabled={busy} onClick={() => void finishInterview()}><Play size={15} />Try finishing again</button>
      </>}
    </section>}
  </main>;
}
