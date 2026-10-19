import { useEffect, useState } from "react";
import {
  ArrowLeft,
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
} from "lucide-react";
import "./admin-console.css";
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
        <a className="studioBrand" href="/" aria-label="Data Engineering Interview Studio home">
          <span className="studioBrandMark"><Layers3 size={19} /></span>
          <span><strong>Data Engineering</strong><small>INTERVIEW STUDIO</small></span>
        </a>
        <h2>Build the instincts behind reliable data.</h2>
        <p>Learn, practice, and get interview-ready across the tools used by modern data teams.</p>
        <div className="authFeatureList"><span><Database size={15} /> Real PostgreSQL practice</span><span><Code2 size={15} /> Isolated Python and Spark labs</span><span><Sparkles size={15} /> Progress paths and AI tutoring</span></div>
      </aside>
      <div className="authCard">
        <div className="brandMark">✦</div>
        <h1>SQL Practice Online</h1>
        <p>
          {register
            ? "Create your learning account"
            : "Sign in to your account"}
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
            : "Create a student account"}
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
  const [x, setX] = useState<any>({ topics: [] });
  useEffect(() => {
    fetch(API + "/api/analytics/overview", { credentials: "include" })
      .then((r) => {
        if (r.status === 401) {
          location.href = "/login";
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setX(data);
      });
  }, []);
  return (
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
      <div className="topicCards">
        {x.topics.map((t: any) => (
          <div className="topicCard" key={t.topic}>
            <b>{t.topic}</b>
            <strong>
              {t.attempts ? Math.round((t.correct / t.attempts) * 100) : 0}%
            </strong>
            <span>
              {t.correct}/{t.attempts} correct · {t.avg_ms} ms avg
            </span>
          </div>
        ))}
      </div>
      <DailyProgressCalendar />
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
        sessionId,
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
