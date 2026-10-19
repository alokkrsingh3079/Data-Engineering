import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Circle, Code2, Database, Layers3, RefreshCw } from "lucide-react";
import "./learning-studio.css";

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
  lessons: Lesson[];
};

const API = "";

export default function LearningStudio() {
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      setSelectedModule((current) => current || data.modules[0]?.id || "");
      setSelectedLesson((current) => current || data.modules[0]?.lessons[0]?.id || "");
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
    setSelectedModule(module.id);
    setSelectedLesson(module.lessons[0]?.id || "");
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
          <a href="/interview"><BookOpen size={15} /> Interview</a>
          <button type="button" onClick={() => void load()} title="Refresh learning content" aria-label="Refresh learning content"><RefreshCw size={16} /></button>
        </nav>
      </header>

      <section className="studioIntro">
        <div className="studioEyebrow">PRACTICE PATHS <span>{modules.length.toString().padStart(2, "0")} MODULES</span></div>
        <h1>Build the instincts<br />behind reliable data.</h1>
        <p>Short, practical lessons across Python, Spark, cloud pipelines, and data quality. Progress is saved to your account.</p>
      </section>

      {error && <div className="studioAlert" role="alert">{error}</div>}
      <div className="studioFilters" role="tablist" aria-label="Filter learning modules">
        {categories.map((category) => <button key={category} className={filter === category ? "selected" : ""} onClick={() => setFilter(category)} role="tab" aria-selected={filter === category}>{category}</button>)}
      </div>

      {loading ? <div className="studioLoading">Loading your learning path…</div> : (
        <div className="studioLayout">
          <aside className="studioModuleList" aria-label="Learning modules">
            {visibleModules.map((module, index) => {
              const done = module.lessons.filter((lesson) => lesson.completed).length;
              return <button key={module.id} className={`studioModule ${activeModule?.id === module.id ? "active" : ""}`} onClick={() => chooseModule(module)}>
                <span className="moduleIndex">{String(index + 1).padStart(2, "0")}</span>
                <span className="moduleCopy"><strong>{module.title}</strong><small>{module.category} · {done}/{module.lessons.length} lessons</small></span>
                <ArrowRight size={15} />
              </button>;
            })}
            {!visibleModules.length && <p className="studioEmpty">No modules in this category yet.</p>}
          </aside>

          {activeModule && activeLesson && <article className="studioLesson">
            <div className="lessonMeta"><span>{activeModule.category}</span><span>LESSON {String(activeModule.lessons.findIndex((lesson) => lesson.id === activeLesson.id) + 1).padStart(2, "0")}</span></div>
            <h2>{activeLesson.title}</h2>
            <p className="lessonObjective">{activeLesson.objective}</p>
            <div className="lessonBody">{activeLesson.content.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            {activeLesson.example && <pre className="lessonExample"><code>{activeLesson.example}</code></pre>}
            {activeModule.runner === "unavailable" && <div className="runnerNotice"><Code2 size={16} /><span><strong>Execution unavailable</strong>Code runs in an isolated service that is not configured here. This lesson is educational; the example is not executed.</span></div>}
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