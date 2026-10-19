import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, Play, RotateCcw } from "lucide-react";
import "./data-interview.css";

type Module = { id: string; title: string; questionCount: number };
type Question = { id: string; title: string; prompt: string; topic: string; difficulty: string };
type Session = {
  id: string;
  module_id: string;
  difficulty: string;
  duration_seconds: number;
  started_at: string;
  deadline_at: string;
  completed_at?: string;
  status: string;
  questions: Question[];
  responses?: any[];
  score?: number | null;
  revision_recommendations?: string[];
  unanswered_count?: number;
  feedback_pending_count?: number;
};

const API = "";

export default function DataEngineeringInterview() {
  const [modules, setModules] = useState<Module[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [track, setTrack] = useState("");
  const [difficulty, setDifficulty] = useState("mixed");
  const [count, setCount] = useState(5);
  const [duration, setDuration] = useState(1800);
  const [session, setSession] = useState<Session | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  async function load() {
    setBusy(true);
    setError("");
    try {
      const [moduleResponse, historyResponse] = await Promise.all([
        fetch(`${API}/api/learning/studio`, { credentials: "include" }),
        fetch(`${API}/api/interview/learning`, { credentials: "include" }),
      ]);
      if (moduleResponse.status === 401 || historyResponse.status === 401) {
        location.href = "/login";
        return;
      }
      if (!moduleResponse.ok || !historyResponse.ok) throw new Error("Interview studio is unavailable.");
      const moduleData = await moduleResponse.json();
      const available = (moduleData.modules as Module[]).filter((module) => module.questionCount > 0 && module.id !== "sql-interview-lab");
      setModules(available);
      setTrack((current) => current || available[0]?.id || "");
      setHistory(await historyResponse.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load interview tracks.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, session?.status]);

  const answeredIds = new Set((session?.responses || []).map((response) => response.question_id));
  const activeQuestion = session?.questions.find((question) => !answeredIds.has(question.id));
  const activeModule = modules.find((module) => module.id === session?.module_id);
  const remainingSeconds = session ? Math.max(0, Math.floor((new Date(session.deadline_at).getTime() - now) / 1000)) : 0;

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/interview/learning/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: track, difficulty, count, durationSeconds: duration }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start interview.");
      setSession(data);
      setAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start interview.");
    } finally {
      setBusy(false);
    }
  }

  async function resume(sessionId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/interview/learning/${sessionId}`, { credentials: "include" });
      if (response.status === 401) return void (location.href = "/login");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Interview could not be resumed.");
      setSession(data);
      setAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Interview could not be resumed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!session || !activeQuestion || !answer.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/interview/learning/${session.id}/answer`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: activeQuestion.id, answer }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Answer could not be saved.");
      setSession({ ...session, responses: [...(session.responses || []), result.response] });
      setAnswer("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Answer could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/interview/learning/${session.id}/finish`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Interview could not be completed.");
      setSession(data.session);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Interview could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (session?.status === "completed") return <main className="dataInterviewPage">
    <header className="dataInterviewHeader"><a href="/" aria-label="Return to learning"><ArrowLeft size={16} /> Learning path</a><span>INTERVIEW REVIEW</span></header>
    <section className="interviewReport"><span className="interviewEyebrow">{activeModule?.title || session.module_id}</span><h1>Session report</h1><p className="reportCaveat">AI feedback is a coaching aid, not an objective hiring score.</p>
      <div className="reportMetrics"><div><strong>{session.score === null || session.score === undefined ? "—" : `${session.score}%`}</strong><span>Average rubric score</span></div><div><strong>{session.responses?.filter((response) => response.feedback).length || 0}/{session.questions?.length || 0}</strong><span>Responses evaluated</span></div><div><strong>{session.unanswered_count || 0}</strong><span>Questions unanswered</span></div></div>
      {session.revision_recommendations?.length ? <section className="reportTopics"><h2>Review these concepts</h2><ul>{session.revision_recommendations.map((item) => <li key={item}>{item}</li>)}</ul></section> : <p>No revision topics were produced for this session.</p>}
      {(session.responses || []).map((response) => <article className="reportAnswer" key={response.id}><h2>{session.questions.find((question) => question.id === response.question_id)?.title}</h2><p><b>Your response</b>{response.answer}</p>{response.feedback ? <div className="rubricGrid">{["correctness", "completeness", "reasoning", "tradeoffs"].map((criterion) => <div key={criterion}><strong>{response.feedback[criterion]}/5</strong><span>{criterion}</span></div>)}</div> : <p>AI feedback unavailable; your response was saved.</p>}</article>)}
      <button className="interviewPrimary" onClick={() => { setSession(null); void load(); }}>Back to interview tracks</button>
    </section>
  </main>;

  return <main className="dataInterviewPage">
    <header className="dataInterviewHeader"><a href="/" aria-label="Return to learning"><ArrowLeft size={16} /> Learning path</a><span>DATA ENGINEERING INTERVIEW</span></header>
    <section className="interviewIntro"><span className="interviewEyebrow">PRACTICE SESSION</span><h1>Think aloud.<br />Design for failure.</h1><p>One question at a time, with rubric-based AI feedback when the provider is configured. Your answers are saved before evaluation.</p></section>
    {error && <div className="studioAlert" role="alert">{error}</div>}
    {!session ? <div className="interviewSetup"><section><h2>Configure your session</h2><label>Track<select value={track} onChange={(event) => setTrack(event.target.value)}>{modules.map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}</select></label><div className="interviewSetupGrid"><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="mixed">Mixed</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label>Questions<select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option></select></label><label>Time limit<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={900}>15 min</option><option value={1800}>30 min</option><option value={3600}>60 min</option></select></label></div><button className="interviewPrimary" disabled={busy || !track} onClick={() => void start()}><Play size={15} /> {busy ? "Starting…" : "Start interview"}</button></section>
      {history.filter((item) => item.status === "in_progress").length > 0 && <section className="interviewResume"><h2>Resume a session</h2>{history.filter((item) => item.status === "in_progress").map((item) => <button key={item.id} onClick={() => void resume(item.id)} disabled={busy}><span><strong>{modules.find((module) => module.id === item.module_id)?.title || item.module_id}</strong><small>{new Date(item.started_at).toLocaleString()} · {item.responses?.length || 0} answered</small></span><RotateCcw size={15} /></button>)}</section>}
      {history.filter((item) => item.status === "completed").length > 0 && <section className="interviewResume"><h2>Past reports</h2>{history.filter((item) => item.status === "completed").slice(0, 10).map((item) => <button key={item.id} onClick={() => void resume(item.id)} disabled={busy}><span><strong>{modules.find((module) => module.id === item.module_id)?.title || item.module_id}</strong><small>{new Date(item.completed_at || item.started_at).toLocaleString()} · {item.score === null || item.score === undefined ? "No rubric score" : `${item.score}% rubric score`}</small></span><ArrowRight size={15} /></button>)}</section>}
    </div> : <section className="interviewActive"><div className="interviewActiveBar"><span>{activeModule?.title || session.module_id}</span><span><Clock3 size={15} /> {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}</span></div>
      {activeQuestion ? <article className="interviewPrompt"><div><span>{activeQuestion.topic}</span><span>{activeQuestion.difficulty}</span><span>{answeredIds.size + 1} / {session.questions.length}</span></div><h2>{activeQuestion.title}</h2><p>{activeQuestion.prompt}</p><label>Your response<textarea value={answer} maxLength={8000} onChange={(event) => setAnswer(event.target.value)} placeholder="Explain your approach and trade-offs…" /></label><button className="interviewPrimary" onClick={() => void submitAnswer()} disabled={busy || !answer.trim()}>{busy ? "Saving and evaluating…" : "Save response"} <ArrowRight size={15} /></button></article> : <div className="interviewAllAnswered"><Check size={20} /><h2>All questions answered</h2><p>You can finish now, or review the feedback below.</p></div>}
      {(session.responses || []).map((response) => <article className="interviewFeedback" key={response.id}><h3>{session.questions.find((question) => question.id === response.question_id)?.title}</h3>{response.feedback ? <><div className="rubricGrid">{["correctness", "completeness", "reasoning", "tradeoffs"].map((criterion) => <div key={criterion}><strong>{response.feedback[criterion]}/5</strong><span>{criterion}</span></div>)}</div><p>{response.feedback.strengths?.join(" ")}</p>{response.feedback.gaps?.length > 0 && <p><b>Consider:</b> {response.feedback.gaps.join("; ")}</p>}<p><b>Follow-up:</b> {response.feedback.followUpQuestion}</p></> : <p>Your response is saved. AI feedback is currently unavailable; you can still continue the session.</p>}</article>)}
      <button className="interviewFinish" onClick={() => void finish()} disabled={busy}>{busy ? "Finishing…" : "Finish and review"}</button>
    </section>}
  </main>;
}