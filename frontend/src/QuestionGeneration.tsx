import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, BarChart3, BookOpen, Code2, Database, FileUp, Layers3, LoaderCircle, Sparkles, Target, Trash2 } from "lucide-react";
import "./question-generation.css";
import "./studio-sidebar.css";

type DatasetTable = {
  name: string;
  row_count: number;
  columns: { name: string; type: string; nullCount: number }[];
  preview: Record<string, unknown>[];
};

type Dataset = {
  id: string;
  name: string;
  description: string;
  filename: string;
  table_name: string;
  row_count: number;
  database: { id: string; name: string; dialect: string };
  columns: { name: string; type: string; nullCount: number }[];
  preview: Record<string, unknown>[];
  tables: DatasetTable[];
};

type GenerationProgress = {
  jobId: string;
  status: "running" | "completed" | "failed";
  stage: string;
  language: "sql" | "python" | "pyspark";
  requested: number;
  generated: number;
  validated: number;
  failed: number;
  currentTitle: string | null;
  generatedTitles: string[];
  validatedTitles: string[];
  questionIds: string[];
  rejected: string[];
  error: string | null;
};

function datasetOptionLabel(dataset: Dataset, datasets: Dataset[]): string {
  const hasDuplicateName = datasets.some((item) => item.id !== dataset.id && item.name === dataset.name);
  if (!hasDuplicateName) return `${dataset.name} · ${dataset.row_count} rows`;
  return `${dataset.name} · ${dataset.filename} · ${dataset.row_count} rows · ${dataset.id.slice(0, 8)}`;
}

const topics = {
  SQL: ["Filtering and sorting", "DISTINCT and NULL handling", "Aggregations and GROUP BY", "JOINs", "CTEs and subqueries", "Window functions", "Data quality"],
  Python: ["Data cleaning", "Functions and collections", "Grouping and aggregation", "Validation and deduplication", "Business logic"],
  PySpark: ["DataFrame transformations", "Filtering and projection", "Null handling", "Aggregations", "Joins", "Deduplication", "ETL pipelines"]
};

