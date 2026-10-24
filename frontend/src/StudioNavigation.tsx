import { useEffect, useState } from "react";
import { Activity, BarChart3, BookOpen, Code2, Database, Layers3, LogOut, RefreshCw, Sparkles, Target } from "lucide-react";
import "./studio-sidebar.css";

type StudioNavigationProps = {
  activePath: string;
  refreshLabel?: string;
  onRefresh?: () => void;
};

const links = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/sql", label: "SQL lab", icon: Database },
  { href: "/learn/python-etl", label: "Python lab", icon: Code2 },
  { href: "/pyspark", label: "PySpark lab", icon: Layers3 },
  { href: "/learn/azure-data-factory", label: "Azure & Databricks", icon: Activity },
  { href: "/learn/etl-data-quality", label: "ETL testing", icon: Target },
  { href: "/notes", label: "Notes & Study Material", icon: BookOpen },
  { href: "/question-generation", label: "Question Generation", icon: Sparkles },
  { href: "/interview", label: "Interview", icon: BookOpen },
  { href: "/ask-ai", label: "Ask AI", icon: Sparkles },
  { href: "/analytics", label: "Progress & Analytics", icon: BarChart3 },
  { href: "/ai-interview", label: "AI interview", icon: Sparkles }
];

export default function StudioNavigation({ activePath, refreshLabel = "Refresh learning path", onRefresh }: StudioNavigationProps) {
  const [userName, setUserName] = useState("Data Engineer");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          location.href = "/login";
          return null;
        }
        if (!response.ok) throw new Error("Could not load account information.");
        return response.json();
      })
      .then((data) => {
        if (data?.user) setUserName(data.user.name || "Data Engineer");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load account information.");
      });
    return () => controller.abort();
  }, []);

  async function signOut() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Could not sign out. Please try again.");
      location.href = "/login";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out. Please try again.");
    }
  }

  return <aside className="studioSidebar">
    <a className="studioBrand" href="/" aria-label="Data Engineering Studio home">
      <span className="studioBrandMark"><Layers3 size={18} /></span>
      <span><strong>Data Engineering</strong><small>PRACTICE PLATFORM</small></span>
    </a>
    <nav className="studioActions" aria-label="Main navigation">
      {links.map(({ href, label, icon: Icon }) => <a className={activePath === href ? "studioNavActive" : ""} href={href} aria-current={activePath === href ? "page" : undefined} key={href}><Icon size={15} /> {label}</a>)}
      <button type="button" onClick={onRefresh || (() => location.reload())}><RefreshCw size={15} /> {refreshLabel}</button>
    </nav>
    {error && <p className="studioNavigationError" role="status">{error}</p>}
    <button className="studioSidebarAccount" onClick={() => void signOut()} title="Sign out">
      <span>{userName.slice(0, 1).toUpperCase()}</span>
      <span><strong>{userName}</strong><small>LEARNER ACCOUNT</small></span>
      <LogOut size={15} />
    </button>
  </aside>;
}
