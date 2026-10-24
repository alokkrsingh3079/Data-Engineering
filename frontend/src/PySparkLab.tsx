import { useEffect, useMemo, useState, type CSSProperties } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Bookmark, Check, Clock3, Code2, Database, ExternalLink, Flag, History, Layers3, Lightbulb, Play, Send, Sparkles } from "lucide-react";
import CopyButton from "./CopyButton";
import "./pyspark-lab.css";
import "./pyspark-theme.css";
import "./pyspark-levels.css";
import "./pyspark-level-expansion.css";
import "./question-bank-resize.css";
import "./solution-copy.css";
import "./revision-bookmark.css";
import "./question-bank-progress.css";
import { questionBankProgress, questionBankProgressClass, questionBankProgressLabel, questionBankProgressStyle } from "./questionBankProgress";

type Question = {
  id: string;
  title: string;
  prompt: string;
  topic: string;
  subtopic?: string;
  learning_level?: string;
  level_title?: string;
  difficulty_label?: string;
  input_schema?: { dataset: string; columns: { name: string; type: string }[] }[];
  difficulty: string;
  starter_code: string;
  input_description: string;
  output_description: string;
  public_examples: { input: unknown; expected: Record<string, unknown>[] }[];
  hints: string[];
  bookmarked: boolean;
  completed: boolean;
  attempted?: boolean;
  revisionMarked: boolean;
  source?: string;
  dataset_id?: string;
  dataset_name?: string;
  created_at?: string | Date;
  generation_index?: number;
};

type RunnerState = { configured: boolean; available: boolean; diagnostic?: string };
type RunResult = {
  status?: string;
  correct?: boolean;
  executionMs?: number;
  tests?: { name: string; passed: boolean; status?: string }[];
  output?: { columns?: string[]; schema?: { name: string; type: string }[]; rows?: Record<string, unknown>[]; console?: string };
  message?: string;
};

const API = "";

function requestDiagnostics(response: Response, path: string, requestId: string, startedAt: number) {
  return {
    requestId,
    path,
    status: response.status,
    contentType: response.headers.get("content-type") || "missing",
    cfRay: response.headers.get("cf-ray") || undefined,
    renderRequestId: response.headers.get("rndr-id") || undefined,
    upstreamRequestId: response.headers.get("x-request-id") || undefined,
    server: response.headers.get("server") || undefined,
    durationMs: Date.now() - startedAt,
  };
}

async function readApiJson<T>(response: Response, path = "API request", requestId?: string): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    const detail = body.trimStart().startsWith("<")
      ? "The API gateway returned an HTML page."
      : "The server returned a non-JSON response.";
    const correlation = requestId ? ` Request ID: ${requestId}.` : "";
    throw new Error(`${detail} Request: ${path} (HTTP ${response.status}).${correlation}`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    const correlation = requestId ? ` Request ID: ${requestId}.` : "";
    throw new Error(`The API returned invalid JSON. Request: ${path} (HTTP ${response.status}).${correlation}`);
  }
}

