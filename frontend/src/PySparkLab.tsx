import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Bookmark, Check, Clock3, Code2, Database, ExternalLink, History, Layers3, Lightbulb, Play, Send, Sparkles } from "lucide-react";
import "./pyspark-lab.css";
import "./pyspark-theme.css";
import "./pyspark-levels.css";

type Question = {
  id: string;
  title: string;
  prompt: string;
  topic: string;
  subtopic?: string;
  learning_level?: "A" | "B" | "C";
  level_title?: string;
  difficulty: string;
  starter_code: string;
  input_description: string;
  output_description: string;
  public_examples: { input: unknown; expected: Record<string, unknown>[] }[];
  hints: string[];
  bookmarked: boolean;
  completed: boolean;
};

type RunnerState = { configured: boolean; available: boolean };
type RunResult = {
  status?: string;
  correct?: boolean;
  executionMs?: number;
  tests?: { name: string; passed: boolean; status?: string }[];
  output?: { columns?: string[]; schema?: { name: string; type: string }[]; rows?: Record<string, unknown>[]; console?: string };
  message?: string;
};

const API = "";
const TABS = ["Test Cases", "Expected Output", "Hints", "Explanation", "Solution"] as const;
type Tab = typeof TABS[number];
const levelDescriptions: Record<string, string> = {
  A: "First steps: read a DataFrame, select columns, filter rows, and build simple expressions.",
  B: "Core patterns: group and join data, clean nulls, and introduce window functions.",
  C: "Interview practice: combine transformations, windows, reconciliation, and performance-aware plans.",
  all: "Browse every PySpark coding question, including the original starter exercises."
};

