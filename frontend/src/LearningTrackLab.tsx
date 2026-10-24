import { useEffect, useMemo, useState, type CSSProperties } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Activity, ArrowRight, BarChart3, Bookmark, BookOpen, Check, Code2, Database, Flag, Layers3, Lightbulb, LogOut, Play, Sparkles, Target } from "lucide-react";
import CopyButton from "./CopyButton";
import "./learning-track-lab.css";
import "./learning-track-editor.css";
import "./learning-track-levels.css";
import "./question-bank-resize.css";
import "./solution-copy.css";
import "./revision-bookmark.css";

type Option = { id: string; text: string };
type Example = { input: unknown; expected: unknown };
type Question = {
  id: string; title: string; prompt: string; module_id: string; topic: string; subtopic?: string;
  difficulty: string; difficulty_label?: string; learning_level?: string; level_title?: string; type: string; language?: "python" | "pyspark";
  options?: Option[]; hints?: string[]; starter_code?: string; input_description?: string;
  output_description?: string; public_examples?: Example[]; bookmarked?: boolean; completed?: boolean; revisionMarked?: boolean;
  source?: string; dataset_id?: string; dataset_name?: string; created_at?: string | Date; generation_index?: number;
};
type Level = string;
const levels = [..."ABCDEFGHIJKLMNOPQR"];

