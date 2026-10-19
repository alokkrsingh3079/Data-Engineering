import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Activity, ArrowRight, BarChart3, Bookmark, BookOpen, Check, Code2, Database, Layers3, Lightbulb, LogOut, Play, Sparkles, Target } from "lucide-react";
import "./learning-track-lab.css";

type Option = { id: string; text: string };
type Example = { input: unknown; expected: unknown };
type Question = {
  id: string; title: string; prompt: string; module_id: string; topic: string; subtopic?: string;
  difficulty: string; learning_level?: "A" | "B" | "C"; type: string; language?: "python" | "pyspark";
  options?: Option[]; hints?: string[]; starter_code?: string; input_description?: string;
  output_description?: string; public_examples?: Example[]; bookmarked?: boolean; completed?: boolean;
};
type Level = "A" | "B" | "C" | "all";

const TRACKS: Record<string, { title: string; eyebrow: string; description: string; icon: typeof Code2; moduleIds: string[] }> = {
  "python-etl": { title: "Python Lab", eyebrow: "PYTHON FOR DATA ENGINEERING", description: "Practice reliable transformations, collections, validation, and repeatable batch processing.", icon: Code2, moduleIds: ["python-etl"] },
  "azure-data-factory": { title: "Azure & Databricks Lab", eyebrow: "CLOUD DATA ENGINEERING", description: "Work through pipeline design, safe retries, Delta operations, and cloud data workflows.", icon: Layers3, moduleIds: ["azure-data-factory"] },
  "databricks-delta": { title: "Azure & Databricks Lab", eyebrow: "CLOUD DATA ENGINEERING", description: "Work through pipeline design, safe retries, Delta operations, and cloud data workflows.", icon: Layers3, moduleIds: ["azure-data-factory"] },
  "etl-data-quality": { title: "ETL Testing Lab", eyebrow: "DATA QUALITY & WAREHOUSING", description: "Practice source-to-target validation, data contracts, deduplication, and safe reprocessing.", icon: Activity, moduleIds: ["etl-data-quality"] },
};
const API = "";
const levelFor = (question: Question): Exclude<Level, "all"> => question.learning_level || (question.difficulty === "beginner" ? "A" : question.difficulty === "advanced" ? "C" : "B");