const TABS = ["Test Cases", "Expected Output", "Hints", "Explanation", "Solution"] as const;
type Tab = typeof TABS[number];
const levels = Array.from({ length: 18 }, (_, index) => String.fromCharCode(65 + index));
function isGeneratedQuestion(question: Question) {
  return question.source === "dataset-generation";
}
function datasetFilterKey(question: Question) {
  return `dataset:${question.dataset_id || "legacy"}`;
}
function questionOrder(left: Question, right: Question) {
  if (isGeneratedQuestion(left) && isGeneratedQuestion(right)) {
    const createdDifference = Date.parse(String(left.created_at || "")) - Date.parse(String(right.created_at || ""));
    if (Number.isFinite(createdDifference) && createdDifference !== 0) return createdDifference;
    const indexDifference = (left.generation_index ?? Number.MAX_SAFE_INTEGER) - (right.generation_index ?? Number.MAX_SAFE_INTEGER);
    if (indexDifference) return indexDifference;
  }
  return (left.learning_level || "Z").localeCompare(right.learning_level || "Z") || left.id.localeCompare(right.id);
}
function levelBand(level: string) {
  if (level <= "D") return "VERY EASY";
  if (level <= "H") return "EASY";
  if (level <= "K") return "MEDIUM";
  if (level <= "N") return "HARD";
  return "VERY HARD";
}
function levelDescription(level: string) {
  if (level === "all") return "Browse the full PySpark question bank, including dataset-generated exercises.";
  if (level.startsWith("dataset:")) return "Dataset-grounded PySpark exercises, listed in the order they were generated.";
  const band = levelBand(level);
  return `${band}: Level ${level} practice with a complete input contract, schema, sample output, hints, and reference solution.`;
}

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
  const [railWidth, setRailWidth] = useState(() => {
    const saved = Number(localStorage.getItem("pyspark-question-rail-width"));
    return Number.isFinite(saved) && saved >= 220 && saved <= 560 ? saved : 260;
  });
  const [revisionOnly, setRevisionOnly] = useState(() => new URLSearchParams(location.search).get("revision") === "1");
  const [revisionQuestionIds, setRevisionQuestionIds] = useState<Set<string>>(() => new Set());

  const generatedDatasets = useMemo(() => {
    const datasets = new Map<string, { key: string; id: string; name: string; count: number }>();
    for (const item of questions) {
      if (!isGeneratedQuestion(item)) continue;
      const id = item.dataset_id || "legacy";
      const existing = datasets.get(id);
      if (existing) existing.count++;
      else datasets.set(id, { key: datasetFilterKey(item), id, name: item.dataset_name || (id === "legacy" ? "Older generated questions" : `Dataset ${id.slice(0, 8)}`), count: 1 });
    }
    const groups = [...datasets.values()];
    const nameCounts = new Map<string, number>();
    for (const dataset of groups) nameCounts.set(dataset.name, (nameCounts.get(dataset.name) || 0) + 1);
    return groups.map((dataset) => ({
      ...dataset,
      name: (nameCounts.get(dataset.name) || 0) > 1 && dataset.id !== "legacy" ? `${dataset.name} · ${dataset.id.slice(0, 8)}` : dataset.name
    })).sort((left, right) => left.name.localeCompare(right.name));
  }, [questions]);
  const visibleQuestions = useMemo(() => questions.filter((item) => (filter === "all" || filter === "revision" || (filter.startsWith("dataset:") ? isGeneratedQuestion(item) && datasetFilterKey(item) === filter : item.learning_level === filter)) && (!revisionOnly || revisionQuestionIds.has(item.id))), [questions, filter, revisionOnly, revisionQuestionIds]);
  const levelCounts = useMemo(() => Object.fromEntries([
    ...levels.map((level) => [level, questions.filter((item) => item.learning_level === level).length]),
    ...generatedDatasets.map((dataset) => [dataset.key, dataset.count])
  ]), [questions, generatedDatasets]);
  const bankProgress = (items: Question[]) => questionBankProgress(
    items.filter((item) => item.completed).length,
    items.length,
    items.filter((item) => item.attempted).length
  );
  const revisionCount = revisionQuestionIds.size;
  const selectBankFilter = (value: string) => {
    setFilter(value === "revision" ? "all" : value);
    setRevisionOnly(value === "revision");
  };

  useEffect(() => {
    if (!busy) { setElapsedSeconds(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function loadHistory(id: string) {
    const response = await fetch(`${API}/api/learning/questions/${id}/attempts?limit=10`, { credentials: "include" });
    if (response.ok) setHistory(await readApiJson(response));
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
      if (response.ok) setReview(await readApiJson(response));
    })]).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load question details."));
  }

  useEffect(() => {
    let mounted = true;
    let lastDiagnostic = "";
    const refreshRunnerStatus = () => {
      void fetch(`${API}/api/learning/runners/status`, { credentials: "include" })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              if (!mounted) return;
              setRunner({ configured: true, available: false, diagnostic: "Sign in to view live runner status." });
              return;
            }
            if (!mounted) return;
            setRunner({ configured: false, available: false, diagnostic: `Runner status endpoint returned HTTP ${response.status}.` });
            return;
          }
          const status = await readApiJson<{ pyspark: RunnerState }>(response);
          if (!mounted || !status?.pyspark) return;
          setRunner(status.pyspark);
          const diagnostic = status.pyspark.available ? "" : status.pyspark.diagnostic || "No diagnostic provided.";
          if (diagnostic && diagnostic !== lastDiagnostic) console.warn("[PySpark Lab] Runner health check failed:", diagnostic);
          lastDiagnostic = diagnostic;
        })
        .catch((cause) => {
          if (!mounted) return;
          setRunner({ configured: false, available: false, diagnostic: cause instanceof Error ? cause.message : "Runner status check failed." });
        });
    };
    refreshRunnerStatus();
    const refreshInterval = window.setInterval(refreshRunnerStatus, 30_000);
    window.addEventListener("focus", refreshRunnerStatus);
    return () => {
      mounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshRunnerStatus);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pyspark-question-rail-width", String(railWidth));
  }, [railWidth]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    Promise.all([
      (async () => {
        const query = "moduleId=pyspark-foundations&type=coding&pageSize=50";
        const firstResponse = await fetch(`${API}/api/learning/questions?${query}&page=1`, { credentials: "include", signal: controller.signal });
        if (firstResponse.status === 401) { location.href = "/login"; return null; }
        if (!firstResponse.ok) throw new Error("PySpark questions could not be loaded.");
        const firstPage = await readApiJson<any>(firstResponse);
        const rest = await Promise.all(Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, async (_, index) => {
          const response = await fetch(`${API}/api/learning/questions?${query}&page=${index + 2}`, { credentials: "include", signal: controller.signal });
          if (!response.ok) throw new Error("Some PySpark questions could not be loaded.");
            return readApiJson<any>(response);
        }));
        return { ...firstPage, items: [firstPage, ...rest].flatMap((page) => page.items || []) };
      })(),
      (async () => {
        const query = "moduleId=pyspark-foundations&type=coding&state=revision&pageSize=50";
        const response = await fetch(`${API}/api/learning/questions?${query}&page=1`, { credentials: "include", signal: controller.signal });
        if (!response.ok) throw new Error("PySpark revision questions could not be loaded.");
        const firstPage = await readApiJson<any>(response);
        const rest = await Promise.all(Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, async (_, index) => {
          const pageResponse = await fetch(`${API}/api/learning/questions?${query}&page=${index + 2}`, { credentials: "include", signal: controller.signal });
          if (!pageResponse.ok) throw new Error("Some PySpark revision questions could not be loaded.");
          return readApiJson<any>(pageResponse);
        }));
        return [firstPage, ...rest].flatMap((page) => page.items || []) as Question[];
      })(),
    ]).then(([bank, revisionItems]) => {
      if (!mounted) return;
      const items = (bank?.items || []).filter((item: Question & { language?: string }) => item.language === "pyspark")
      .sort(questionOrder);
      const markedIds = new Set<string>((revisionItems as Question[]).map((item) => item.id));
      setRevisionQuestionIds(markedIds);
      for (const item of items) item.revisionMarked = markedIds.has(item.id);
      setQuestions(items);
      const params = new URLSearchParams(location.search);
      const requestedQuestion = params.get("questionId");
      if (params.get("revision") === "1") { setRevisionOnly(true); setFilter("all"); }
      const requested = items.find((item: Question) => item.id === requestedQuestion);
      if (requested && isGeneratedQuestion(requested)) setFilter(datasetFilterKey(requested));
      else if (requested?.learning_level) setFilter(requested.learning_level);
      const firstLevelQuestion = requested || items.find((item: Question) => item.learning_level === "A") || items[0];
      if (firstLevelQuestion) void chooseQuestion(firstLevelQuestion);
    }).catch((cause) => { if (mounted) setError(cause instanceof Error ? cause.message : "PySpark Lab is unavailable."); });
    return () => { mounted = false; controller.abort(); };
  }, []);

  async function execute(submit: boolean) {
    if (!question || !code.trim()) return;
    setBusy(submit ? "submit" : "run");
    setJobStatus("queued");
    setError("");
    setResult(null);
    const requestId = crypto.randomUUID();
    const createJobPath = `${API}/api/learning/questions/${question.id}/jobs`;
    const requestStartedAt = Date.now();
    console.info("[PySpark Lab] Creating Spark job", {
      requestId,
      questionId: question.id,
      mode: submit ? "submit" : "run",
      path: createJobPath,
      codeLength: code.length,
      startedAt: new Date(requestStartedAt).toISOString(),
    });
    try {
      let response: Response;
      try {
        response = await fetch(createJobPath, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", "X-Client-Request-Id": requestId },
          body: JSON.stringify({ code, mode: submit ? "submit" : "run" }),
        });
      } catch (cause) {
        const failure = {
          requestId,
          path: createJobPath,
          durationMs: Date.now() - requestStartedAt,
          failure: cause instanceof Error ? cause.name : "NetworkError",
        };
        console.error("[PySpark Lab] Spark job request did not receive an HTTP response", failure);
        throw new Error(`Spark job request failed before receiving a response. Request: ${createJobPath}. Request ID: ${requestId}.`);
      }
      const diagnostics = requestDiagnostics(response, createJobPath, requestId, requestStartedAt);
      let body: any;
      try {
        body = await readApiJson<any>(response, createJobPath, requestId);
      } catch (cause) {
        console.error("[PySpark Lab] Spark job response could not be read", diagnostics);
        throw cause;
      }
      if (!response.ok) {
        console.error("[PySpark Lab] Spark job creation failed", {
          ...diagnostics,
          apiError: typeof body?.error === "string" ? body.error.slice(0, 300) : undefined,
        });
        throw new Error(`${body?.error || "Spark job creation failed."} Request ID: ${requestId}.`);
      }
      console.info("[PySpark Lab] Spark job queued", {
        ...diagnostics,
        jobId: body.jobId,
        jobStatus: body.status || "queued",
      });
      setActiveJobId(body.jobId);
      setJobStatus(body.status || "queued");
      let completedJob: any = null;
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        const statusResponse = await fetch(`${API}/api/learning/jobs/${body.jobId}`, { credentials: "include" });
        const statusBody = await readApiJson<any>(statusResponse);
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
        setQuestion((current) => current ? { ...current, attempted: true } : current);
        setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, attempted: true } : item));
        if (jobResult.status === "passed") {
          setQuestion((current) => current ? { ...current, completed: true, revisionMarked: false } : current);
          setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, completed: true, revisionMarked: false } : item));
          setRevisionQuestionIds((current) => {
            const next = new Set(current);
            next.delete(question.id);
            return next;
          });
        }
        await Promise.all([loadHistory(question.id), fetch(`${API}/api/learning/questions/${question.id}/review`, { credentials: "include" }).then(async (reviewResponse) => {
          if (reviewResponse.ok) setReview(await readApiJson(reviewResponse));
        })]);
      }
    } catch (cause) {
      console.error("[PySpark Lab] Spark execution flow failed", {
        requestId,
        questionId: question.id,
        mode: submit ? "submit" : "run",
        durationMs: Date.now() - requestStartedAt,
        failure: cause instanceof Error ? cause.message : "Unknown failure",
      });
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
    const body = await readApiJson<any>(response);
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

  async function toggleRevisionMark() {
    if (!question) return;
    const marked = !question.revisionMarked;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/revision`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marked }) });
    const body = await readApiJson<any>(response).catch(() => null);
    if (!response.ok) { setError(body?.error || "Revision mark could not be saved."); return; }
    setQuestion({ ...question, revisionMarked: marked });
    setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, revisionMarked: marked } : item));
    setRevisionQuestionIds((current) => {
      const next = new Set(current);
      if (marked) next.add(question.id);
      else next.delete(question.id);
      return next;
    });
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
      const body = await readApiJson<any>(response);
      if (!response.ok) throw new Error(body.error || "AI Tutor is unavailable.");
      setTutorText(`${body.basis === "theoretical" ? "Theoretical guidance, not execution output.\n\n" : ""}${body.answer}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI Tutor is unavailable."); }
    finally { setTutorBusy(false); }
  }

  async function showSolution() {
    setTab("Solution");
    if (review || !question) return;
    try {
      const response = await fetch(`${API}/api/learning/questions/${question.id}/review`, { credentials: "include" });
      const body = await readApiJson<any>(response);
      if (response.ok) setReview(body);
      else setError(body.error || "Reference solution is unavailable.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reference solution is unavailable.");
    }
  }

  const example = question?.public_examples?.[0];
  const requiredColumns = result?.output?.schema || [];

  return <main className="sparkLabPage">
    <header className="sparkLabHeader">
      <a className="sparkLabBrand" href="/"><span><Layers3 size={17} /></span><strong>Data Engineering Studio</strong></a>
      <nav aria-label="Main navigation"><a href="/">Learning path</a><a href="/sql"><Database size={15} /> SQL Lab</a><a className="active" href="/pyspark"><Code2 size={15} /> PySpark Lab</a><a href="/ask-ai"><Sparkles size={15} /> Ask AI</a><a href="/interview?track=pyspark-foundations">Timed interview</a></nav>
      <a className="sparkLabExit" href="/learn/pyspark-foundations">Learning module <ExternalLink size={14} /></a>
    </header>
    <section className="sparkLabTitle"><div><p>REAL SPARK EXECUTION · LOCAL MODE</p><h1>PySpark Lab</h1><span>Interview exercises against a pinned Spark runtime.</span></div><div className={`sparkRunnerBadge ${runner.available ? "ready" : "offline"}`} title={runner.diagnostic}><span />{runner.available ? "Spark runner ready" : runner.configured ? `Runner health check failed${runner.diagnostic ? `: ${runner.diagnostic}` : ""}` : "Runner not configured"}</div></section>
    {error && <div className="sparkLabError" role="alert">{error}</div>}
    <div className="sparkLabLayout" style={{ "--question-rail-width": `${railWidth}px` } as CSSProperties}>
      <aside className="sparkQuestionRail" aria-label="PySpark question bank">
        <div className="sparkRailHead"><strong>{revisionOnly ? "REVISION ONLY" : "QUESTION BANK"}</strong><span>{visibleQuestions.length}</span></div>
        <label className="questionRailWidthControl">Bank width <output>{railWidth}px</output><input type="range" min="220" max="560" step="10" value={railWidth} aria-label="Question bank width" onChange={(event) => setRailWidth(Number(event.target.value))} /></label>
        <button className={`sparkRevisionToggle ${revisionOnly ? "active" : ""}`} onClick={() => selectBankFilter(revisionOnly ? "all" : "revision")}><Flag size={13} />{revisionOnly ? "Show all questions" : "Revision only"}</button>
        <div className="sparkLevelSelector" role="tablist" aria-label="PySpark question bank">{["all", "revision", ...levels, ...generatedDatasets.map((dataset) => dataset.key)].map((level) => {
          if (level === "revision") return <button key={level} className={`bankProgress-revision ${revisionOnly ? "active" : ""}`} role="tab" aria-label={`Revision questions, ${revisionCount} marked`} title="Show questions marked for revision" aria-selected={revisionOnly} onClick={() => selectBankFilter(level)}><strong>Revision</strong><span>{revisionCount}</span></button>;
          const dataset = generatedDatasets.find((entry) => entry.key === level);
          const label = level === "all" ? "All" : dataset ? dataset.name : level;
          const count = level === "all" ? questions.length : levelCounts[level] || 0;
          const bankQuestions = level === "all" ? questions : dataset ? questions.filter((item) => isGeneratedQuestion(item) && datasetFilterKey(item) === level) : questions.filter((item) => item.learning_level === level);
          const completed = bankQuestions.filter((item) => item.completed).length;
          const attempted = bankQuestions.filter((item) => item.attempted).length;
          const progress = bankProgress(bankQuestions);
          return <button key={level} style={questionBankProgressStyle(completed,bankQuestions.length,attempted)} role="tab" aria-label={`${dataset ? `${dataset.name}, ${dataset.count} questions` : level === "all" ? "All questions" : `Level ${level}, ${levelBand(level)}`}, ${questionBankProgressLabel(progress)}`} title={`${dataset ? dataset.name : level === "all" ? "All questions" : `Level ${level} · ${levelBand(level)}`} · ${questionBankProgressLabel(progress)}`} aria-selected={!revisionOnly && filter === level} className={`${questionBankProgressClass(progress)} ${!revisionOnly && filter === level ? "active " : ""}${dataset ? "level-dataset" : `level-${level.toLowerCase()}`}`} onClick={() => selectBankFilter(level)}><strong>{label}</strong><span>{count}</span></button>;
        })}</div>
        {(() => {
          const dataset = generatedDatasets.find((entry) => entry.key === filter);
          return <div className={`sparkLevelIntro ${dataset ? "level-dataset" : `level-${filter.toLowerCase()}`}`}><strong>{revisionOnly ? "REVISION QUESTIONS" : filter === "all" ? "FULL QUESTION BANK" : dataset ? dataset.name : `LEVEL ${filter} · ${levelBand(filter)}`}</strong><p>{revisionOnly ? "Questions you marked for revision." : levelDescription(filter)}</p></div>;
        })()}
        {visibleQuestions.map((item, index) => <button key={item.id} className={`sparkQuestionItem ${question?.id === item.id ? "selected" : ""}`} onClick={() => void chooseQuestion(item)}><span className="sparkQuestionTitle"><em>{String(index + 1).padStart(2, "0")}</em>{item.title}</span><span className="sparkQuestionMeta">{isGeneratedQuestion(item) ? `${item.dataset_name || "Dataset"} · ${item.topic}` : `${item.topic} · ${item.learning_level ? `Level ${item.learning_level}` : item.difficulty}`}{item.completed && <Check size={13} />}{item.revisionMarked && <Flag size={12} aria-label="Marked for revision" />}{item.bookmarked && <Bookmark size={12} aria-label="Bookmarked" />}</span></button>)}
        {!visibleQuestions.length && <p className="sparkRailEmpty">{revisionOnly ? "No questions are marked for revision." : filter.startsWith("dataset:") ? "This dataset has no questions yet." : "No Spark exercises match this filter."}</p>}
      </aside>

      {question && <section className="sparkWorkspace">
        <div className="sparkChallengeHead"><div><div className="sparkQuestionMetaLine"><span className={`levelPill ${isGeneratedQuestion(question) ? "level-generated" : `level-${question.learning_level || "A"}`}`}>{question.level_title || (isGeneratedQuestion(question) ? question.dataset_name || "Dataset-generated" : `Level ${question.learning_level || "A"}`)}</span>{question.topic}{question.subtopic ? ` / ${question.subtopic}` : ""}<span>{question.difficulty_label || question.difficulty}</span></div><h2>{question.title}</h2></div><div className="sparkQuestionActions"><button className={`revision-action ${question.revisionMarked ? "active" : ""}`} aria-pressed={question.revisionMarked} onClick={() => void toggleRevisionMark()} aria-label={question.revisionMarked ? "Remove revision mark" : "Mark for revision"} title={question.revisionMarked ? "Remove revision mark" : "Mark for revision"}><Flag size={16} /></button><button className={`bookmark-action ${question.bookmarked ? "active" : ""}`} aria-pressed={question.bookmarked} onClick={() => void toggleBookmark()} aria-label={question.bookmarked ? "Remove bookmark" : "Bookmark question"} title={question.bookmarked ? "Remove bookmark" : "Bookmark question"}><Bookmark size={16} /></button></div></div>
        <p className="sparkPrompt">{question.prompt}</p>
        <div className="sparkDatasetStrip"><strong>Input</strong><span>{question.input_description}</span><strong>Required output</strong><span>{question.output_description}</span></div>

        <div className="sparkDatasetPreview"><div className="sparkSectionHeading"><strong>Sample DataFrames</strong><span>Public example</span></div>{example ? renderDatasets(example.input).map((dataset) => { const schema = question.input_schema?.find((item) => item.dataset === dataset.name); return <div className="sparkDataset" key={dataset.name}><h3>{dataset.name}</h3>{schema && <div className="sparkSchemaPreview"><strong>Schema</strong><span>{schema.columns.map((column) => `${column.name}: ${column.type}`).join(" · ")}</span></div>}<DataTable rows={dataset.rows} /></div>; }) : <p className="sparkEmptyData">No public input preview is available.</p>}</div>

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
            {tab === "Solution" && <div className="sparkReviewContent">{review ? <><div className="solutionCodeHeader"><strong>Reference solution</strong><CopyButton value={review.referenceSolution} /></div><pre><code>{review.referenceSolution}</code></pre></> : <p>Select Solution to view the reference implementation.</p>}</div>}
          </div>
        </section>

        <section className="sparkTutorPanel"><div><Sparkles size={16} /><strong>AI Tutor</strong><span>Guidance is theoretical and never presented as runtime output.</span></div><div className="sparkTutorActions"><button disabled={tutorBusy} onClick={() => void askTutor("hint")}>Hint</button><button disabled={tutorBusy} onClick={() => void askTutor("explain_code")}>Explain code</button><button disabled={tutorBusy || !result?.message} onClick={() => void askTutor("explain_error", result?.message)}>Explain error</button><button disabled={tutorBusy} onClick={() => void askTutor("optimize")}>Optimize</button><button disabled={tutorBusy} onClick={() => void askTutor("spark_concept")}>Spark concept</button><button disabled={tutorBusy} onClick={() => void askTutor("similar_question")}>Similar question</button><button disabled={tutorBusy || !review} onClick={() => void askTutor("step_by_step")}>Step-by-step solution</button></div>{tutorBusy ? <p>Thinking…</p> : tutorText && <p className="sparkTutorReply">{tutorText}</p>}</section>
      </section>}
    </div>
    <footer className="sparkLabFooter"><span>Real Spark local mode is single-machine execution, not a multi-node cluster.</span><a href="/">Return to learning dashboard</a></footer>
  </main>;
}