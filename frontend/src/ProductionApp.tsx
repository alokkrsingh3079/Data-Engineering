import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Activity,
  BarChart3,
  Shield,
  Users,
  BookOpen,
  Flag,
  ClipboardList,
  Download,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Database,
  Layers3,
  Sparkles,
  Target,
} from "lucide-react";
import "./admin-console.css";
import "./analytics-report.css";
import StudioNavigation from "./StudioNavigation";
import DailyProgressCalendar from "./DailyProgressCalendar";
const API = "";
export function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [register, setRegister] = useState(false),
    [msg, setMsg] = useState(""),
    [busy, setBusy] = useState(false);
  async function go() {
    setMsg("");
    setBusy(true);
    try {
      const r = await fetch(
        API + (register ? "/api/auth/register" : "/api/auth/login"),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            register ? { name, email, password } : { email, password },
          ),
        },
      );
      const responseText = await r.text();
      let result: any = null;
      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = null;
      }
      if (!r.ok) {
        setMsg(
          result?.error ||
            `The server returned HTTP ${r.status}. Check the backend logs.`,
        );
        return;
      }
      if (!result?.user?.role) {
        setMsg("The server returned an invalid authentication response.");
        return;
      }
      location.href = register || result.user.role !== "admin" ? "/" : "/admin";
    } catch {
      setMsg("Could not reach the authentication server. Check that the backend is running.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="authPage">
      <aside className="authBrandPanel">
        <a className="studioBrand" href="/" aria-label="Data Engineering Practice Platform home">
          <span className="studioBrandMark"><Layers3 size={19} /></span>
          <span><strong>Data Engineering</strong><small>PRACTICE PLATFORM</small></span>
        </a>
        <h2>Build job-ready skills across the data stack.</h2>
        <p>One place to learn, practice, track progress, and prepare for data engineering interviews.</p>
        <div className="authFeatureList"><span><Database size={15} /> PostgreSQL schemas and SQL challenges</span><span><Code2 size={15} /> Python and PySpark practice tracks</span><span><Sparkles size={15} /> Guided learning paths and AI tutoring</span></div>
      </aside>
      <div className="authCard">
        <div className="brandMark">✦</div>
        <h1>Welcome back</h1>
        <p>
          {register
            ? "Create your Data Engineering learning account"
            : "Sign in to your Data Engineering practice platform"}
        </p>
        {register && (
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="primary" onClick={() => void go()} disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
        {msg && <div className="errorBox">{msg}</div>}
        <button className="linkBtn" onClick={() => setRegister(!register)}>
          {register
            ? "Already have an account? Sign in"
            : "Create a learner account"}
        </button>
      </div>
    </div>
  );
}
export function AdminApp() {
  const [metrics, setMetrics] = useState<any>(null),
    [users, setUsers] = useState<any[]>([]),
    [questions, setQuestions] = useState<any[]>([]),
    [audit, setAudit] = useState<any[]>([]),
    [tab, setTab] = useState("overview"),
    [msg, setMsg] = useState("");
  async function load() {
    const h = {};
    const [m, u, q, a] = await Promise.all([
      fetch(API + "/api/admin/metrics", { headers: h }),
      fetch(API + "/api/admin/users", { headers: h }),
      fetch(API + "/api/admin/questions", { headers: h }),
      fetch(API + "/api/admin/audit", { headers: h }),
    ]);
    if ([m, u, q, a].some((x) => x.status === 401 || x.status === 403)) {
      location.href = "/login";
      return;
    }
    setMetrics(await m.json());
    setUsers(await u.json());
    setQuestions(await q.json());
    setAudit(await a.json());
  }
  useEffect(() => {
    load();
  }, []);
  async function review(id: string, status: string) {
    const r = await fetch(API + `/api/admin/questions/${id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    setMsg(r.ok ? "Review saved" : "Review failed");
    load();
  }
  return (
    <div className="adminPage">
      <header className="adminTop">
        <div>
          <b>SQL Practice · Production Console</b>
          <small>Administration, moderation, analytics and operations</small>
        </div>
        <div className="adminTopActions">
          <a href="/" className="adminPracticeLink"><ArrowLeft size={15} /> Go to Practice</a>
          <button
            onClick={async () => {
              await fetch(API + "/api/auth/logout", {
                method: "POST",
                credentials: "include",
              });
              location.href = "/login";
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>
      <div className="adminBody">
        <aside className="adminNav">
          {[
            ["overview", BarChart3, "Overview"],
            ["users", Users, "Users"],
            ["questions", BookOpen, "Questions"],
            ["audit", ClipboardList, "Audit log"],
          ].map(([k, I, l]: any) => (
            <button
              className={tab === k ? "active" : ""}
              onClick={() => setTab(k)}
              key={k}
            >
              <I size={16} />
              {l}
            </button>
          ))}
        </aside>
        <main className="adminMain">
          {msg && <div className="successBox">{msg}</div>}
          {tab === "overview" && (
            <>
              <h1>Platform overview</h1>
              <div className="metricGrid">
                {[
                  ["Users", metrics?.users?.total],
                  ["Active users", metrics?.users?.active],
                  ["Questions", metrics?.questions?.total],
                  ["AI questions", metrics?.questions?.ai],
                  ["Attempts", metrics?.attempts?.attempts],
                  ["Correct", metrics?.attempts?.correct],
                  ["Avg execution", `${metrics?.attempts?.avg_ms || 0} ms`],
                  ["Databases", metrics?.databases?.total],
                ].map((x) => (
                  <div className="metric" key={x[0]}>
                    <b>{x[1] ?? "—"}</b>
                    <span>{x[0]}</span>
                  </div>
                ))}
              </div>
              <div className="opsCard">
                <Shield />
                <div>
                  <b>Security posture</b>
                  <p>
                    Server-side API key handling, read-only SQL execution,
                    request rate limiting, security headers, RBAC and audit
                    logging are enabled.
                  </p>
                </div>
              </div>
            </>
          )}
          {tab === "users" && (
            <>
              <h1>User management</h1>
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.status}</td>
                      <td>
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString()
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {tab === "questions" && (
            <>
              <h1>Question moderation</h1>
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Question</th>
                    <th>Difficulty</th>
                    <th>Topic</th>
                    <th>Source</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td>{q.title}</td>
                      <td>{q.difficulty}</td>
                      <td>{q.topic}</td>
                      <td>{q.source}</td>
                      <td>
                        <button onClick={() => review(q.id, "approved")}>
                          <CheckCircle2 size={14} />
                        </button>
                        <button onClick={() => review(q.id, "rejected")}>
                          <AlertTriangle size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {tab === "audit" && (
            <>
              <h1>Audit log</h1>
              <table className="adminTable">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.created_at).toLocaleString()}</td>
                      <td>{a.email || "system"}</td>
                      <td>{a.action}</td>
                      <td>
                        {a.resource_type || ""} {a.resource_id || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
export function Analytics() {
  const [x, setX] = useState<{ topics: { topic: string; attempts: number; correct: number; avg_ms: number }[] }>({ topics: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(API + "/api/analytics/overview", { credentials: "include" });
      if (response.status === 401) {
        location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error("Analytics are temporarily unavailable.");
      setX(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, []);

  const attempts = x.topics.reduce((total, topic) => total + topic.attempts, 0);
  const correct = x.topics.reduce((total, topic) => total + topic.correct, 0);
  const incorrect = Math.max(0, attempts - correct);
  const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
  const practicedTopics = x.topics.filter((topic) => topic.attempts > 0).length;
  const rankedTopics = x.topics.filter((topic) => topic.attempts >= 3)
    .map((topic) => ({ ...topic, accuracy: Math.round(topic.correct / topic.attempts * 100) }));
  const focusTopic = [...rankedTopics].sort((left, right) => left.accuracy - right.accuracy || right.attempts - left.attempts)[0];
  const strongestTopic = [...rankedTopics].sort((left, right) => right.accuracy - left.accuracy || right.attempts - left.attempts)[0];
  const responseTimes = x.topics.filter((topic) => topic.attempts > 0).sort((left, right) => right.avg_ms - left.avg_ms);
  const maxResponseTime = Math.max(1, ...responseTimes.map((topic) => topic.avg_ms));
  return (
    <div className="studioShell">
      <StudioNavigation activePath="/analytics" refreshLabel="Refresh analytics" onRefresh={() => void loadAnalytics()} />
      <main className="studioPage analyticsStudioPage">
      <div className="analyticsPage">
      <div className="analyticsHead">
        <div>
          <b>Learning Analytics</b>
          <span>Practice performance and topic mastery</span>
        </div>
        <a href="/">← Back to practice</a>
        <a href={API + "/api/export/progress"}>
          <Download size={15} /> Export CSV
        </a>
      </div>
      {error && <p className="analyticsLoadError" role="status">{error}</p>}
      <section className="analyticsSummary" aria-label="Overall SQL practice summary">
        <article><span>QUESTIONS ATTEMPTED</span><strong>{loading ? "—" : attempts}</strong><small>SQL practice attempts</small></article>
        <article><span>OVERALL ACCURACY</span><strong>{loading || !attempts ? "—" : `${accuracy}%`}</strong><small>{correct} correct · {incorrect} incorrect</small></article>
        <article><span>TOPICS PRACTICED</span><strong>{loading ? "—" : practicedTopics}</strong><small>with at least one attempt</small></article>
        <article className="analyticsFocusCard"><span>FOCUS AREA</span><strong>{loading ? "—" : focusTopic?.topic || "Keep practicing"}</strong><small>{focusTopic ? `${focusTopic.accuracy}% accuracy · ${focusTopic.attempts} attempts` : "Need at least 3 attempts for a recommendation"}</small></article>
      </section>
      <section className="analyticsVisualGrid" aria-label="Performance analysis">
        <article className="analyticsVisualCard analyticsAccuracyPanel">
          <header><div><span>ANSWER QUALITY</span><h2>Accuracy breakdown</h2></div></header>
          <div className="analyticsAccuracyContent">
            <div className="analyticsDonut" style={{ background: attempts ? `conic-gradient(#46cba6 0% ${accuracy}%, #d2777e ${accuracy}% 100%)` : "conic-gradient(#294255 0% 100%)" }} role="img" aria-label={attempts ? `${accuracy}% correct, ${incorrect} incorrect answers` : "No answer data yet"}>
              <div><strong>{loading || !attempts ? "—" : `${accuracy}%`}</strong><small>correct</small></div>
            </div>
            <div className="analyticsAccuracyLegend">
              <span><i className="analyticsCorrectDot" /><b>Correct</b><strong>{loading ? "—" : correct}</strong></span>
              <span><i className="analyticsIncorrectDot" /><b>Incorrect</b><strong>{loading ? "—" : incorrect}</strong></span>
              <small>{attempts ? `${correct} of ${attempts} attempts were correct` : "Submit practice answers to build your report."}</small>
            </div>
          </div>
        </article>
        <article className="analyticsVisualCard analyticsSpeedPanel">
          <header><div><span>QUERY PERFORMANCE</span><h2>Average execution time</h2></div><small>milliseconds</small></header>
          {responseTimes.length ? <div className="analyticsSpeedList">{responseTimes.slice(0, 6).map((topic) => <div className="analyticsSpeedRow" key={topic.topic} title={`${topic.topic}: ${topic.avg_ms} ms average`}>
            <span>{topic.topic}</span><div><i style={{ width: `${Math.max(2, topic.avg_ms / maxResponseTime * 100)}%` }} /></div><strong>{topic.avg_ms} ms</strong>
          </div>)}</div> : <p className="analyticsEmpty">Execution-time details will appear after practice attempts.</p>}
        </article>
      </section>
      <div className="analyticsTopicHeading"><div><span>SKILL BREAKDOWN</span><h2>Practice performance and topic mastery</h2></div>{strongestTopic && <p>Strongest: <b>{strongestTopic.topic}</b> · {strongestTopic.accuracy}%</p>}</div>
      <div className="topicCards">
        {x.topics.map((t) => (
          <div className="topicCard" key={t.topic}>
            <b>{t.topic}</b>
            <strong>
              {t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0}%
            </strong>
            <i className="topicMasteryBar"><span style={{ width: `${t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0}%` }} /></i>
            <span>
              {t.correct}/{t.attempts} correct · {t.avg_ms} ms avg
            </span>
          </div>
        ))}
        {!loading && !error && x.topics.length === 0 && <p className="analyticsEmpty">Complete a SQL practice question to start building your topic report.</p>}
      </div>
      <DailyProgressCalendar />
      </div>
      </main>
    </div>
  );
}

export function Interview() {
  const [dbs, setDbs] = useState<any[]>([]),
    [db, setDb] = useState(""),
    [questions, setQuestions] = useState<any[]>([]),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [sessionId, setSessionId] = useState(""),
    [started, setStarted] = useState(false),
    [score, setScore] = useState<any>(null),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch(API + "/api/databases")
      .then((r) => r.json())
      .then((x) => {
        setDbs(x);
        if (x[0]) setDb(x[0].id);
      });
  }, []);
  async function start() {
    setLoading(true);
    const r = await fetch(API + "/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        databaseId: db,
        count: 10,
        durationSeconds: 1800,
      }),
    });
    const x = await r.json();
    if (!r.ok) {
      setLoading(false);
      return;
    }
    setSessionId(x.sessionId);
    setQuestions(x.questions);
    setStarted(true);
    setLoading(false);
  }
  async function finish() {
    setLoading(true);
    const r = await fetch(API + "/api/interview/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interviewSessionId: sessionId,
        answers: questions.map((q) => ({
          questionId: q.id,
          sql: answers[q.id] || "",
        })),
      }),
    });
    setScore(await r.json());
    setLoading(false);
  }
  if (score)
    return (
      <div className="analyticsPage">
        <div className="authCard">
          <h1>Interview Result</h1>
          <strong className="resultScore">{score.score}%</strong>
          <p>
            {score.correct} of {score.total} answers matched the verified
            expected outputs.
          </p>
          <a className="backLink" href="/">
            Return to practice
          </a>
        </div>
      </div>
    );
  return (
    <div className="analyticsPage">
      <div className="analyticsHead">
        <div>
          <b>SQL Interview Mode</b>
          <span>Timed, schema-grounded, automatically scored</span>
        </div>
        <a href="/">← Back</a>
      </div>
      {!started ? (
        <div className="authCard">
          <h2>Start mock interview</h2>
          <p>
            10 questions, mixed difficulty. Your SQL is executed against the
            selected practice database.
          </p>
          <select value={db} onChange={(e) => setDb(e.target.value)}>
            {dbs.map((d) => (
              <option value={d.id} key={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button className="primary" disabled={!db || loading} onClick={start}>
            {loading ? "Starting…" : "Start interview"}
          </button>
        </div>
      ) : (
        <>
          <div className="interviewGrid">
            {questions.map((q, i) => (
              <div className="interviewQuestion" key={q.id}>
                <div>
                  <b>
                    Q{i + 1} · {q.difficulty}
                  </b>
                  <span>{q.topic}</span>
                </div>
                <h2>{q.title}</h2>
                <p>{q.task}</p>
                <textarea
                  placeholder="Write your SQL here…"
                  value={answers[q.id] || ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <button
            className="primary finishBtn"
            onClick={finish}
            disabled={loading}
          >
            {loading ? "Scoring…" : "Submit interview"}
          </button>
        </>
      )}
    </div>
  );
}