function Preview({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="trackEmpty">No preview rows.</div>;
  const columns = Object.keys(rows[0]);
  return <div className="trackTableScroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{row[column] == null ? <i>NULL</i> : String(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

export default function LearningTrackLab() {
  const moduleId = decodeURIComponent(location.pathname.split("/")[2] || "python-etl");
  const track = TRACKS[moduleId] || TRACKS["python-etl"];
  const Icon = track.icon;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [module, setModule] = useState<any>(null);
  const [userName, setUserName] = useState("Learner");
  const [level, setLevel] = useState<Level>("A");
  const [code, setCode] = useState("");
  const [answerId, setAnswerId] = useState("");
  const [attemptResult, setAttemptResult] = useState<any>(null);
  const [codeResult, setCodeResult] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [runner, setRunner] = useState<{ python: { available: boolean }; pyspark: { available: boolean } }>({ python: { available: false }, pyspark: { available: false } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Problem");

  const filteredQuestions = useMemo(() => questions.filter((item) => {
    const matchesLevel = level === "all" || levelFor(item) === level;
    const matchesSearch = !search.trim() || `${item.title} ${item.topic} ${item.prompt}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesLevel && matchesSearch;
  }), [questions, level, search]);
  const levelCounts = useMemo(() => ({ A: questions.filter((item) => levelFor(item) === "A").length, B: questions.filter((item) => levelFor(item) === "B").length, C: questions.filter((item) => levelFor(item) === "C").length }), [questions]);

  async function loadAttempts(id: string) {
    const response = await fetch(`${API}/api/learning/questions/${id}/attempts?limit=10`, { credentials: "include" });
    if (response.ok) setAttempts(await response.json());
  }

  async function selectQuestion(item: Question) {
    setQuestion(item); setCode(item.starter_code || ""); setAnswerId(""); setAttemptResult(null); setCodeResult(null); setTab("Problem"); setError("");
    setReview(null);
    await Promise.all([loadAttempts(item.id), fetch(`${API}/api/learning/questions/${item.id}/review`, { credentials: "include" }).then(async (response) => { if (response.ok) setReview(await response.json()); })]);
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${API}/api/learning/studio`, { credentials: "include", signal: controller.signal }).then(async (response) => { if (response.status === 401) { location.href = "/login"; return null; } if (!response.ok) throw Error("Learning track is unavailable."); return response.json(); }),
      Promise.all(track.moduleIds.map(async (id) => { const response = await fetch(`${API}/api/learning/questions?moduleId=${encodeURIComponent(id)}&pageSize=50`, { credentials: "include", signal: controller.signal }); if (!response.ok) throw Error("Question bank is unavailable."); return response.json(); })),
      fetch(`${API}/api/learning/runners/status`, { credentials: "include", signal: controller.signal }).then((response) => response.ok ? response.json() : null),
      fetch(`${API}/api/auth/me`, { credentials: "include", signal: controller.signal }).then((response) => response.ok ? response.json() : null),
    ]).then(([studio, banks, runnerState, account]) => {
      if (controller.signal.aborted) return;
      setModule(studio?.modules?.find((item: any) => item.id === moduleId) || null);
      const items = banks.flatMap((bank: any) => bank?.items || []);
      setQuestions(items);
      if (runnerState) setRunner(runnerState);
      setUserName(account?.user?.name || "Learner");
      const levelOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
      items.sort((left: Question, right: Question) => (levelOrder[levelFor(left)] - levelOrder[levelFor(right)]) || left.title.localeCompare(right.title));
      const requested = new URLSearchParams(location.search).get("questionId");
      const initial = items.find((item: Question) => item.id === requested) || items.find((item: Question) => item.language === "python" && item.learning_level === "A") || items[0];
      if (initial) { void selectQuestion(initial); setLevel(levelFor(initial)); }
    }).catch((cause) => { if (cause.name !== "AbortError") setError(cause instanceof Error ? cause.message : "Could not load this learning track."); });
    return () => controller.abort();
  }, [moduleId]);

  async function submitChoice() {
    if (!question || !answerId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/api/learning/questions/${question.id}/attempt`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId: answerId }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Answer could not be saved.");
      setAttemptResult(result);
      setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, completed: item.completed || result.correct } : item));
      await loadAttempts(question.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Answer could not be saved."); }
    finally { setBusy(false); }
  }

  async function submitCode() {
    if (!question || !code.trim()) return;
    setBusy(true); setError(""); setCodeResult(null);
    try {
      const response = await fetch(`${API}/api/learning/questions/${question.id}/run`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Isolated execution failed.");
      setCodeResult(result);
      if (result.correct) setQuestion({ ...question, completed: true });
      await Promise.all([loadAttempts(question.id), fetch(`${API}/api/learning/questions/${question.id}/review`, { credentials: "include" }).then(async (reviewResponse) => { if (reviewResponse.ok) setReview(await reviewResponse.json()); })]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The isolated Python runner is unavailable."); }
    finally { setBusy(false); }
  }

  async function toggleBookmark() {
    if (!question) return;
    const bookmarked = !question.bookmarked;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/bookmark`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marked: bookmarked }) });
    if (!response.ok) { setError("Bookmark could not be saved."); return; }
    setQuestion({ ...question, bookmarked });
    setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, bookmarked } : item));
  }

  async function signOut() { await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }); location.href = "/login"; }
  const example = question?.public_examples?.[0];
  const languageAvailable = question?.language === "python" ? runner.python.available : question?.language === "pyspark" ? runner.pyspark.available : false;

  return <div className="trackShell">
    <aside className="trackSidebar"><a className="trackBrand" href="/"><span><Layers3 size={18} /></span><strong>Data Engineering<small>INTERVIEW STUDIO</small></strong></a><nav><a href="/"><Activity size={15} />Dashboard</a><a href="/sql"><Database size={15} />SQL lab</a><a className={moduleId === "python-etl" ? "active" : ""} href="/learn/python-etl"><Code2 size={15} />Python lab</a><a href="/pyspark"><Layers3 size={15} />PySpark lab</a><a className={moduleId === "azure-data-factory" || moduleId === "databricks-delta" ? "active" : ""} href="/learn/azure-data-factory"><Activity size={15} />Azure &amp; Databricks</a><a className={moduleId === "etl-data-quality" ? "active" : ""} href="/learn/etl-data-quality"><Target size={15} />ETL testing</a><a href="/interview"><BookOpen size={15} />Interview</a><a href="/analytics"><BarChart3 size={15} />Progress</a></nav><button className="trackAccount" onClick={() => void signOut()}><span>{userName.slice(0, 1).toUpperCase()}</span><strong>{userName}</strong><LogOut size={14} /></button></aside>
    <main className="trackMain">
      <div className="trackBreadcrumb"><a href="/">Learning paths</a><span>/</span><span>{track.title}</span></div>
      <header className="trackHero"><div><div className="trackEyebrow"><Icon size={14} /> {track.eyebrow}</div><h1>{track.title}</h1><p>{module?.description || track.description}</p></div><div className="trackStats"><strong>{questions.length}</strong><span>QUESTIONS</span></div></header>
      {error && <div className="trackError" role="alert">{error}</div>}
      <section className="trackLevelBar"><div className="trackLevelIntro"><strong>Choose your starting point</strong><span>Each level builds on the previous one.</span></div><div className="trackLevelTabs" role="tablist">{(["A", "B", "C", "all"] as const).map((item) => <button key={item} role="tab" aria-selected={level === item} className={level === item ? `selected level-${item.toLowerCase()}` : ""} onClick={() => setLevel(item)}><span>{item === "all" ? "All" : `Level ${item}`}</span><small>{item === "all" ? questions.length : levelCounts[item]}</small></button>)}</div></section>
      <div className="trackLayout">
        <aside className="trackQuestionRail"><div className="trackRailTitle"><strong>QUESTION BANK</strong><span>{filteredQuestions.length}</span></div><label className="trackSearch">Search this track<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises…" /></label><div className="trackQuestionList">{filteredQuestions.map((item, index) => <button className={question?.id === item.id ? "selected" : ""} key={item.id} onClick={() => void selectQuestion(item)}><span className="trackQuestionName"><em>{String(index + 1).padStart(2, "0")}</em>{item.title}</span><small>Level {levelFor(item)} · {item.topic}{item.completed ? <Check size={12} /> : null}{item.bookmarked ? <Bookmark size={12} /> : null}</small></button>)}{!filteredQuestions.length && <p className="trackEmpty">No questions at this level yet.</p>}</div></aside>
        {question ? <article className="trackQuestionDetail">
          <div className="trackQuestionMeta"><span className={`trackLevelBadge level-${levelFor(question)}`}>LEVEL {levelFor(question)}</span><span>{question.topic}{question.subtopic ? ` · ${question.subtopic}` : ""}</span><span>{question.difficulty}</span><button className={question.bookmarked ? "saved" : ""} onClick={() => void toggleBookmark()} aria-label={question.bookmarked ? "Remove bookmark" : "Bookmark question"}><Bookmark size={15} /></button></div>
          <h2>{question.title}</h2><p className="trackPrompt">{question.prompt}</p>
          {question.type === "coding" ? <>
            <div className="trackCodingSpec"><div><strong>Input</strong><span>{question.input_description}</span></div><div><strong>Required output</strong><span>{question.output_description}</span></div></div>
            <div className="trackCodingGrid"><section className="trackCodePanel"><div className="trackPanelHead"><strong>{question.language === "python" ? "PYTHON" : "PYSPARK"} EDITOR</strong><button onClick={() => setCode(question.starter_code || "")}>Reset</button></div><CodeMirror value={code} height="330px" extensions={[python(), oneDark]} editable={!busy} onChange={(value) => setCode(value.slice(0, 32000))} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} /><div className="trackRunBar"><button disabled={!languageAvailable || busy || !code.trim()} onClick={() => void submitCode()}><Play size={14} />{busy ? "Running…" : "Run and submit"}</button><span>{languageAvailable ? "Isolated runner ready" : "Isolated runner unavailable; code is not sent to this server"}</span></div>{codeResult && <div className={`trackResult ${codeResult.correct ? "passed" : "failed"}`}><strong>{codeResult.correct ? "All tests passed" : "Tests need another try"}</strong><span>{codeResult.executionMs} ms</span>{codeResult.tests?.map((item: any) => <small key={item.name}>{item.name}: {item.passed ? "passed" : "failed"}</small>)}</div>}</section><aside className="trackPreview"><strong>PUBLIC EXAMPLE</strong>{example ? <><span>Input</span><pre>{JSON.stringify(example.input, null, 2)}</pre><span>Expected result</span><pre>{JSON.stringify(example.expected, null, 2)}</pre></> : <p>Sample input is supplied by the exercise.</p>}</aside></div>
            {question.hints?.length ? <details className="trackHints"><summary><Lightbulb size={14} /> Hints</summary>{question.hints.map((hint, index) => <p key={index}><b>{index + 1}.</b> {hint}</p>)}</details> : null}
            {attempts.length > 0 && <section className="trackHistory"><strong>RECENT SUBMISSIONS</strong>{attempts.slice(0, 5).map((attempt) => <p key={attempt.id}><span>{attempt.correct ? "Passed" : "Retry"}</span><time>{new Date(attempt.created_at).toLocaleString()}</time></p>)}</section>}
          </> : <>
            <section className="trackOptions" role="radiogroup" aria-label="Answer options">{question.options?.map((option) => <label className={answerId === option.id ? "selected" : ""} key={option.id}><input type="radio" name="track-answer" checked={answerId === option.id} disabled={Boolean(attemptResult)} onChange={() => setAnswerId(option.id)} /><span>{option.text}</span></label>)}</section>
            <div className="trackActions"><button className="trackPrimary" disabled={!answerId || busy || Boolean(attemptResult)} onClick={() => void submitChoice()}>{busy ? "Saving…" : "Check answer"}</button><button onClick={() => void toggleBookmark()}><Bookmark size={14} />{question.bookmarked ? "Saved" : "Save question"}</button></div>
            {attemptResult && <section className={`trackResult ${attemptResult.correct ? "passed" : "failed"}`}><strong>{attemptResult.correct ? "Correct" : "Try again"}</strong><p>{attemptResult.explanation}</p><b>Explanation</b><p>{attemptResult.referenceAnswer}</p>{attemptResult.commonMistakes?.length > 0 && <><b>Common pitfalls</b><ul>{attemptResult.commonMistakes.map((mistake: string) => <li key={mistake}>{mistake}</li>)}</ul></>}</section>}
            {question.hints?.length ? <details className="trackHints"><summary><Lightbulb size={14} /> Hints</summary>{question.hints.map((hint, index) => <p key={index}><b>{index + 1}.</b> {hint}</p>)}</details> : null}
          </>}
          {attempts.length > 0 && question.type !== "coding" && <section className="trackHistory"><strong>RECENT ATTEMPTS</strong>{attempts.slice(0, 5).map((attempt) => <p key={attempt.id}><span>{attempt.correct ? "Correct" : "Retry"}</span><time>{new Date(attempt.created_at).toLocaleString()}</time></p>)}</section>}
        </article> : <article className="trackQuestionDetail trackEmptyDetail"><Icon size={26} /><h2>Choose an exercise to begin</h2><p>Start at Level A for the fundamentals, then move up as the patterns become familiar.</p></article>}
      </div>
      <footer className="trackFooter"><span>Progress, bookmarks, and attempts are private to your account.</span><a href="/">Back to dashboard <ArrowRight size={14} /></a></footer>
    </main>
  </div>;
}