const TRACKS: Record<string, { title: string; eyebrow: string; description: string; icon: typeof Code2; moduleIds: string[] }> = {
  "python-etl": { title: "Python Lab", eyebrow: "PYTHON FOR DATA ENGINEERING", description: "Practice reliable transformations, collections, validation, and repeatable batch processing.", icon: Code2, moduleIds: ["python-etl"] },
  "azure-data-factory": { title: "Azure & Databricks Lab", eyebrow: "CLOUD DATA ENGINEERING", description: "Work through pipeline design, safe retries, Delta operations, and cloud data workflows.", icon: Layers3, moduleIds: ["azure-data-factory"] },
  "databricks-delta": { title: "Databricks Lab", eyebrow: "DATABRICKS & DELTA LAKE", description: "Practice Delta Lake operations, Spark performance, reliable merges, and production workflows.", icon: Layers3, moduleIds: ["databricks-delta"] },
  "etl-data-quality": { title: "ETL Testing Lab", eyebrow: "DATA QUALITY & WAREHOUSING", description: "Practice source-to-target validation, data contracts, deduplication, and safe reprocessing.", icon: Activity, moduleIds: ["etl-data-quality"] },
};
const API = "";
const isGeneratedQuestion = (question: Question) => question.source === "dataset-generation";
const datasetFilterKey = (question: Question) => `dataset:${question.dataset_id || "legacy"}`;
const levelFor = (question: Question): Exclude<Level, "all"> => question.learning_level || (question.difficulty === "beginner" ? "A" : question.difficulty === "advanced" ? "C" : "B");
function levelBand(level: string) {
  if (level <= "D") return "VERY EASY";
  if (level <= "H") return "EASY";
  if (level <= "K") return "MEDIUM";
  if (level <= "N") return "HARD";
  return "VERY HARD";
}

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
  const [railWidth, setRailWidth] = useState(() => {
    const saved = Number(localStorage.getItem(`${moduleId}-question-rail-width`));
    return Number.isFinite(saved) && saved >= 220 && saved <= 560 ? saved : 290;
  });
  const [code, setCode] = useState("");
  const [answerId, setAnswerId] = useState("");
  const [attemptResult, setAttemptResult] = useState<any>(null);
  const [codeResult, setCodeResult] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [runner, setRunner] = useState<{ python: { available: boolean }; pyspark: { available: boolean } }>({ python: { available: false }, pyspark: { available: false } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [revisionOnly, setRevisionOnly] = useState(() => new URLSearchParams(location.search).get("revision") === "1");
  const [tab, setTab] = useState("Problem");

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
  const filteredQuestions = useMemo(() => questions.filter((item) => {
    const matchesLevel = level === "all" || (level.startsWith("dataset:") ? isGeneratedQuestion(item) && datasetFilterKey(item) === level : item.learning_level === level);
    const matchesSearch = !search.trim() || `${item.title} ${item.topic} ${item.prompt}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesLevel && matchesSearch && (!revisionOnly || item.revisionMarked);
  }), [questions, level, search, revisionOnly]);
  const levelCounts = useMemo(() => Object.fromEntries([
    ...levels.map((item) => [item, questions.filter((question) => question.learning_level === item).length]),
    ...generatedDatasets.map((dataset) => [dataset.key, dataset.count])
  ]), [questions, generatedDatasets]);

  useEffect(() => {
    localStorage.setItem(`${moduleId}-question-rail-width`, String(railWidth));
  }, [moduleId, railWidth]);

  async function loadAttempts(id: string) {
    const response = await fetch(`${API}/api/learning/questions/${id}/attempts?limit=10`, { credentials: "include" });
    if (response.ok) setAttempts(await response.json());
  }

  async function selectQuestion(item: Question) {
    setQuestion(item); setCode(item.starter_code || ""); setAnswerId(""); setAttemptResult(null); setCodeResult(null); setTab("Problem"); setError("");
    setReview(null); setReviewVisible(false);
    await Promise.all([loadAttempts(item.id), fetch(`${API}/api/learning/questions/${item.id}/review`, { credentials: "include" }).then(async (response) => { if (response.ok) setReview(await response.json()); })]);
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch(`${API}/api/learning/runners/status`, { credentials: "include", signal: controller.signal }).then((response) => response.ok ? response.json() : null),
      fetch(`${API}/api/auth/me`, { credentials: "include", signal: controller.signal }).then((response) => response.ok ? response.json() : null),
    ]).then(([runnerState, account]) => {
      if (controller.signal.aborted) return;
      if (runnerState) setRunner(runnerState);
      setUserName(account?.user?.name || "Learner");
    }).catch(() => {});
    Promise.all([
      fetch(`${API}/api/learning/studio`, { credentials: "include", signal: controller.signal }).then(async (response) => { if (response.status === 401) { location.href = "/login"; return null; } if (!response.ok) throw Error("Learning track is unavailable."); return response.json(); }),
      Promise.all(track.moduleIds.map(async (id) => {
        const query = `moduleId=${encodeURIComponent(id)}&pageSize=50`;
        const firstResponse = await fetch(`${API}/api/learning/questions?${query}&page=1`, { credentials: "include", signal: controller.signal });
        if (!firstResponse.ok) throw Error("Question bank is unavailable.");
        const firstPage = await firstResponse.json();
        const rest = await Promise.all(Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, async (_, index) => {
          const response = await fetch(`${API}/api/learning/questions?${query}&page=${index + 2}`, { credentials: "include", signal: controller.signal });
          if (!response.ok) throw Error("Some questions could not be loaded.");
          return response.json();
        }));
        return { ...firstPage, items: [firstPage, ...rest].flatMap((page) => page.items || []) };
      })),
    ]).then(([studio, banks]) => {
      if (controller.signal.aborted) return;
      setModule(studio?.modules?.find((item: any) => item.id === moduleId) || null);
      const items = banks.flatMap((bank: any) => bank?.items || []);
      setQuestions(items);
      items.sort((left: Question, right: Question) => {
        if (isGeneratedQuestion(left) && isGeneratedQuestion(right)) {
          const createdDifference = Date.parse(String(left.created_at || "")) - Date.parse(String(right.created_at || ""));
          if (Number.isFinite(createdDifference) && createdDifference !== 0) return createdDifference;
          const indexDifference = (left.generation_index ?? Number.MAX_SAFE_INTEGER) - (right.generation_index ?? Number.MAX_SAFE_INTEGER);
          if (indexDifference) return indexDifference;
        }
        return levelFor(left).localeCompare(levelFor(right)) || left.title.localeCompare(right.title);
      });
      const params = new URLSearchParams(location.search);
      const requested = params.get("questionId");
      const revisionMode = params.get("revision") === "1";
      if (revisionMode) { setRevisionOnly(true); setLevel("all"); }
      const initial = items.find((item: Question) => item.id === requested) || items.find((item: Question) => item.language === "python" && item.learning_level === "A") || items[0];
      if (initial) { void selectQuestion(initial); if (!revisionMode) setLevel(isGeneratedQuestion(initial) ? datasetFilterKey(initial) : levelFor(initial)); }
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
      setQuestion((current) => current?.id === question.id ? { ...current, completed: current.completed || result.correct, revisionMarked: result.correct ? false : current.revisionMarked } : current);
      setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, completed: item.completed || result.correct, revisionMarked: result.correct ? false : item.revisionMarked } : item));
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
      if (result.correct) setQuestion({ ...question, completed: true, revisionMarked: false });
      setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, completed: item.completed || result.correct, revisionMarked: result.correct ? false : item.revisionMarked } : item));
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

  async function toggleRevisionMark() {
    if (!question) return;
    const marked = !question.revisionMarked;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/revision`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marked }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setError(result?.error || "Revision mark could not be saved."); return; }
    setQuestion({ ...question, revisionMarked: marked });
    setQuestions((items) => items.map((item) => item.id === question.id ? { ...item, revisionMarked: marked } : item));
  }

  async function signOut() { await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }); location.href = "/login"; }
  const example = question?.public_examples?.[0];
  const languageAvailable = question?.language === "python" ? runner.python.available : question?.language === "pyspark" ? runner.pyspark.available : false;

  return <div className="trackShell">
    <aside className="trackSidebar"><a className="trackBrand" href="/"><span><Layers3 size={18} /></span><strong>Data Engineering<small>PRACTICE PLATFORM</small></strong></a><nav><a href="/"><Activity size={15} />Dashboard</a><a href="/sql"><Database size={15} />SQL lab</a><a className={moduleId === "python-etl" ? "active" : ""} href="/learn/python-etl"><Code2 size={15} />Python lab</a><a href="/pyspark"><Layers3 size={15} />PySpark lab</a><a className={moduleId === "azure-data-factory" || moduleId === "databricks-delta" ? "active" : ""} href="/learn/azure-data-factory"><Activity size={15} />Azure &amp; Databricks</a><a className={moduleId === "etl-data-quality" ? "active" : ""} href="/learn/etl-data-quality"><Target size={15} />ETL testing</a><a href="/interview"><BookOpen size={15} />Interview</a><a href="/ask-ai"><Sparkles size={15} />Ask AI</a><a href="/analytics"><BarChart3 size={15} />Progress</a></nav><button className="trackAccount" onClick={() => void signOut()}><span>{userName.slice(0, 1).toUpperCase()}</span><strong>{userName}</strong><LogOut size={14} /></button></aside>
    <main className="trackMain">
      <div className="trackBreadcrumb"><a href="/">Learning paths</a><span>/</span><span>{track.title}</span></div>
      <header className="trackHero"><div><div className="trackEyebrow"><Icon size={14} /> {track.eyebrow}</div><h1>{track.title}</h1><p>{module?.description || track.description}</p></div><div className="trackStats"><strong>{questions.length}</strong><span>QUESTIONS</span></div></header>
      {error && <div className="trackError" role="alert">{error}</div>}
      {moduleId !== "python-etl" && <section className="trackLevelBar"><div className="trackLevelIntro"><strong>Choose your starting point</strong><span>A–D very easy · E–H easy · I–K medium · L–N hard · O–R very hard</span></div><div className="trackLevelTabs" role="tablist" aria-label="Learning question bank">{[...levels, "all"].map((item) => <button key={item} role="tab" aria-label={item === "all" ? "All questions" : `Level ${item}, ${levelBand(item)}`} title={item === "all" ? "All questions" : `Level ${item} · ${levelBand(item)}`} aria-selected={level === item} className={level === item ? `selected level-${item.toLowerCase()}` : ""} onClick={() => setLevel(item)}><span>{item === "all" ? "All" : item}</span><small>{item === "all" ? questions.length : levelCounts[item]}</small></button>)}</div></section>}
      <div className="trackLayout" style={{ "--question-rail-width": `${railWidth}px` } as CSSProperties}>
        <aside className="trackQuestionRail">
          <div className="trackRailTitle"><strong>{revisionOnly ? "REVISION ONLY" : "QUESTION BANK"}</strong><span>{filteredQuestions.length}</span></div>
          <label className="questionRailWidthControl">Bank width <output>{railWidth}px</output><input type="range" min="220" max="560" step="10" value={railWidth} aria-label="Question bank width" onChange={(event) => setRailWidth(Number(event.target.value))} /></label>
          {moduleId === "python-etl" && <section className="pythonBankLevels">
            <div className="trackLevelIntro"><strong>Choose your starting point</strong><span>A–D very easy · E–H easy · I–K medium · L–N hard · O–R very hard</span></div>
            <div className="trackLevelTabs" role="tablist" aria-label="Python question bank">
              {[...levels, ...generatedDatasets.map((dataset) => dataset.key), "all"].map((item) => {
                const dataset = generatedDatasets.find((entry) => entry.key === item);
                const label = item === "all" ? "All" : dataset ? dataset.name : item;
                const count = item === "all" ? questions.length : levelCounts[item] || 0;
                return <button key={item} role="tab" aria-label={dataset ? `${dataset.name}, ${dataset.count} questions` : item === "all" ? "All questions" : `Level ${item}, ${levelBand(item)}`} title={dataset ? dataset.name : item === "all" ? "All questions" : `Level ${item} · ${levelBand(item)}`} aria-selected={level === item} className={`${level === item ? "selected " : ""}${dataset ? "level-dataset" : `level-${item.toLowerCase()}`}`} onClick={() => setLevel(item)}><span>{label}</span><small>{count}</small></button>;
              })}
            </div>
          </section>}
          <button className={`trackRevisionFilter ${revisionOnly ? "active" : ""}`} onClick={() => { setRevisionOnly(!revisionOnly); if (!revisionOnly) setLevel("all"); }}><Flag size={13} />{revisionOnly ? "Show all questions" : "Revision only"}</button>
          <label className="trackSearch">Search this track<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises…" /></label>
          <div className="trackQuestionList">
            {filteredQuestions.map((item, index) => <button className={question?.id === item.id ? "selected" : ""} key={item.id} onClick={() => void selectQuestion(item)}><span className="trackQuestionName"><em>{String(index + 1).padStart(2, "0")}</em>{item.title}</span><small>{isGeneratedQuestion(item) ? `${item.dataset_name || "Dataset"} · ${item.topic}` : `Level ${levelFor(item)} · ${item.topic}`}{item.completed ? <Check size={12} /> : null}{item.revisionMarked ? <Flag size={12} aria-label="Marked for revision" /> : null}{item.bookmarked ? <Bookmark size={12} aria-label="Bookmarked" /> : null}</small></button>)}
            {!filteredQuestions.length && <p className="trackEmpty">{revisionOnly ? "No questions are marked for revision." : level.startsWith("dataset:") ? "This dataset has no questions yet." : "No questions at this level yet."}</p>}
          </div>
        </aside>
        {question ? <article className="trackQuestionDetail">
          <div className="trackQuestionMeta"><span className={`trackLevelBadge ${isGeneratedQuestion(question) ? "level-generated" : `level-${levelFor(question)}`}`}>{question.level_title || (isGeneratedQuestion(question) ? question.dataset_name || "Dataset-generated question" : `LEVEL ${levelFor(question)} · ${levelBand(levelFor(question))}`)}</span><span>{question.topic}{question.subtopic ? ` · ${question.subtopic}` : ""}</span><span>{question.difficulty_label || question.difficulty}</span><button className={`revision-action ${question.revisionMarked ? "active" : ""}`} aria-pressed={Boolean(question.revisionMarked)} onClick={() => void toggleRevisionMark()} aria-label={question.revisionMarked ? "Remove revision mark" : "Mark for revision"} title={question.revisionMarked ? "Remove revision mark" : "Mark for revision"}><Flag size={15} /></button><button className={`bookmark-action ${question.bookmarked ? "active" : ""}`} aria-pressed={Boolean(question.bookmarked)} onClick={() => void toggleBookmark()} aria-label={question.bookmarked ? "Remove bookmark" : "Bookmark question"} title={question.bookmarked ? "Remove bookmark" : "Bookmark question"}><Bookmark size={15} /></button></div>
          <h2>{question.title}</h2><p className="trackPrompt">{question.prompt}</p>
          <div className="trackActions"><button disabled={!review} onClick={() => setReviewVisible(!reviewVisible)}><BookOpen size={14} />{reviewVisible ? "Hide reference solution" : "Show reference solution"}</button></div>
          {question.type === "coding" ? <>
            <div className="trackCodingSpec"><div><strong>Input</strong><span>{question.input_description}</span></div><div><strong>Required output</strong><span>{question.output_description}</span></div></div>
            <div className="trackCodingGrid"><section className="trackCodePanel"><div className="trackPanelHead"><strong>{question.language === "python" ? "PYTHON" : "PYSPARK"} EDITOR</strong><button onClick={() => setCode(question.starter_code || "")}>Reset</button></div><CodeMirror value={code} height="480px" extensions={[python(), oneDark]} editable={!busy} onChange={(value) => setCode(value.slice(0, 32000))} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} /><div className="trackRunBar"><button disabled={!languageAvailable || busy || !code.trim()} onClick={() => void submitCode()}><Play size={14} />{busy ? "Running…" : "Run and submit"}</button><span>{languageAvailable ? "Isolated runner ready" : "Isolated runner unavailable; code is not sent to this server"}</span></div>{codeResult && <div className={`trackResult ${codeResult.correct ? "passed" : "failed"}`}><strong>{codeResult.correct ? "All tests passed" : "Tests need another try"}</strong><span>{codeResult.executionMs} ms</span>{codeResult.tests?.map((item: any) => <small key={item.name}>{item.name}: {item.passed ? "passed" : "failed"}</small>)}</div>}</section><aside className="trackPreview"><strong>PUBLIC EXAMPLE</strong>{example ? <><span>Input</span><pre>{JSON.stringify(example.input, null, 2)}</pre><span>Expected result</span><pre>{JSON.stringify(example.expected, null, 2)}</pre></> : <p>Sample input is supplied by the exercise.</p>}</aside></div>
            {question.hints?.length ? <details className="trackHints"><summary><Lightbulb size={14} /> Hints</summary>{question.hints.map((hint, index) => <p key={index}><b>{index + 1}.</b> {hint}</p>)}</details> : null}
            {attempts.length > 0 && <section className="trackHistory"><strong>RECENT SUBMISSIONS</strong>{attempts.slice(0, 5).map((attempt) => <p key={attempt.id}><span>{attempt.correct ? "Passed" : "Retry"}</span><time>{new Date(attempt.created_at).toLocaleString()}</time></p>)}</section>}
          </> : <>
            <section className="trackOptions" role="radiogroup" aria-label="Answer options">{question.options?.map((option) => <label className={answerId === option.id ? "selected" : ""} key={option.id}><input type="radio" name="track-answer" checked={answerId === option.id} disabled={Boolean(attemptResult)} onChange={() => setAnswerId(option.id)} /><span>{option.text}</span></label>)}</section>
            <div className="trackActions"><button className="trackPrimary" disabled={!answerId || busy || Boolean(attemptResult)} onClick={() => void submitChoice()}>{busy ? "Saving…" : "Check answer"}</button><button onClick={() => void toggleBookmark()}><Bookmark size={14} />{question.bookmarked ? "Saved" : "Save question"}</button></div>
            {attemptResult && <section className={`trackResult ${attemptResult.correct ? "passed" : "failed"}`}><strong>{attemptResult.correct ? "Correct" : "Try again"}</strong><p>{attemptResult.explanation}</p><b>Explanation</b><p>{attemptResult.referenceAnswer}</p>{attemptResult.commonMistakes?.length > 0 && <><b>Common pitfalls</b><ul>{attemptResult.commonMistakes.map((mistake: string) => <li key={mistake}>{mistake}</li>)}</ul></>}</section>}
            {question.hints?.length ? <details className="trackHints"><summary><Lightbulb size={14} /> Hints</summary>{question.hints.map((hint, index) => <p key={index}><b>{index + 1}.</b> {hint}</p>)}</details> : null}
          </>}
          {reviewVisible && review && <section className="trackResult">{review.referenceSolution ? <><div className="solutionCodeHeader"><strong>Reference solution</strong><CopyButton value={review.referenceSolution} /></div><pre><code>{review.referenceSolution}</code></pre></> : <><strong>Reference answer</strong><p>{review.referenceAnswer}</p></>}{review.explanation && <><b>Explanation</b><p>{review.explanation}</p></>}{review.commonMistakes?.length > 0 && <><b>Common pitfalls</b><ul>{review.commonMistakes.map((mistake: string) => <li key={mistake}>{mistake}</li>)}</ul></>}</section>}
          {attempts.length > 0 && question.type !== "coding" && <section className="trackHistory"><strong>RECENT ATTEMPTS</strong>{attempts.slice(0, 5).map((attempt) => <p key={attempt.id}><span>{attempt.correct ? "Correct" : "Retry"}</span><time>{new Date(attempt.created_at).toLocaleString()}</time></p>)}</section>}
        </article> : <article className="trackQuestionDetail trackEmptyDetail"><Icon size={26} /><h2>Choose an exercise to begin</h2><p>Start at Level A for the fundamentals, then move up as the patterns become familiar.</p></article>}
      </div>
      <footer className="trackFooter"><span>Progress, bookmarks, and attempts are private to your account.</span><a href="/">Back to dashboard <ArrowRight size={14} /></a></footer>
    </main>
  </div>;
}