function renderDatasets(input: unknown) {
  if (Array.isArray(input)) return [{ name: "input", rows: input }];
  if (input && typeof input === "object") return Object.entries(input).map(([name, rows]) => ({ name, rows: Array.isArray(rows) ? rows : [] }));
  return [];
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  if (!rows.length) return <p className="sparkEmptyData">No rows in this preview.</p>;
  return <div className="sparkTableScroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{row[column] == null ? <span className="sparkNull">NULL</span> : String(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

export default function PySparkLab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState("");
  const [runner, setRunner] = useState<RunnerState>({ configured: false, available: false });
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | "" >("");
  const [activeJobId, setActiveJobId] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tab, setTab] = useState<Tab>("Test Cases");
  const [review, setReview] = useState<{ explanation: string; commonMistakes: string[]; referenceSolution: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tutorText, setTutorText] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("A");

  const visibleQuestions = useMemo(() => filter === "all" ? questions : questions.filter((item) => item.learning_level === filter), [questions, filter]);
  const levelCounts = useMemo(() => ({
    A: questions.filter((item) => item.learning_level === "A").length,
    B: questions.filter((item) => item.learning_level === "B").length,
    C: questions.filter((item) => item.learning_level === "C").length,
  }), [questions]);

  useEffect(() => {
    if (!busy) { setElapsedSeconds(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function loadHistory(id: string) {
    const response = await fetch(`${API}/api/learning/questions/${id}/attempts?limit=10`, { credentials: "include" });
    if (response.ok) setHistory(await response.json());
  }

  async function chooseQuestion(item: Question) {
    setQuestion(item);
    setCode(item.starter_code || "");
    setResult(null);
    setReview(null);
    setError("");
    setTutorText("");
    setTab("Test Cases");
    await Promise.all([loadHistory(item.id), fetch(`${API}/api/learning/questions/${item.id}/review`, { credentials: "include" }).then(async (response) => {
      if (response.ok) setReview(await response.json());
    })]);
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch(`${API}/api/learning/questions?moduleId=pyspark-foundations&type=coding&pageSize=50`, { credentials: "include" }).then(async (response) => {
        if (response.status === 401) { location.href = "/login"; return null; }
        if (!response.ok) throw new Error("PySpark questions could not be loaded.");
        return response.json();
      }),
      fetch(`${API}/api/learning/runners/status`, { credentials: "include" }).then((response) => response.ok ? response.json() : null),
    ]).then(([bank, status]) => {
      if (!mounted) return;
      const levelOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
      const items = (bank?.items || []).filter((item: Question & { language?: string }) => item.language === "pyspark")
        .sort((left: Question, right: Question) => (levelOrder[left.learning_level || "C"] - levelOrder[right.learning_level || "C"]) || left.id.localeCompare(right.id));
      setQuestions(items);
      const firstLevelQuestion = items.find((item: Question) => item.learning_level === "A") || items[0];
      if (firstLevelQuestion) void chooseQuestion(firstLevelQuestion);
      if (status?.pyspark) setRunner(status.pyspark);
    }).catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : "PySpark Lab is unavailable."); });
    return () => { mounted = false; };
  }, []);

  async function execute(submit: boolean) {
    if (!question || !code.trim()) return;
    setBusy(submit ? "submit" : "run");
    setJobStatus("queued");
    setError("");
    setResult(null);
    try {
      const response = await fetch(`${API}/api/learning/questions/${question.id}/jobs`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, mode: submit ? "submit" : "run" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Execution failed.");
      setActiveJobId(body.jobId);
      setJobStatus(body.status || "queued");
      let completedJob: any = null;
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const statusResponse = await fetch(`${API}/api/learning/jobs/${body.jobId}`, { credentials: "include" });
        const statusBody = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusBody.error || "Spark job status is unavailable.");
        setJobStatus(statusBody.status);
        if (!["queued", "running", "finalizing"].includes(statusBody.status)) {
          completedJob = statusBody;
          break;
        }
      }
      if (!completedJob) throw new Error("Spark job polling timed out. It may still be running.");
      if (completedJob.status === "cancelled") throw new Error("Spark job was cancelled.");
      const jobResult = completedJob.result || {};
      setResult({ ...jobResult, correct: jobResult.status === "passed" });
      if (submit) {
        if (jobResult.status === "passed") setQuestion((current) => current ? { ...current, completed: true } : current);
        await Promise.all([loadHistory(question.id), fetch(`${API}/api/learning/questions/${question.id}/review`, { credentials: "include" }).then(async (reviewResponse) => {
          if (reviewResponse.ok) setReview(await reviewResponse.json());
        })]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The isolated Spark runner is unavailable.");
    } finally {
      setBusy("");
      setActiveJobId("");
      setJobStatus("");
    }
  }

  async function cancelExecution() {
    if (!activeJobId) return;
    const response = await fetch(`${API}/api/learning/jobs/${activeJobId}`, { method: "DELETE", credentials: "include" });
    const body = await response.json();
    if (!response.ok) { setError(body.error || "Spark job could not be cancelled."); return; }
    setError("Spark job cancelled.");
    setBusy("");
    setActiveJobId("");
    setJobStatus("cancelled");
  }

  async function toggleBookmark() {
    if (!question) return;
    const marked = !question.bookmarked;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/bookmark`, {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marked }),
    });
    if (!response.ok) { setError("Bookmark could not be saved."); return; }
    setQuestion({ ...question, bookmarked: marked });
    setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, bookmarked: marked } : item));
  }

  async function askTutor(action: string, errorText?: string) {
    if (!question) return;
    setTutorBusy(true);
    setTutorText("");
    setError("");
    try {
      const response = await fetch(`${API}/api/ai/learning-tutor`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, action, code, error: errorText?.slice(0, 500) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI Tutor is unavailable.");
      setTutorText(`${body.basis === "theoretical" ? "Theoretical guidance, not execution output.\n\n" : ""}${body.answer}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI Tutor is unavailable."); }
    finally { setTutorBusy(false); }
  }

  async function showSolution() {
    setTab("Solution");
    if (review || !question) return;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/review`, { credentials: "include" });
    const body = await response.json();
    if (response.ok) setReview(body);
    else setError(body.error || "Submit a solution before opening the reference answer.");
  }

  const example = question?.public_examples?.[0];
  const requiredColumns = result?.output?.schema || [];

  return <main className="sparkLabPage">
    <header className="sparkLabHeader">
      <a className="sparkLabBrand" href="/"><span><Layers3 size={17} /></span><strong>Data Engineering Studio</strong></a>
      <nav aria-label="Main navigation"><a href="/">Learning path</a><a href="/sql"><Database size={15} /> SQL Lab</a><a className="active" href="/pyspark"><Code2 size={15} /> PySpark Lab</a><a href="/interview">Interview</a></nav>
      <a className="sparkLabExit" href="/learn/pyspark-foundations">Learning module <ExternalLink size={14} /></a>
    </header>
    <section className="sparkLabTitle"><div><p>REAL SPARK EXECUTION · LOCAL MODE</p><h1>PySpark Lab</h1><span>Interview exercises against a pinned Spark runtime.</span></div><div className={`sparkRunnerBadge ${runner.available ? "ready" : "offline"}`}><span />{runner.available ? "Spark runner ready" : runner.configured ? "Runner health check failed" : "Runner not configured"}</div></section>
    {error && <div className="sparkLabError" role="alert">{error}</div>}
    <div className="sparkLabLayout">
      <aside className="sparkQuestionRail" aria-label="PySpark question bank">
        <div className="sparkRailHead"><strong>QUESTION BANK</strong><span>{visibleQuestions.length}</span></div>
        <div className="sparkLevelSelector" role="tablist" aria-label="PySpark learning levels">{(["A", "B", "C", "all"] as const).map((level) => <button key={level} role="tab" aria-selected={filter === level} className={`${filter === level ? "active" : ""} level-${level.toLowerCase()}`} onClick={() => setFilter(level)}><strong>{level === "all" ? "All" : `Level ${level}`}</strong><span>{level === "all" ? questions.length : levelCounts[level]}</span></button>)}</div>
        <div className={`sparkLevelIntro level-${filter.toLowerCase()}`}><strong>{filter === "all" ? "FULL QUESTION BANK" : `LEVEL ${filter} · ${filter === "A" ? "FIRST STEPS" : filter === "B" ? "CORE PATTERNS" : "INTERVIEW PRACTICE"}`}</strong><p>{levelDescriptions[filter]}</p></div>
        {visibleQuestions.map((item, index) => <button key={item.id} className={`sparkQuestionItem ${question?.id === item.id ? "selected" : ""}`} onClick={() => void chooseQuestion(item)}><span className="sparkQuestionTitle"><em>{String(index + 1).padStart(2, "0")}</em>{item.title}</span><span className="sparkQuestionMeta">{item.topic} · {item.learning_level ? `Level ${item.learning_level}` : item.difficulty}{item.completed && <Check size={13} />}{item.bookmarked && <Bookmark size={12} />}</span></button>)}
        {!visibleQuestions.length && <p className="sparkRailEmpty">No Spark exercises match this filter.</p>}
      </aside>

      {question && <section className="sparkWorkspace">
        <div className="sparkChallengeHead"><div><div className="sparkQuestionMetaLine"><span className={`levelPill level-${question.learning_level || "A"}`}>{question.level_title || `Level ${question.learning_level || "A"}`}</span>{question.topic}{question.subtopic ? ` / ${question.subtopic}` : ""}<span>{question.difficulty}</span></div><h2>{question.title}</h2></div><button className={question.bookmarked ? "saved" : ""} onClick={() => void toggleBookmark()} aria-label={question.bookmarked ? "Remove bookmark" : "Bookmark question"} title={question.bookmarked ? "Remove bookmark" : "Bookmark question"}><Bookmark size={17} /></button></div>
        <p className="sparkPrompt">{question.prompt}</p>
        <div className="sparkDatasetStrip"><strong>Input</strong><span>{question.input_description}</span><strong>Required output</strong><span>{question.output_description}</span></div>

        <div className="sparkDatasetPreview"><div className="sparkSectionHeading"><strong>Sample DataFrames</strong><span>Public example</span></div>{example ? renderDatasets(example.input).map((dataset) => <div className="sparkDataset" key={dataset.name}><h3>{dataset.name}</h3><DataTable rows={dataset.rows} /></div>) : <p className="sparkEmptyData">No public input preview is available.</p>}</div>

        <section className="sparkEditorPanel" aria-label="PySpark coding workspace">
          <div className="sparkEditorToolbar"><span><Code2 size={15} /> Python</span><div><button onClick={() => setCode(question.starter_code || "")}>Reset</button><button className="sparkRunButton" disabled={!runner.available || !!busy || !code.trim()} onClick={() => void execute(false)}><Play size={14} />{busy === "run" ? "Queued / running" : "Run Code"}</button><button className="sparkSubmitButton" disabled={!runner.available || !!busy || !code.trim()} onClick={() => void execute(true)}><Send size={14} />{busy === "submit" ? "Queued / evaluating" : "Submit Solution"}</button>{activeJobId && <button onClick={() => void cancelExecution()}>Cancel</button>}</div></div>
          <CodeMirror value={code} height="340px" extensions={[python(), oneDark]} onChange={setCode} editable={!busy} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} />
          <div className="sparkEditorStatus"><span className={busy ? "working" : runner.available ? "ready" : "offline"} />{busy ? `${jobStatus || "queued"} · ${busy === "run" ? "public example" : "hidden tests"} · ${elapsedSeconds}s / 45s` : runner.available ? "Ready · Spark local[2] · 45s job limit" : "Execution unavailable · code is not sent to the application server"}<span>CPU and output limits enforced</span></div>
        </section>

        <section className="sparkResultsPanel"><div className="sparkTabs" role="tablist">{TABS.map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => item === "Solution" ? void showSolution() : setTab(item)}>{item}</button>)}</div>
          <div className="sparkTabContent" role="tabpanel">
            {tab === "Test Cases" && <>{result ? <><div className={`sparkRunSummary ${result.correct ? "pass" : "fail"}`}><strong>{result.correct ? "All tests passed" : result.status === "failed" ? "Execution completed with failing tests" : result.status === "error" ? "Runtime error" : result.status === "timeout" ? "Execution timed out" : result.status === "resource_limit_exceeded" ? "Resource limit exceeded" : "Execution did not complete"}</strong><span><Clock3 size={14} />{result.executionMs ?? 0} ms</span>{result.message && <p>{result.message}</p>}</div><ul className="sparkTestList">{result.tests?.map((test) => <li key={test.name}><span className={test.passed ? "passed" : "failed"}>{test.passed ? "PASS" : "FAIL"}</span>{test.name}<small>{test.status || "completed"}</small></li>)}</ul>{result.output?.rows && <><h3>Actual DataFrame output</h3><DataTable rows={result.output.rows} /><p className="sparkSchemaLine">Schema: {requiredColumns.map((field) => `${field.name} ${field.type}`).join(" · ")}</p></>}{result.output?.console && <><h3>Console output</h3><pre className="sparkConsoleOutput">{result.output.console}</pre></>}</> : <div className="sparkTabBlank"><Play size={18} /><span>Run Code to execute the public sample or submit for full evaluation.</span></div>}{history.length > 0 && <div className="sparkHistory"><h3><History size={15} /> Recent submissions</h3>{history.map((attempt) => <div key={attempt.id}><span className={attempt.correct ? "passed" : "failed"}>{attempt.correct ? "Passed" : "Retry"}</span><time>{attempt.execution_ms} ms · {new Date(attempt.created_at).toLocaleString()}</time></div>)}</div>}</>}
            {tab === "Expected Output" && (example ? <><DataTable rows={example.expected} /><p className="sparkExpectedNote">Public example only. Hidden test data and expected results stay on the runner.</p></> : <p>No public expected output.</p>)}
            {tab === "Hints" && <div className="sparkHintList">{question.hints?.length ? question.hints.map((hint, index) => <p key={index}><Lightbulb size={15} /><span><strong>Hint {index + 1}</strong>{hint}</span></p>) : <p>No hints are available.</p>}</div>}
            {tab === "Explanation" && <div className="sparkReviewContent">{review ? <><p>{review.explanation}</p><h3>Common mistakes</h3><ul>{review.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul></> : <p>Submit a solution to unlock the explanation and review notes.</p>}</div>}
            {tab === "Solution" && <div className="sparkReviewContent">{review ? <pre><code>{review.referenceSolution}</code></pre> : <p>Submit a solution to unlock the reference implementation.</p>}</div>}
          </div>
        </section>

        <section className="sparkTutorPanel"><div><Sparkles size={16} /><strong>AI Tutor</strong><span>Guidance is theoretical and never presented as runtime output.</span></div><div className="sparkTutorActions"><button disabled={tutorBusy} onClick={() => void askTutor("hint")}>Hint</button><button disabled={tutorBusy} onClick={() => void askTutor("explain_code")}>Explain code</button><button disabled={tutorBusy || !result?.message} onClick={() => void askTutor("explain_error", result?.message)}>Explain error</button><button disabled={tutorBusy} onClick={() => void askTutor("optimize")}>Optimize</button><button disabled={tutorBusy} onClick={() => void askTutor("spark_concept")}>Spark concept</button><button disabled={tutorBusy} onClick={() => void askTutor("similar_question")}>Similar question</button><button disabled={tutorBusy || !review} onClick={() => void askTutor("step_by_step")}>Step-by-step solution</button></div>{tutorBusy ? <p>Thinking…</p> : tutorText && <p className="sparkTutorReply">{tutorText}</p>}</section>
      </section>}
    </div>
    <footer className="sparkLabFooter"><span>Real Spark local mode is single-machine execution, not a multi-node cluster.</span><a href="/">Return to learning dashboard</a></footer>
  </main>;
}