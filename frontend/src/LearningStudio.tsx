import { useDeferredValue, useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Circle, Code2, Database, Layers3, RefreshCw } from "lucide-react";
import "./learning-studio.css";
import "./learning-engine.css";
import "./studio-polish.css";

type Lesson = {
  id: string;
  title: string;
  objective: string;
  content: string[];
  example?: string;
  completed: boolean;
};

type Module = {
  id: string;
  title: string;
  category: string;
  description: string;
  runner: "available" | "unavailable";
  href?: string;
  questionCount: number;
  completedQuestions: number;
  continueQuestionId: string | null;
  lessons: Lesson[];
};

type Question = {
  id: string;
  title: string;
  prompt: string;
  module_id: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  type: string;
  tags: string[];
  options: { id: string; text: string }[];
  hints: string[];
  language?: "python" | "pyspark";
  starter_code?: string;
  input_description?: string;
  output_description?: string;
  public_examples?: { input: unknown; expected: unknown }[];
  bookmarked: boolean;
  completed: boolean;
};

type QuestionResult = {
  correct: boolean;
  explanation: string;
  referenceAnswer: string;
  commonMistakes: string[];
};

type TopicProgress = { module_id: string; topic: string; total: number; completed: number };
type RecentLearningAttempt = { question_id: string; correct: boolean; question?: Question };
type RunnerStatus = { configured: boolean; available: boolean };
type CodeResult = { correct: boolean; executionMs: number; tests: { name: string; passed: boolean }[] };

const API = "";