export default function QuestionGeneration() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tableName, setTableName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<keyof typeof topics>("SQL");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("mixed");
  const [topic, setTopic] = useState(topics.SQL[0]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generationFailures, setGenerationFailures] = useState<string[]>([]);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [runnerReady, setRunnerReady] = useState<{ python: boolean | null; pyspark: boolean | null }>({ python: null, pyspark: null });

  const selected = datasets.find((dataset) => dataset.id === selectedId) || null;
  const selectedTable = selected?.tables.find((table) => table.name === tableName) || selected?.tables[0] || null;
  const selectedColumns = selectedTable?.columns || selected?.columns || [];
  const selectedPreview = selectedTable?.preview || selected?.preview || [];
  const activeRunnerReady = language === "SQL" || runnerReady[language.toLowerCase() as "python" | "pyspark"] === true;
  const generationReady = Boolean(selected && aiConfigured && activeRunnerReady);

  async function parseJsonResponse<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(response.ok ? "The server returned an invalid JSON response." : "The server returned an invalid error response.");
    }
  }

  async function loadDatasets() {
    const response = await fetch("/api/question-datasets", { credentials: "include" });
    if (response.status === 401) {
      location.href = "/login";
      return;
    }
    if (!response.ok) throw new Error("Dataset library is unavailable.");
    const items = (await parseJsonResponse<Dataset[]>(response)) ?? [];
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
      const ai = (await parseJsonResponse<{ configured?: boolean }>(aiResponse)) ?? { configured: false };
      const runners = (await parseJsonResponse<{ python?: { available?: boolean }; pyspark?: { available?: boolean } }>(runnerResponse)) ?? {};
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
    setTableName(selected.tables.find((table) => table.row_count > 0)?.name || selected.tables[0]?.name || selected.table_name);
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
      const result = (await parseJsonResponse<{ id?: string; error?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      await loadDatasets();
      setSelectedId(result.id ?? "");
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
    const result = (await parseJsonResponse<{ error?: string }>(response)) ?? {};
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
    const result = (await parseJsonResponse<{ error?: string }>(response)) ?? {};
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
    setGenerationFailures([]);
    setGenerationProgress(null);
    setGenerating(true);
    try {
      const requestedCount = Number.parseInt(String(count), 10);
      if (!Number.isInteger(requestedCount) || requestedCount < 1) {
        throw new Error("Enter a valid number of questions before generating.");
      }
      const maxCount = language === "SQL" ? 100 : 10;
      if (requestedCount > maxCount) {
        throw new Error(language === "SQL"
          ? "SQL generation supports up to 100 questions per request."
          : "Python and PySpark generation are limited to 10 questions per validated request.");
      }
      if (language === "SQL") {
        const total = requestedCount;
        const plan = difficulty === "mixed"
          ? [{ difficulty: "beginner", count: Math.round(total * 0.4) }, { difficulty: "intermediate", count: Math.round(total * 0.4) }, { difficulty: "advanced", count: total - Math.round(total * 0.4) * 2 }]
          : [{ difficulty, count: total }];
        const batches = plan.filter((item) => item.count > 0);
        const accepted: { id: string; title: string }[] = [];
        let failures: string[] = [];
        let generated = 0;
        for (const [batchIndex, batch] of batches.entries()) {
          setGenerationProgress({
            jobId: "sql-generation",
            status: "running",
            stage: "generating",
            language: "sql",
            requested: total,
            generated,
            validated: accepted.length,
            failed: failures.length,
            currentTitle: `Generating SQL batch ${batchIndex + 1} of ${batches.length}`,
            generatedTitles: [],
            validatedTitles: accepted.map((question) => question.title),
            questionIds: accepted.map((question) => question.id),
            rejected: failures,
            error: null
          });
          const response = await fetch("/api/questions/generate", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ databaseId: selected.database.id, count: batch.count, difficulty: batch.difficulty, topic })
          });
          const result = (await parseJsonResponse<{ error?: string; accepted?: { id: string; title: string }[]; rejected?: { question?: { title?: string }; error?: string }[] }>(response)) ?? {};
          if (!response.ok) throw new Error(result.error || "SQL question generation failed.");
          accepted.push(...(result.accepted || []));
          failures = failures.concat((result.rejected || []).map((item) => `${item.question?.title || "Question"}: ${item.error || "Question rejected"}`));
          generated += (result.accepted || []).length + (result.rejected || []).length;
          setGenerationFailures(failures);
          setGenerationProgress({
            jobId: "sql-generation",
            status: "running",
            stage: "validating",
            language: "sql",
            requested: total,
            generated,
            validated: accepted.length,
            failed: failures.length,
            currentTitle: null,
            generatedTitles: accepted.map((question) => question.title),
            validatedTitles: accepted.map((question) => question.title),
            questionIds: accepted.map((question) => question.id),
            rejected: failures,
            error: null
          });
        }
        setGenerationFailures(failures);
        setGenerationProgress((current) => current ? { ...current, status: "completed", stage: "completed", currentTitle: null } : current);
        setNotice(`${accepted.length} SQL question(s) were validated and saved${failures.length ? `; ${failures.length} rejected` : ""}.`);
      } else {
        const response = await fetch(`/api/question-datasets/${selected.id}/generate`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: language.toLowerCase(), count: requestedCount, difficulty, topic, tableName: selectedTable?.name })
        });
        const result = (await parseJsonResponse<{ error?: string; jobId?: string; requested?: number }>(response)) ?? {};
        if (!response.ok) {
          throw new Error(result.error || "Question generation failed.");
        }
        if (!result.jobId) throw new Error("Generation started but the server did not return a progress job ID.");
        setGenerationProgress({
          jobId: result.jobId,
          status: "running",
          stage: "queued",
          language: language.toLowerCase() as "python" | "pyspark",
          requested: result.requested ?? requestedCount,
          generated: 0,
          validated: 0,
          failed: 0,
          currentTitle: null,
          generatedTitles: [],
          validatedTitles: [],
          questionIds: [],
          rejected: [],
          error: null
        });
        let consecutivePollErrors = 0;
        while (true) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
          let progress: (GenerationProgress & { error?: string }) | null = null;
          try {
            const progressResponse = await fetch(`/api/question-generation/jobs/${encodeURIComponent(result.jobId)}`, {
              credentials: "include",
              cache: "no-store"
            });
            progress = await parseJsonResponse<GenerationProgress & { error?: string }>(progressResponse);
            if (!progressResponse.ok || !progress) throw new Error(progress?.error || "Progress could not be refreshed.");
          } catch {
            consecutivePollErrors++;
            if (consecutivePollErrors >= 12) {
              throw new Error(`Could not refresh generation progress after several retries. Job ${result.jobId} may still be running; reload this page later or retry generation.`);
            }
            setError(`Progress refresh failed (${consecutivePollErrors}/12); retrying automatically.`);
            continue;
          }
          consecutivePollErrors = 0;
          setError("");
          setGenerationProgress(progress);
          setGenerationFailures(progress.rejected || []);
          if (progress.status === "completed") {
            setNotice(`${progress.validated} of ${progress.requested} requested question(s) validated and saved${progress.failed ? `; ${progress.failed} failed candidate(s) were replaced` : ""}.`);
            break;
          }
          if (progress.status === "failed") {
            throw new Error(progress.error || `Only ${progress.validated} of ${progress.requested} questions were validated; no questions were saved.`);
          }
        }
      }
    } catch (cause) {
      setError(cause instanceof TypeError
        ? "Could not connect to the generation service. Check your connection and try again."
        : cause instanceof Error ? cause.message : "Question generation failed.");
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
      {generationFailures.length > 0 && <details className="qgAlert"><summary>Validation details ({generationFailures.length})</summary><ul>{generationFailures.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul></details>}
      <div className="qgGrid">
        <section className="qgCard">
          <h2><FileUp size={18} /> Dataset library</h2>
          <label className="qgUpload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] || null); }}>
            Drop a CSV, JSON, JSONL, Parquet, or PostgreSQL SQL script here (up to 5 MB)
            <input type="file" accept=".csv,.json,.jsonl,.parquet,.sql,application/json,text/csv,application/vnd.apache.parquet,application/sql" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          <p className="qgSmall">SQL scripts may contain CREATE TABLE, INSERT ... VALUES, and ALTER TABLE statements only. PostgreSQL pg_dump files with COPY/SET commands are not supported.</p>
          <button className="qgPrimary" onClick={() => void uploadDataset()} disabled={!file || loading}>{loading ? <LoaderCircle className="qgSpin" size={16} /> : <FileUp size={16} />} Upload dataset</button>
          <label className="qgField">Your datasets<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a dataset</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{datasetOptionLabel(dataset, datasets)}</option>)}</select></label>
          {selected && <div className="qgDetails">
            <label className="qgField">Name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
            <label className="qgField">Description<textarea value={description} maxLength={1000} rows={2} onChange={(event) => setDescription(event.target.value)} /></label>
            <div className="qgActions"><button onClick={() => void saveDetails()}>Save details</button><button className="qgDanger" onClick={() => void deleteDataset()}><Trash2 size={14} /> Delete</button></div>
            <p className="qgSmall">{selected.filename} · {selected.tables.length} table(s) · {selected.row_count.toLocaleString()} rows total · {selected.database.dialect}</p>
            {language !== "SQL" && selected.tables.length > 1 && <label className="qgField">Coding target table<select value={selectedTable?.name || ""} onChange={(event) => setTableName(event.target.value)}>{selected.tables.map((table) => <option key={table.name} value={table.name}>{table.name} · {table.row_count} rows</option>)}</select></label>}
            {selectedTable && <><p className="qgSmall">Preview: {selectedTable.name} · {selectedTable.row_count.toLocaleString()} rows · {selectedColumns.length} columns</p>
            <div className="qgColumns">{selectedColumns.map((column) => <span key={column.name}><strong>{column.name}</strong><small>{column.type} · {column.nullCount} null</small></span>)}</div>
            <div className="qgTableWrap"><table><thead><tr>{selectedColumns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead><tbody>{selectedPreview.map((row, index) => <tr key={index}>{selectedColumns.map((column) => <td key={column.name}>{String(row[column.name] ?? "NULL")}</td>)}</tr>)}</tbody></table></div></>}
          </div>}
          {!datasets.length && <p className="qgEmpty">Upload a file to create a private, isolated SQL workspace.</p>}
        </section>
        <section className="qgCard qgGenerate">
          <h2><Sparkles size={18} /> Generate questions</h2>
          <p className="qgSmall">AI receives the selected database schema and a small sample of its rows. SQL generation can use every table; Python and PySpark use the selected coding target table. Avoid uploading sensitive personal data.</p>
          {aiConfigured === false && <p className="qgLimit">AI generation is unavailable: configure the backend OPENAI_API_KEY to continue.</p>}
          {language !== "SQL" && runnerReady[language.toLowerCase() as "python" | "pyspark"] === false && <p className="qgLimit">The isolated {language} runner is not configured or available. Generation stays disabled until it is healthy.</p>}
          <label className="qgField">Dataset<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a dataset</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{datasetOptionLabel(dataset, datasets)}</option>)}</select></label>
          <label className="qgField">Target lab<select value={language} onChange={(event) => { const value = event.target.value as keyof typeof topics; setLanguage(value); setTopic(topics[value][0]); if (value !== "SQL" && Number(count) > 10) setCount("10"); }}><option>SQL</option><option>Python</option><option>PySpark</option></select></label>
          <label className="qgField">Number of questions<input type="number" min={1} max={language === "SQL" ? 100 : 10} step={1} value={count} onChange={(event) => setCount(event.target.value)} placeholder={language === "SQL" ? "e.g. 3" : "e.g. 1"} /></label>
          <label className="qgField">Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="mixed">Mixed</option><option value="beginner">Easy</option><option value="intermediate">Medium</option><option value="advanced">Hard</option></select></label>
          <label className="qgField">Topic<select value={topic} onChange={(event) => setTopic(event.target.value)}>{topics[language].map((item) => <option key={item}>{item}</option>)}</select></label>
          {language !== "SQL" && <p className="qgLimit">Python and PySpark support custom counts from 1 to 10 per validated request. For example: 1, 2, 3, or 10.</p>}
          <button className="qgPrimary" onClick={() => void generate()} disabled={!generationReady || generating}>{generating ? <LoaderCircle className="qgSpin" size={16} /> : <Sparkles size={16} />} Generate and validate</button>
          {generationProgress && <section className="qgProgress" aria-live="polite" aria-label="Question generation progress">
            <div className="qgProgressHeader"><strong>{generationProgress.status === "completed" ? "Generation complete" : generationProgress.status === "failed" ? "Generation failed" : "Generating and validating"}</strong><span>{Math.min(generationProgress.generated, generationProgress.requested)}/{generationProgress.requested} generated · {generationProgress.validated}/{generationProgress.requested} validated</span></div>
            <div className="qgProgressTrack" role="progressbar" aria-label="Questions validated" aria-valuemin={0} aria-valuemax={generationProgress.requested} aria-valuenow={generationProgress.validated}><span style={{ width: `${Math.min(100, generationProgress.validated / generationProgress.requested * 100)}%` }} /></div>
            {generationProgress.currentTitle && <p className="qgProgressCurrent"><LoaderCircle className="qgSpin" size={14} /> Checking: <strong>{generationProgress.currentTitle}</strong></p>}
            {generationProgress.generatedTitles.length > 0 && <div className="qgProgressTitles"><strong>Generated questions</strong><ol>{generationProgress.generatedTitles.map((title, index) => <li key={`${index}-${title}`}>{title}</li>)}</ol></div>}
            {generationProgress.validatedTitles.length > 0 && <div className="qgProgressTitles"><strong>{generationProgress.status === "completed" ? "Validated and saved" : "Validated so far"}</strong><ol>{generationProgress.validatedTitles.map((title, index) => <li key={`${index}-${title}`}>{generationProgress.status === "completed" && generationProgress.questionIds[index] ? <a href={generationProgress.language === "sql" ? `/sql?databaseId=${encodeURIComponent(selected?.database.id || "")}&questionId=${encodeURIComponent(generationProgress.questionIds[index])}` : `${generationProgress.language === "python" ? "/learn/python-etl" : "/pyspark"}?questionId=${encodeURIComponent(generationProgress.questionIds[index])}`}>{title}</a> : title}</li>)}</ol></div>}
            {generationProgress.status === "running" && <p className="qgSmall">This page updates automatically. Failed candidates are replaced; questions are saved only when the full requested count validates.</p>}
          </section>}
          <p className="qgSmall">Generated Python and PySpark challenges are saved in your existing learning question bank. SQL uses the selected dataset's real PostgreSQL tables.</p>
          {selected && <a className="qgLabLink" href={`/sql?databaseId=${encodeURIComponent(selected.database.id)}`}>Open dataset in SQL Lab <ArrowRight size={14} /></a>}
        </section>
      </div>
    </main>
  </div>;
}
