import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, BarChart3, BookOpen, Code2, Database, FileUp, Layers3, LoaderCircle, Sparkles, Target, Trash2 } from "lucide-react";
import "./question-generation.css";
import "./studio-sidebar.css";

type Dataset = {
  id: string;
  name: string;
  description: string;
  filename: string;
  row_count: number;
  database: { id: string; name: string; dialect: string };
  columns: { name: string; type: string; nullCount: number }[];
  preview: Record<string, unknown>[];
};

const topics = {
  SQL: ["Filtering and sorting", "DISTINCT and NULL handling", "Aggregations and GROUP BY", "JOINs", "CTEs and subqueries", "Window functions", "Data quality"],
  Python: ["Data cleaning", "Functions and collections", "Grouping and aggregation", "Validation and deduplication", "Business logic"],
  PySpark: ["DataFrame transformations", "Filtering and projection", "Null handling", "Aggregations", "Joins", "Deduplication", "ETL pipelines"]
};

export default function QuestionGeneration() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<keyof typeof topics>("SQL");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("mixed");
  const [topic, setTopic] = useState(topics.SQL[0]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [runnerReady, setRunnerReady] = useState<{ python: boolean | null; pyspark: boolean | null }>({ python: null, pyspark: null });

  const selected = datasets.find((dataset) => dataset.id === selectedId) || null;
  const activeRunnerReady = language === "SQL" || runnerReady[language.toLowerCase() as "python" | "pyspark"] === true;
  const generationReady = Boolean(selected && aiConfigured && activeRunnerReady);

  async function loadDatasets() {
    const response = await fetch("/api/question-datasets", { credentials: "include" });
    if (response.status === 401) {
      location.href = "/login";
      return;
    }
    if (!response.ok) throw new Error("Dataset library is unavailable.");
    const items = (await response.json()) as Dataset[];
    setDatasets(items);
    setSelectedId((current) => items.some((item) => item.id === current) ? current : items[0]?.id || "");
  }

  useEffect(() => {
    void loadDatasets().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load datasets."));
    void Promise.all([
      fetch("/api/ai/status", { credentials: "include" }),
      fetch("/api/learning/runners/status", { credentials: "include" })
    ]).then(async ([aiResponse, runnerResponse]) => {
      if (!aiResponse.ok || !runnerResponse.ok) throw new Error("Generation services could not be checked.");
      const ai = await aiResponse.json();
      const runners = await runnerResponse.json();
      setAiConfigured(Boolean(ai.configured));
      setRunnerReady({ python: Boolean(runners.python?.available), pyspark: Boolean(runners.pyspark?.available) });
    }).catch(() => {
      setAiConfigured(false);
      setRunnerReady({ python: false, pyspark: false });
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description || "");
  }, [selectedId]);

  async function uploadDataset() {
    if (!file) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/question-datasets", { method: "POST", body, credentials: "include" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      await loadDatasets();
      setSelectedId(result.id);
      setFile(null);
      setNotice("Dataset uploaded and previewed. SQL tables are available in SQL Lab.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dataset upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDetails() {
    if (!selected) return;
    setError("");
    const response = await fetch(`/api/question-datasets/${selected.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description })
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Dataset details could not be saved.");
      return;
    }
    await loadDatasets();
    setNotice("Dataset details saved.");
  }

  async function deleteDataset() {
    if (!selected || !confirm(`Delete "${selected.name}" and its generated questions? This cannot be undone.`)) return;
    setError("");
    const response = await fetch(`/api/question-datasets/${selected.id}`, { method: "DELETE", credentials: "include" });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Dataset could not be deleted.");
      return;
    }
    await loadDatasets();
    setNotice("Dataset and its generated questions were deleted.");
  }

  async function generate() {
    if (!selected) return;
    setError("");
    setNotice("");
    setGenerating(true);
    try {
      if (language === "SQL") {
        const total = Number(count);
        const plan = difficulty === "mixed"
          ? [{ difficulty: "beginner", count: Math.round(total * 0.4) }, { difficulty: "intermediate", count: Math.round(total * 0.4) }, { difficulty: "advanced", count: total - Math.round(total * 0.4) * 2 }]
          : [{ difficulty, count: total }];
        const accepted: { id: string }[] = [];
        let failures: string[] = [];
        for (const batch of plan.filter((item) => item.count > 0)) {
          const response = await fetch("/api/questions/generate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ databaseId: selected.database.id, count: batch.count, difficulty: batch.difficulty, topic })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "SQL question generation failed.");
          accepted.push(...(result.accepted || []));
          failures = failures.concat((result.rejected || []).map((item: { error?: string }) => item.error || "Question rejected"));
        }
        setNotice(`${accepted.length} SQL question(s) were validated and saved${failures.length ? `; ${failures.length} rejected` : ""}.`);
        const first = accepted[0]?.id;
        if (first) location.href = `/sql?databaseId=${encodeURIComponent(selected.database.id)}&questionId=${encodeURIComponent(first)}`;
      } else {
        if (Number(count) > 10) throw new Error("Python and PySpark generation is limited to 10 questions per request so every reference solution can be run and validated.");
        const response = await fetch(`/api/question-datasets/${selected.id}/generate`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: language.toLowerCase(), count: Number(count), difficulty, topic })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Question generation failed.");
        setNotice(`${result.validated} question(s) validated; ${result.failed} failed validation.`);
        const first = result.questionIds?.[0];
        if (first) location.href = language === "Python"
          ? `/learn/python-etl?questionId=${encodeURIComponent(first)}`
          : `/pyspark?questionId=${encodeURIComponent(first)}`;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Question generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return <div className="qgShell">
    <aside className="studioSidebar qgSidebar">
      <a className="studioBrand" href="/"><span className="studioBrandMark"><Database size={18} /></span><span><strong>Data Engineering</strong><small>PRACTICE PLATFORM</small></span></a>
      <nav className="studioActions" aria-label="Main navigation">
        <a href="/"><BarChart3 size={15} /> Dashboard</a><a href="/sql"><Database size={15} /> SQL lab</a><a href="/learn/python-etl"><Code2 size={15} /> Python lab</a><a href="/pyspark"><Layers3 size={15} /> PySpark lab</a><a href="/learn/azure-data-factory"><Activity size={15} /> Azure &amp; Databricks</a><a href="/learn/etl-data-quality"><Target size={15} /> ETL testing</a><a href="/notes"><BookOpen size={15} /> Notes &amp; Study Material</a>
        <a className="studioNavActive" href="/question-generation"><Sparkles size={15} /> Question Generation</a>
        <a href="/interview"><BookOpen size={15} /> Interview</a><a href="/ask-ai"><Sparkles size={15} /> Ask AI</a><a href="/analytics"><BarChart3 size={15} /> Progress &amp; Analytics</a><a href="/ai-interview"><Sparkles size={15} /> AI interview</a>
      </nav>
      <a className="qgBack" href="/"><ArrowLeft size={15} /> Back to dashboard</a>
    </aside>
    <main className="qgPage">
      <header className="qgHeader"><span>DATASET-GROUNDED PRACTICE</span><h1>Question Generation</h1><p>Upload a dataset, inspect its schema, then generate verified exercises for the existing labs.</p></header>
      {error && <div className="qgAlert" role="alert">{error}</div>}
      {notice && <div className="qgNotice" role="status">{notice}</div>}
      <div className="qgGrid">
        <section className="qgCard">
          <h2><FileUp size={18} /> Dataset library</h2>
          <label className="qgUpload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] || null); }}>
            Drop a CSV, JSON, JSONL, or Parquet file here, or choose a file (up to 5 MB)
            <input type="file" accept=".csv,.json,.jsonl,.parquet,application/json,text/csv,application/vnd.apache.parquet" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          <button className="qgPrimary" onClick={() => void uploadDataset()} disabled={!file || loading}>{loading ? <LoaderCircle className="qgSpin" size={16} /> : <FileUp size={16} />} Upload dataset</button>
          <label className="qgField">Your datasets<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a dataset</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.row_count} rows</option>)}</select></label>
          {selected && <div className="qgDetails">
            <label className="qgField">Name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
            <label className="qgField">Description<textarea value={description} maxLength={1000} rows={2} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="qgActions"><button onClick={() => void saveDetails()}>Save details</button><button className="qgDanger" onClick={() => void deleteDataset()}><Trash2 size={14} /> Delete</button></div>
            <p className="qgSmall">{selected.filename} · {selected.row_count.toLocaleString()} rows · {selected.columns.length} columns · {selected.database.dialect}</p>
            <div className="qgColumns">{selected.columns.map((column) => <span key={column.name}><strong>{column.name}</strong><small>{column.type} · {column.nullCount} null</small></span>)}</div>
            <div className="qgTableWrap"><table><thead><tr>{selected.columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead><tbody>{selected.preview.map((row, index) => <tr key={index}>{selected.columns.map((column) => <td key={column.name}>{String(row[column.name] ?? "NULL")}</td>)}</tr>)}</tbody></table></div>
          </div>}
          {!datasets.length && <p className="qgEmpty">Upload a file to create a private, isolated SQL workspace.</p>}
        </section>
        <section className="qgCard qgGenerate">
          <h2><Sparkles size={18} /> Generate questions</h2>
          <p className="qgSmall">AI receives the selected dataset schema and a small sample of its rows. Avoid uploading sensitive personal data.</p>
          {aiConfigured === false && <p className="qgLimit">AI generation is unavailable: configure the backend OPENAI_API_KEY to continue.</p>}
          {language !== "SQL" && runnerReady[language.toLowerCase() as "python" | "pyspark"] === false && <p className="qgLimit">The isolated {language} runner is not configured or available. Generation stays disabled until it is healthy.</p>}
          <label className="qgField">Dataset<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a dataset</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}</select></label>
          <label className="qgField">Target lab<select value={language} onChange={(event) => { const value = event.target.value as keyof typeof topics; setLanguage(value); setTopic(topics[value][0]); if (value !== "SQL" && Number(count) > 10) setCount("10"); }}><option>SQL</option><option>Python</option><option>PySpark</option></select></label>
          <label className="qgField">Number of questions<select value={count} onChange={(event) => setCount(event.target.value)}>{["10","20","50","100"].map((value) => <option key={value} value={value} disabled={language !== "SQL" && Number(value) > 10}>{value}{language !== "SQL" && Number(value) > 10 ? " (not available for code runners)" : ""}</option>)}</select></label>
          <label className="qgField">Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="mixed">Mixed</option><option value="beginner">Easy</option><option value="intermediate">Medium</option><option value="advanced">Hard</option></select></label>
          <label className="qgField">Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}>{topics[language].map((item) => <option key={item}>{item}</option>)}</select></label>
          {language !== "SQL" && <p className="qgLimit">Python/PySpark is currently limited to 10 questions per validated request. Higher counts require background generation support.</p>}
          <button className="qgPrimary" onClick={() => void generate()} disabled={!generationReady || generating}>{generating ? <LoaderCircle className="qgSpin" size={16} /> : <Sparkles size={16} />} Generate and validate</button>
          <p className="qgSmall">Generated Python and PySpark challenges are saved in your existing learning question bank. SQL uses the selected dataset's real PostgreSQL tables.</p>
          {selected && <a className="qgLabLink" href={`/sql?databaseId=${encodeURIComponent(selected.database.id)}`}>Open dataset in SQL Lab <ArrowRight size={14} /></a>}
        </section>
      </div>
    </main>
  </div>;
}