export default function LearningStudio() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionId, setQuestionId] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [questionState, setQuestionState] = useState("all");
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPages, setQuestionPages] = useState(1);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [answerId, setAnswerId] = useState("");
  const [answerResult, setAnswerResult] = useState<QuestionResult | null>(null);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [topics, setTopics] = useState<TopicProgress[]>([]);
  const [recentAttempt, setRecentAttempt] = useState<RecentLearningAttempt | null>(null);
  const [runnerStatus, setRunnerStatus] = useState<{ python: RunnerStatus; pyspark: RunnerStatus }>({
    python: { configured: false, available: false },
    pyspark: { configured: false, available: false }
  });
  const [codeDraft, setCodeDraft] = useState("");
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null);
  const [codeRunning, setCodeRunning] = useState(false);
  const deferredSearch = useDeferredValue(questionSearch);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/learning/studio`, { credentials: "include" });
      if (response.status === 401) {
        location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Learning content is temporarily unavailable.");
      const data = (await response.json()) as { modules: Module[] };
      setModules(data.modules);
      const runnerResponse = await fetch(`${API}/api/learning/runners/status`, { credentials: "include" });
      if (runnerResponse.ok) setRunnerStatus(await runnerResponse.json());
      const routeModule = decodeURIComponent(location.pathname.split("/")[2] || "");
      const initial = data.modules.find((module) => module.id === routeModule) || data.modules.find((module) => module.id === selectedModule) || data.modules[0];
      setSelectedModule(initial?.id || "");
      setSelectedLesson((current) => current || initial?.lessons[0]?.id || "");
      const topicResponse = await fetch(`${API}/api/learning/progress/topics`, { credentials: "include" });
      if (topicResponse.ok) setTopics(await topicResponse.json());
      const recentResponse = await fetch(`${API}/api/learning/attempts/recent?limit=1`, { credentials: "include" });
      if (recentResponse.ok) {
        const recent = await recentResponse.json();
        if (recent[0]?.question_id) {
          const recentQuestion = await fetch(`${API}/api/learning/questions/${recent[0].question_id}`, { credentials: "include" });
          if (recentQuestion.ok) setRecentAttempt({ ...recent[0], question: await recentQuestion.json() });
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load learning content.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const categories = ["All", ...new Set(modules.map((module) => module.category))];
  const visibleModules = filter === "All" ? modules : modules.filter((module) => module.category === filter);
  const activeModule = visibleModules.find((module) => module.id === selectedModule) || visibleModules[0];
  const activeLesson = activeModule?.lessons.find((lesson) => lesson.id === selectedLesson) || activeModule?.lessons[0];

  useEffect(() => {
    if (!activeModule || activeModule.questionCount === 0) {
      setQuestions([]);
      setQuestionId("");
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ moduleId: activeModule.id, page: String(questionPage), pageSize: "20", state: questionState });
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (difficulty) params.set("difficulty", difficulty);
    if (questionType) params.set("type", questionType);
    if (questionTopic) params.set("topic", questionTopic);
    setQuestionLoading(true);
    fetch(`${API}/api/learning/questions?${params}`, { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          location.href = "/login";
          return null;
        }
        if (!response.ok) throw new Error("Question bank is temporarily unavailable.");
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        setQuestions(data.items);
        setQuestionPages(data.totalPages);
        setQuestionTotal(data.total);
        setQuestionId((current) => {
          if (current && data.items.some((item: Question) => item.id === current)) return current;
          if (activeModule.continueQuestionId && data.items.some((item: Question) => item.id === activeModule.continueQuestionId)) return activeModule.continueQuestionId;
          return "";
        });
      })
      .catch((cause) => {
        if (cause.name !== "AbortError") setError(cause instanceof Error ? cause.message : "Question bank is unavailable.");
      })
      .finally(() => setQuestionLoading(false));
    return () => controller.abort();
  }, [activeModule?.id, activeModule?.questionCount, activeModule?.continueQuestionId, questionPage, questionState, deferredSearch, difficulty, questionType, questionTopic]);

  useEffect(() => {
    if (!activeModule || activeModule.questionCount === 0) {
      setAvailableTopics([]);
      setQuestionTopic("");
      return;
    }
    const controller = new AbortController();
    fetch(`${API}/api/learning/topics?moduleId=${encodeURIComponent(activeModule.id)}`, { credentials: "include", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : [])
      .then((data) => {
        if (controller.signal.aborted) return;
        setAvailableTopics(data);
        setQuestionTopic((current) => data.includes(current) ? current : "");
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeModule?.id, activeModule?.questionCount]);

  useEffect(() => {
    if (!questionId) {
      setQuestion(null);
      setAnswerResult(null);
      setAttempts([]);
      return;
    }
    const controller = new AbortController();
    setAnswerId("");
    setAnswerResult(null);
    setCodeDraft("");
    setCodeResult(null);
    setHintsOpen(false);
    Promise.all([
      fetch(`${API}/api/learning/questions/${questionId}`, { credentials: "include", signal: controller.signal }).then((response) => response.json()),
      fetch(`${API}/api/learning/questions/${questionId}/attempts?limit=10`, { credentials: "include", signal: controller.signal }).then((response) => response.json()),
    ]).then(([questionData, attemptData]) => {
      if (!controller.signal.aborted && questionData.id) {
        setQuestion(questionData);
        setCodeDraft(questionData.starter_code || "");
        setAttempts(Array.isArray(attemptData) ? attemptData : []);
      }
    }).catch((cause) => {
      if (cause.name !== "AbortError") setError("Could not load this question.");
    });
    return () => controller.abort();
  }, [questionId]);

  async function markComplete(lesson: Lesson) {
    const response = await fetch(`${API}/api/learning/lessons/${lesson.id}/completion`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !lesson.completed }),
    });
    if (response.status === 401) {
      location.href = "/login";
      return;
    }
    if (!response.ok) {
      setError("Progress could not be saved. Please retry.");
      return;
    }
    setModules((current) => current.map((module) => ({
      ...module,
      lessons: module.lessons.map((item) => item.id === lesson.id ? { ...item, completed: !item.completed } : item),
    })));
  }

  function chooseModule(module: Module) {
    if (module.href === "/sql" || module.href === "/interview") {
      location.href = module.href;
      return;
    }
    setSelectedModule(module.id);
    setSelectedLesson(module.lessons[0]?.id || "");
    setQuestionId("");
    setQuestionPage(1);
    setQuestionTopic("");
    window.history.pushState({}, "", `/learn/${module.id}`);
  }

  function resumeQuestion(questionToResume: Question) {
    const targetModule = modules.find((module) => module.id === questionToResume.module_id);
    if (!targetModule) return;
    setFilter("All");
    setSelectedModule(targetModule.id);
    setQuestionState("all");
    setQuestionSearch("");
    setDifficulty("");
    setQuestionType("");
    setQuestionTopic("");
    setQuestionPage(1);
    setQuestionId(questionToResume.id);
    window.history.pushState({}, "", `/learn/${targetModule.id}`);
  }

  async function submitAnswer() {
    if (!question || !answerId) return;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/attempt`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId: answerId }),
    });
    if (response.status === 401) {
      location.href = "/login";
      return;
    }
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Answer could not be saved.");
      return;
    }
    setAnswerResult(result);
    setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, completed: item.completed || result.correct } : item));
    const history = await fetch(`${API}/api/learning/questions/${question.id}/attempts?limit=10`, { credentials: "include" });
    if (history.ok) setAttempts(await history.json());
  }

  async function runCode() {
    if (!question || question.type !== "coding" || !codeDraft.trim()) return;
    setCodeRunning(true);
    setError("");
    setCodeResult(null);
    try {
      const response = await fetch(`${API}/api/learning/questions/${question.id}/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeDraft }),
      });
      if (response.status === 401) {
        location.href = "/login";
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "The isolated runner could not execute this submission.");
        return;
      }
      setCodeResult(result);
      setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, completed: item.completed || result.correct } : item));
      const history = await fetch(`${API}/api/learning/questions/${question.id}/attempts?limit=10`, { credentials: "include" });
      if (history.ok) setAttempts(await history.json());
    } catch {
      setError("The isolated runner is unavailable.");
    } finally {
      setCodeRunning(false);
    }
  }

  async function toggleBookmark() {
    if (!question) return;
    const marked = !question.bookmarked;
    const response = await fetch(`${API}/api/learning/questions/${question.id}/bookmark`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marked }),
    });
    if (!response.ok) {
      setError("Bookmark could not be saved.");
      return;
    }
    setQuestion({ ...question, bookmarked: marked });
    setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, bookmarked: marked } : item));
  }

  return (
    <main className="studioPage">
      <header className="studioHeader">
        <a className="studioBrand" href="/" aria-label="Data Engineering Studio home">
          <span className="studioBrandMark"><Layers3 size={18} /></span>
          <span><strong>Fieldnotes</strong><small>DATA ENGINEERING STUDIO</small></span>
        </a>
        <nav className="studioActions" aria-label="Main navigation">
          <a className="studioNavActive" href="/">Learning path</a>
          <a href="/sql"><Database size={15} /> SQL lab</a>
          <a href="/learn/python-etl"><Code2 size={15} /> Python lab</a>
          <a href="/learn/pyspark-foundations"><Layers3 size={15} /> PySpark lab</a>
          <a href="/interview"><BookOpen size={15} /> Interview</a>
          <a href="/ai-interview">AI interview</a>
          <button type="button" onClick={() => void load()} title="Refresh learning content" aria-label="Refresh learning content"><RefreshCw size={16} /></button>
        </nav>
      </header>

      <section className="studioIntro">
        <div className="studioEyebrow">PRACTICE PATHS <span>{modules.length.toString().padStart(2, "0")} MODULES</span></div>
        <h1>Build the instincts<br />behind reliable data.</h1>
        <p>Short, practical lessons across Python, Spark, cloud pipelines, and data quality. Progress is saved to your account.</p>
        {recentAttempt?.question && <button className="resumeLearning" onClick={() => resumeQuestion(recentAttempt.question!)}><span>CONTINUE LAST QUESTION</span><strong>{recentAttempt.question.title}</strong><small>{recentAttempt.correct ? "Last result: correct" : "Last result: retry recommended"} <ArrowRight size={13} /></small></button>}
      </section>

      {error && <div className="studioAlert" role="alert">{error}</div>}
      <div className="studioFilters" role="tablist" aria-label="Filter learning modules">
        {categories.map((category) => <button key={category} className={filter === category ? "selected" : ""} onClick={() => setFilter(category)} role="tab" aria-selected={filter === category}>{category}</button>)}
      </div>

      {loading ? <div className="studioLoading">Loading your learning path…</div> : (
        <div className="studioLayout">
          <aside className="studioModuleList" aria-label="Learning modules">
            {visibleModules.map((module, index) => {
              const done = module.completedQuestions;
              const total = Math.max(module.questionCount, 1);
              return <button key={module.id} className={`studioModule ${activeModule?.id === module.id ? "active" : ""}`} onClick={() => chooseModule(module)}>
                <span className="moduleIndex">{String(index + 1).padStart(2, "0")}</span>
                <span className="moduleCopy"><strong>{module.title}</strong><small>{module.category} · {done}/{module.questionCount} questions</small><progress max={total} value={Math.min(done, total)} aria-label={`${module.title} completion`} /></span>
                <ArrowRight size={15} />
              </button>;
            })}
            {!visibleModules.length && <p className="studioEmpty">No modules in this category yet.</p>}
          </aside>

          {activeModule && activeModule.questionCount > 0 && <section className="studioQuestionBank" aria-label="Question bank">
            <div className="questionBankHead"><strong>Question bank</strong><span>{questionTotal} available</span></div>
            <label className="questionSearch">Search topics and questions<input value={questionSearch} onChange={(event) => { setQuestionSearch(event.target.value); setQuestionPage(1); }} placeholder="Try joins, retries, quality…" /></label>
            <div className="questionFilters">
              <label>Difficulty<select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setQuestionPage(1); }}><option value="">All</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
              <label>Type<select value={questionType} onChange={(event) => { setQuestionType(event.target.value); setQuestionPage(1); }}><option value="">All</option><option value="mcq">MCQ</option><option value="scenario">Scenario</option><option value="coding">Coding</option></select></label>
              <label>Topic<select value={questionTopic} onChange={(event) => { setQuestionTopic(event.target.value); setQuestionPage(1); }}><option value="">All topics</option>{availableTopics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}</select></label>
              <label>Progress<select value={questionState} onChange={(event) => { setQuestionState(event.target.value); setQuestionPage(1); }}><option value="all">All questions</option><option value="completed">Completed</option><option value="incorrect">Retry incorrect</option><option value="bookmarked">Bookmarks</option></select></label>
            </div>
            <div className="questionBankList">{questions.map((item) => <button key={item.id} className={questionId === item.id ? "active" : ""} onClick={() => setQuestionId(item.id)}><span><strong>{item.title}</strong><small>{item.topic} · {item.difficulty} · {item.type}</small></span><span className="questionMarks">{item.completed ? <Check size={14} aria-label="Completed" /> : null}{item.bookmarked ? "Saved" : ""}</span></button>)}{!questionLoading && !questions.length && <p className="studioEmpty">No questions match these filters yet.</p>}</div>
            <div className="questionPager"><button onClick={() => setQuestionPage((page) => Math.max(1, page - 1))} disabled={questionPage <= 1}>Previous</button><span>{questionPage} / {Math.max(questionPages, 1)}</span><button onClick={() => setQuestionPage((page) => Math.min(questionPages, page + 1))} disabled={questionPage >= questionPages}>Next</button></div>
          </section>}

          {question ? <article className="studioLesson studioQuestionDetail">
            <div className="lessonMeta"><span>{question.topic}{question.subtopic ? ` · ${question.subtopic}` : ""}</span><span>{question.difficulty.toUpperCase()} · {question.type.toUpperCase()}</span></div>
            <h2>{question.title}</h2>
            <p className="lessonObjective">{question.prompt}</p>
            {question.type === "coding" ? <div className="codingWorkspace">
              <div className="codingSpec"><div><strong>Input</strong><span>{question.input_description}</span></div><div><strong>Output</strong><span>{question.output_description}</span></div></div>
              {question.public_examples?.map((example, index) => <div className="codingExample" key={index}><strong>Example {index + 1}</strong><pre>{JSON.stringify(example, null, 2)}</pre></div>)}
              <label className="codeEditorLabel">{question.language === "pyspark" ? "PySpark" : "Python"} submission<textarea className="codeEditor" spellCheck={false} value={codeDraft} maxLength={32000} onChange={(event) => setCodeDraft(event.target.value)} /></label>
              <div className="questionActions"><button className="lessonComplete" onClick={() => void runCode()} disabled={!runnerStatus[question.language || "python"].available || codeRunning || !codeDraft.trim()}>{codeRunning ? "Running…" : "Run against tests"}</button><button className="questionAction" onClick={() => { setCodeDraft(question.starter_code || ""); setCodeResult(null); }}>Reset code</button><button className="questionAction" onClick={() => void toggleBookmark()}>{question.bookmarked ? "Remove bookmark" : "Bookmark"}</button><button className="questionAction" onClick={() => setHintsOpen((open) => !open)}>{hintsOpen ? "Hide hints" : "Show hints"}</button></div>
              {!runnerStatus[question.language || "python"].available && <div className="runnerNotice"><Code2 size={16} /><span><strong>Isolated runner unavailable</strong>{runnerStatus[question.language || "python"].configured ? "The configured runner did not pass its health check." : "No isolated execution service is configured. The code is not sent to or executed by this API."}</span></div>}
              {codeResult && <div className={`questionFeedback ${codeResult.correct ? "correct" : "incorrect"}`}><strong>{codeResult.correct ? "All tests passed" : "Some tests failed"}</strong><p>Execution time: {codeResult.executionMs} ms</p><ul>{codeResult.tests.map((item) => <li key={item.name}>{item.name}: {item.passed ? "passed" : "failed"}</li>)}</ul></div>}
            </div> : <div className="questionOptions" role="radiogroup" aria-label="Answer options">{question.options.map((option) => <label key={option.id} className={answerId === option.id ? "selected" : ""}><input type="radio" name="learning-answer" value={option.id} checked={answerId === option.id} onChange={() => setAnswerId(option.id)} disabled={Boolean(answerResult)} /><span>{option.text}</span></label>)}</div>}
            {question.type !== "coding" && <div className="questionActions"><button className="lessonComplete" onClick={() => void submitAnswer()} disabled={!answerId || Boolean(answerResult)}>Check answer</button>{answerResult && !answerResult.correct && <button className="questionAction" onClick={() => { setAnswerId(""); setAnswerResult(null); }}>Try again</button>}<button className="questionAction" onClick={() => void toggleBookmark()}>{question.bookmarked ? "Remove bookmark" : "Bookmark"}</button><button className="questionAction" onClick={() => setHintsOpen((open) => !open)}>{hintsOpen ? "Hide hints" : "Show hints"}</button></div>}
            {hintsOpen && <div className="questionHints">{question.hints.map((hint, index) => <p key={index}><strong>Hint {index + 1}</strong>{hint}</p>)}</div>}
            {answerResult && <div className={`questionFeedback ${answerResult.correct ? "correct" : "incorrect"}`}><strong>{answerResult.correct ? "Correct" : "Not quite"}</strong><p>{answerResult.explanation}</p><h3>Reference answer</h3><p>{answerResult.referenceAnswer}</p><h3>Common mistakes</h3><ul>{answerResult.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}</ul></div>}
            {attempts.length > 0 && <div className="questionHistory"><h3>Recent attempts</h3>{attempts.map((attempt) => <p key={attempt.id}><span>{attempt.correct ? "Correct" : "Incorrect"}</span><time>{new Date(attempt.created_at).toLocaleString()}</time></p>)}</div>}
            {topics.some((topic) => topic.module_id === question.module_id) && <div className="topicProgressList"><h3>Topic progress</h3>{topics.filter((topic) => topic.module_id === question.module_id).map((topic) => <p key={topic.topic}><span>{topic.topic}</span><strong>{topic.completed}/{topic.total}</strong></p>)}</div>}
            <button className="questionAction" onClick={() => setQuestionId("")}>Back to module notes</button>
          </article> : activeModule && activeLesson && <article className="studioLesson">
            <div className="lessonMeta"><span>{activeModule.category}</span><span>LESSON {String(activeModule.lessons.findIndex((lesson) => lesson.id === activeLesson.id) + 1).padStart(2, "0")}</span></div>
            <h2>{activeLesson.title}</h2>
            <p className="lessonObjective">{activeLesson.objective}</p>
            <div className="lessonBody">{activeLesson.content.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            {activeLesson.example && <pre className="lessonExample"><code>{activeLesson.example}</code></pre>}
            {activeModule.runner === "unavailable" && !(activeModule.category === "Python" ? runnerStatus.python.available : activeModule.category === "Spark" ? runnerStatus.pyspark.available : false) && <div className="runnerNotice"><Code2 size={16} /><span><strong>Execution unavailable</strong>{activeModule.category === "Python" && runnerStatus.python.configured || activeModule.category === "Spark" && runnerStatus.pyspark.configured ? "The configured isolated runner did not pass its health check." : "No isolated execution service is configured. Lesson examples are not executed by this app."}</span></div>}
            {activeModule.href && <a className="moduleLaunch" href={activeModule.href}>{activeModule.href === "/sql" ? "Open SQL practice" : activeModule.href === "/interview" ? "Start SQL interview" : "Continue learning"}<ArrowRight size={14} /></a>}
            <button className={`lessonComplete ${activeLesson.completed ? "done" : ""}`} onClick={() => void markComplete(activeLesson)}>
              {activeLesson.completed ? <Check size={16} /> : <Circle size={16} />}
              {activeLesson.completed ? "Completed" : "Mark lesson complete"}
            </button>
          </article>}
        </div>
      )}
      <footer className="studioFooter"><span>Practice progress is private to your account.</span><a href="/sql">Open SQL workspace <ArrowRight size={14} /></a></footer>
    </main>
  );
}