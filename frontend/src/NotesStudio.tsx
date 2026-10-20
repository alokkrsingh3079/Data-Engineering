import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookOpen, BriefcaseBusiness, Check, ChevronRight, Clock3, Cloud, Code2, Columns2, Database, Download, FileText, FolderOpen, GitBranch, GraduationCap, Layers3, Lightbulb, LogOut, Maximize2, Minimize2, Plus, Printer, Search, Sparkles, Trash2, Type, Workflow, X, ZoomIn, ZoomOut, type LucideIcon } from "lucide-react";
import "./notes-studio.css";
import "./notes-print.css";

type Note = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  content: string;
  bookmarked: boolean;
  revision_marked: boolean;
  progress_percent: number;
  last_position: number;
  last_viewed_at: string | null;
  source_document_id?: string | null;
  source_filename?: string | null;
  created_at: string;
  updated_at: string;
};

type View = "dashboard" | "all" | "bookmarks" | "revision" | "recent" | "subject" | "pdf";
type ReaderMode = "notes" | "source" | "split";
type PdfDocument = { id: string; filename: string; size_bytes: number; status: "uploaded" | "processing" | "completed" | "failed"; generated_note_id: string | null; processing_error: string | null; created_at: string };
const API = "";
const subjects = ["SQL", "Python", "PySpark", "Azure Data Factory", "Databricks", "ETL & Data Warehousing", "Data Engineering System Design", "Data Engineering Concepts", "Interview Preparation"];
const subjectIcons: Record<string, LucideIcon> = { SQL: Database, Python: Code2, PySpark: Sparkles, "Azure Data Factory": Cloud, Databricks: Layers3, "ETL & Data Warehousing": Workflow, "Data Engineering System Design": GitBranch, "Data Engineering Concepts": Lightbulb, "Interview Preparation": BriefcaseBusiness };
const blankNote = { title: "", subject: "SQL", chapter: "", difficulty: "intermediate" as Note["difficulty"], content: "" };

async function readApiJson(response: Response, action: string) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.status === 401 || response.redirected) {
      location.href = "/login";
      throw new Error("Your session expired. Sign in again to access your notes.");
    }
    throw new Error(`The ${action} request received an HTML page instead of an API response. Reload the workspace and sign in again; if it persists, restart the local backend and frontend.`);
  }
  return response.json();
}

function subjectColor(subject: string) {
  const index = Math.max(0, subjects.indexOf(subject));
  return ["blue", "mint", "coral", "amber", "cyan", "violet", "green", "rose", "slate"][index % 9];
}

function formatDate(value: string | null) {
  if (!value) return "Not opened yet";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function noteHeadings(content: string) {
  return content.split("\n").flatMap((line) => {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    return match ? [{ title: match[2], id: match[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }] : [];
  });
}

export default function NotesStudio() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [userName, setUserName] = useState("Learner");
  const [view, setView] = useState<View>("dashboard");
  const [activeSubject, setActiveSubject] = useState("");
  const [search, setSearch] = useState("");
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(blankNote);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState(0);
  const [pdfSubject, setPdfSubject] = useState("SQL");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [activePdf, setActivePdf] = useState<PdfDocument | null>(null);
  const [readerMode, setReaderMode] = useState<ReaderMode>("notes");
  const [readerExpanded, setReaderExpanded] = useState(false);
  const [readerTocVisible, setReaderTocVisible] = useState(true);
  const [readerToolsVisible, setReaderToolsVisible] = useState(true);
  const [readerTextSize, setReaderTextSize] = useState(1);
  const [sourcePdfZoom, setSourcePdfZoom] = useState(125);
  const readerRef = useRef<HTMLElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadNotes() {
    setLoading(true);
    setError("");
    try {
      const [notesResponse, accountResponse] = await Promise.all([
        fetch(`${API}/api/notes`, { credentials: "include" }),
        fetch(`${API}/api/auth/me`, { credentials: "include" }),
      ]);
      if (notesResponse.status === 401 || accountResponse.status === 401) {
        location.href = "/login";
        return;
      }
      if (!notesResponse.ok) throw new Error("Your notes could not be loaded.");
      setNotes(await readApiJson(notesResponse, "Notes"));
      if (accountResponse.ok) {
        const account = await readApiJson(accountResponse, "Account");
        setUserName(account.user?.name || "Learner");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your notes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadNotes(); }, []);

  async function loadDocuments() {
    const response = await fetch(`${API}/api/notes/documents`, { credentials: "include" });
    if (response.status === 401) { location.href = "/login"; return; }
    if (response.ok) setDocuments(await readApiJson(response, "PDF library"));
  }

  useEffect(() => { void loadDocuments().catch(() => setError("The PDF library could not be loaded.")); }, []);

  async function uploadPdf(file?: File) {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) { setError("Choose a PDF document."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("PDFs must be 8 MB or smaller."); return; }
    setPdfBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch(`${API}/api/notes/documents`, { method: "POST", credentials: "include", body: form });
      const body = await readApiJson(response, "PDF upload");
      if (!response.ok) throw new Error(body.error || "PDF upload failed.");
      setNotice("PDF uploaded. Generate notes when you are ready.");
      setView("pdf");
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF upload failed.");
    } finally {
      setPdfBusy(false);
      if (pdfFileRef.current) pdfFileRef.current.value = "";
    }
  }

  async function generateFromPdf(document: PdfDocument) {
    setPdfBusy(true);
    setError("");
    setDocuments((current) => current.map((item) => item.id === document.id ? { ...item, status: "processing" } : item));
    try {
      const response = await fetch(`${API}/api/notes/documents/${document.id}/generate`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: pdfSubject }) });
      const body = await readApiJson(response, "AI note generation");
      if (!response.ok) throw new Error(body.error || "Note generation failed.");
      setActivePdf(null);
      await Promise.all([loadDocuments(), loadNotes()]);
      setActiveNote(body as Note);
      setReaderMode("notes");
      setReaderExpanded(false);
      setProgress(0);
      setView("all");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Note generation failed.");
      await loadDocuments();
    } finally {
      setPdfBusy(false);
    }
  }

  async function removePdf(document: PdfDocument) {
    if (!window.confirm(`Delete the uploaded PDF "${document.filename}"? Generated notes will remain.`)) return;
    const response = await fetch(`${API}/api/notes/documents/${document.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) { setError("The PDF could not be deleted."); return; }
    if (activePdf?.id === document.id) setActivePdf(null);
    await loadDocuments();
  }

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes.filter((note) => {
      if (view === "bookmarks" && !note.bookmarked) return false;
      if (view === "revision" && !note.revision_marked) return false;
      if (view === "recent" && !note.last_viewed_at) return false;
      if (view === "subject" && note.subject !== activeSubject) return false;
      return !term || `${note.title} ${note.subject} ${note.chapter} ${note.content}`.toLowerCase().includes(term);
    }).sort((left, right) => view === "recent"
      ? new Date(right.last_viewed_at || 0).getTime() - new Date(left.last_viewed_at || 0).getTime()
      : new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime());
  }, [notes, search, view, activeSubject]);

  const recentlyViewed = useMemo(() => [...notes].filter((note) => note.last_viewed_at).sort((a, b) => new Date(b.last_viewed_at || 0).getTime() - new Date(a.last_viewed_at || 0).getTime()).slice(0, 4), [notes]);
  const bookmarks = useMemo(() => notes.filter((note) => note.bookmarked).slice(0, 4), [notes]);
  const headings = activeNote ? noteHeadings(activeNote.content) : [];

  async function openNote(note: Note) {
    try {
      const response = await fetch(`${API}/api/notes/${note.id}`, { credentials: "include" });
      if (!response.ok) throw new Error("This note could not be opened.");
      const fullNote = await readApiJson(response, "Note");
      setActiveNote(fullNote);
      setReaderMode("notes");
      setReaderExpanded(false);
      setProgress(fullNote.progress_percent || 0);
      setEditing(false);
      setView("all");
      void fetch(`${API}/api/notes/${note.id}/progress`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: fullNote.last_position || 0, progressPercent: fullNote.progress_percent || 0 }) });
      await loadNotes();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This note could not be opened.");
    }
  }

  function startCreate() {
    setDraft(blankNote);
    setActiveNote(null);
    setEditing(true);
  }

  function startEdit(note: Note) {
    setDraft({ title: note.title, subject: note.subject, chapter: note.chapter, difficulty: note.difficulty, content: note.content });
    setEditing(true);
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(activeNote ? `${API}/api/notes/${activeNote.id}` : `${API}/api/notes`, {
        method: activeNote ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await readApiJson(response, "Note save");
      if (!response.ok) throw new Error(body.error || "The note could not be saved.");
      setActiveNote(body);
      setEditing(false);
      setNotice("Note saved");
      await loadNotes();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleNoteFlag(note: Note, key: "bookmarked" | "revision_marked") {
    const next = !note[key];
    const path = key === "bookmarked" ? "bookmark" : "revision";
    const property = key === "bookmarked" ? "bookmarked" : "revisionMarked";
    const response = await fetch(`${API}/api/notes/${note.id}/${path}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [property]: next }) });
    if (!response.ok) { setError("That change could not be saved."); return; }
    if (activeNote?.id === note.id) setActiveNote({ ...activeNote, [key]: next });
    await loadNotes();
  }

  async function removeNote(note: Note) {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    const response = await fetch(`${API}/api/notes/${note.id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) { setError("The note could not be deleted."); return; }
    setActiveNote(null);
    setEditing(false);
    setNotice("Note deleted");
    await loadNotes();
  }

  function updateProgress(event: React.UIEvent<HTMLElement>) {
    if (!activeNote) return;
    const target = event.currentTarget;
    const max = target.scrollHeight - target.clientHeight;
    const percent = max > 0 ? Math.round((target.scrollTop / max) * 100) : 100;
    setProgress(percent);
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      void fetch(`${API}/api/notes/${activeNote.id}/progress`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: Math.round(target.scrollTop), progressPercent: percent }) });
    }, 500);
  }

  function downloadNote(note: Note) {
    const blob = new Blob([`${note.title}\n${"=".repeat(note.title.length)}\n${note.subject}${note.chapter ? ` · ${note.chapter}` : ""}\n\n${note.content}`], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "study-note"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderContent(content: string) {
    const blocks: { type: "text" | "code"; value: string; language?: string }[] = [];
    let inCode = false;
    let code = "";
    let language = "";
    let fenceMarker = "";
    let text = "";
    for (const line of content.split("\n")) {
      const fence = /^(`{3,}|~{3,})(.*)$/.exec(line.trim());
      if (fence && (!inCode || fence[1][0] === fenceMarker[0])) {
        if (inCode) { blocks.push({ type: "code", value: code.trimEnd(), language }); code = ""; language = ""; fenceMarker = ""; }
        else {
          if (text.trim()) blocks.push({ type: "text", value: text.trimEnd() });
          text = "";
          language = fence[2].trim();
          fenceMarker = fence[1];
        }
        inCode = !inCode;
      } else if (inCode) code += `${line}\n`;
      else text += `${line}\n`;
    }
    if (code.trim()) blocks.push({ type: "code", value: code.trimEnd(), language });
    if (text.trim()) blocks.push({ type: "text", value: text.trimEnd() });
    const renderLine = (line: string) => line.split(/(\[Source: page \d+\])/g).map((part, partIndex) => {
      const citation = /^\[Source: page (\d+)\]$/.exec(part);
      return citation && activeNote?.source_document_id
        ? <a className="sourceCitation" key={partIndex} href={`/api/notes/documents/${activeNote.source_document_id}/file#page=${citation[1]}`} target="_blank" rel="noreferrer">Source page {citation[1]}</a>
        : part;
    });
    return blocks.map((block, index) => block.type === "code"
      ? block.language?.toLowerCase() === "flow"
        ? <div className="visualFlow" key={index} aria-label={block.value.replace(/\s*(?:->|→)\s*/g, ", then ")}>{block.value.split(/\s*(?:->|→)\s*/).filter(Boolean).map((step, stepIndex) => <Fragment key={stepIndex}>{stepIndex > 0 && <ArrowRight className="flowArrow" size={17} aria-hidden="true" />}<div className={`flowNode tone-${stepIndex % 5}`}><small>{String(stepIndex + 1).padStart(2, "0")}</small><strong>{step}</strong></div></Fragment>)}</div>
        : <div className={`noteCode ${block.language || ""}`} key={index}><div className="noteCodeBar"><span>{block.language || "CODE"}</span><button title="Copy code" aria-label="Copy code" onClick={() => void navigator.clipboard.writeText(block.value).then(() => setNotice("Code copied"))}><Check size={14} /> Copy</button></div><pre><code>{block.value}</code></pre></div>
      : <div className="noteText" key={index}>{(() => {
        const lines = block.value.split("\n");
        const elements: JSX.Element[] = [];
        let lineIndex = 0;
        while (lineIndex < lines.length) {
          const line = lines[lineIndex].trim();
          if (!line) { lineIndex++; continue; }
          const heading = /^(#{1,3})\s+(.+)$/.exec(line);
          if (heading) {
            const Tag = `h${heading[1].length + 1}` as "h2" | "h3" | "h4";
            const id = heading[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            elements.push(<Tag id={id} key={lineIndex}>{heading[2]}</Tag>);
            lineIndex++;
            continue;
          }
          if (/^\|.*\|$/.test(line)) {
            const tableLines: string[] = [];
            while (lineIndex < lines.length && /^\s*\|.*\|\s*$/.test(lines[lineIndex])) tableLines.push(lines[lineIndex++]);
            const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
            const rows = tableLines.filter((row) => !/^\s*\|?\s*:?-{2,}/.test(row)).map(cells);
            const [header = [], ...body] = rows;
            elements.push(<div className="noteTableWrap" key={lineIndex}><table><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{renderLine(cell)}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{header.map((_, cellIndex) => <td key={cellIndex}>{renderLine(row[cellIndex] || "")}</td>)}</tr>)}</tbody></table></div>);
            continue;
          }
          if (/^[-*]\s/.test(line)) {
            const items: string[] = [];
            while (lineIndex < lines.length && /^\s*[-*]\s/.test(lines[lineIndex])) items.push(lines[lineIndex++].trim().replace(/^[-*]\s/, ""));
            elements.push(<ul className="noteListPoints" key={lineIndex}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderLine(item)}</li>)}</ul>);
            continue;
          }
          if (/^>\s?/.test(line)) {
            const quote: string[] = [];
            while (lineIndex < lines.length && /^\s*>/.test(lines[lineIndex])) quote.push(lines[lineIndex++].trim().replace(/^>\s?/, ""));
            const marker = /^\[!(CORE|IMPORTANT|EXAMPLE|WARNING|INTERVIEW|REVISION|NOTE)\]\s*/i.exec(quote[0] || "");
            const tone = (marker?.[1] || "NOTE").toLowerCase();
            if (marker) quote[0] = quote[0].replace(marker[0], "");
            elements.push(<aside className={`noteCallout ${tone}`} key={lineIndex}><span>{tone === "core" ? "CORE CONCEPT" : tone === "important" ? "IMPORTANT" : tone === "example" ? "PRACTICAL EXAMPLE" : tone === "warning" ? "COMMON MISTAKE" : tone === "interview" ? "INTERVIEW TIP" : tone === "revision" ? "QUICK REVISION" : "STUDY NOTE"}</span><p>{quote.map((part) => renderLine(part))}</p></aside>);
            continue;
          }
          const paragraph = [line];
          lineIndex++;
          while (lineIndex < lines.length && lines[lineIndex].trim() && !/^(#{1,3})\s+|^[-*]\s|^>|^\|.*\|$/.test(lines[lineIndex].trim())) paragraph.push(lines[lineIndex++].trim());
          elements.push(<p key={lineIndex}>{renderLine(paragraph.join(" "))}</p>);
        }
        return elements;
      })()}</div>);
  }

  async function signOut() {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    location.href = "/login";
  }

  const title = view === "dashboard" ? "Notes & Study Material" : view === "bookmarks" ? "Bookmarks" : view === "revision" ? "Revision Notes" : view === "recent" ? "Recently Viewed" : view === "subject" ? activeSubject : view === "pdf" ? "PDF Library" : "My Notes";
  const ActiveSubjectIcon = activeNote ? subjectIcons[activeNote.subject] || BookOpen : BookOpen;

  return <div className={`notesShell ${activeNote && !editing && readerExpanded ? "notesReaderExpanded" : ""} ${readerTocVisible ? "" : "readerTocHidden"} ${readerToolsVisible ? "" : "readerToolsHidden"}`}>
    <aside className="notesSidebar">
      <a className="notesBrand" href="/"><span><Layers3 size={18} /></span><b>Data Engineering<small>PRACTICE PLATFORM</small></b></a>
      <nav aria-label="Notes navigation">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => { setView("dashboard"); setActiveNote(null); }}><GraduationCap size={17} /> Notes Dashboard</button>
        <button className={view === "all" && !activeNote ? "active" : ""} onClick={() => { setView("all"); setActiveNote(null); }}><FolderOpen size={17} /> My Notes <span>{notes.length}</span></button>
        <button className={view === "bookmarks" ? "active" : ""} onClick={() => { setView("bookmarks"); setActiveNote(null); }}><Bookmark size={17} /> Bookmarks <span>{notes.filter((note) => note.bookmarked).length}</span></button>
        <button className={view === "revision" ? "active" : ""} onClick={() => { setView("revision"); setActiveNote(null); }}><BookOpen size={17} /> Revision Notes <span>{notes.filter((note) => note.revision_marked).length}</span></button>
        <button className={view === "recent" ? "active" : ""} onClick={() => { setView("recent"); setActiveNote(null); }}><Clock3 size={17} /> Recently Viewed</button>
        <button className={view === "pdf" ? "active" : ""} onClick={() => { setView("pdf"); setActiveNote(null); }}><FileText size={17} /> PDF Library <span>{documents.length}</span></button>
        <div className="notesNavLabel">SUBJECTS</div>
        {subjects.map((subject) => <button key={subject} className={view === "subject" && activeSubject === subject ? "active subjectNav" : "subjectNav"} onClick={() => { setActiveSubject(subject); setView("subject"); setActiveNote(null); }}><span className={`subjectDot ${subjectColor(subject)}`} />{subject}<span>{notes.filter((note) => note.subject === subject).length}</span></button>)}
      </nav>
      <button className="notesAccount" onClick={() => void signOut()}><span>{userName.slice(0, 1).toUpperCase()}</span><b>{userName}<small>LEARNER ACCOUNT</small></b><LogOut size={15} /></button>
    </aside>

    <main className="notesMain">
      <input ref={pdfFileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(event) => void uploadPdf(event.target.files?.[0])} />
      {activeNote && !editing ? <>
        <header className="notesTopbar"><button className="notesBack" onClick={() => { setReaderExpanded(false); setActiveNote(null); }}><ArrowLeft size={16} /> All notes</button><div className="notesTopActions"><button title={activeNote.bookmarked ? "Remove bookmark" : "Bookmark note"} aria-label="Toggle bookmark" onClick={() => void toggleNoteFlag(activeNote, "bookmarked")}><Bookmark size={16} fill={activeNote.bookmarked ? "currentColor" : "none"} /></button><button title="Download Markdown" aria-label="Download note" onClick={() => downloadNote(activeNote)}><Download size={16} /></button><button title="Print note" aria-label="Print note" onClick={() => window.print()}><Printer size={16} /></button><button className="notesPrimary small" onClick={() => startEdit(activeNote)}>Edit note</button></div></header>
        <div className={`readerLayout ${subjectColor(activeNote.subject)} ${readerTocVisible ? "" : "readerTocHidden"} ${readerToolsVisible ? "" : "readerToolsHidden"}`}>
          <aside className="readerToc"><span>IN THIS NOTE</span>{headings.length ? headings.map((heading) => <a href={`#${heading.id}`} key={heading.id}>{heading.title}</a>) : <p>Add headings with # in the editor to build a table of contents.</p>}<button className={activeNote.revision_marked ? "revisionOn" : ""} onClick={() => void toggleNoteFlag(activeNote, "revision_marked")}><BookOpen size={15} />{activeNote.revision_marked ? "In revision queue" : "Mark for revision"}</button></aside>
          <article className="noteReader" ref={readerRef} onScroll={updateProgress}>
            <div className="readerViewControls" aria-label="Note and source view controls">
              <div className="readerModeButtons" role="group" aria-label="Choose what to view">
                <button className={readerMode === "notes" ? "selected" : ""} aria-pressed={readerMode === "notes"} onClick={() => setReaderMode("notes")}><BookOpen size={15} /> Generated notes</button>
                {activeNote.source_document_id && <button className={readerMode === "source" ? "selected" : ""} aria-pressed={readerMode === "source"} onClick={() => setReaderMode("source")}><FileText size={15} /> Original PDF</button>}
                {activeNote.source_document_id && <button className={readerMode === "split" ? "selected" : ""} aria-pressed={readerMode === "split"} onClick={() => setReaderMode("split")}><Columns2 size={15} /> Side by side</button>}
              </div>
              <div className="readerViewTools">
                <button className="readerPanelToggle" aria-expanded={readerTocVisible} onClick={() => setReaderTocVisible((visible) => !visible)}>{readerTocVisible ? "Hide contents" : "Show contents"}</button>
                <button className="readerPanelToggle" aria-expanded={readerToolsVisible} onClick={() => setReaderToolsVisible((visible) => !visible)}>{readerToolsVisible ? "Hide tools" : "Show tools"}</button>
                {readerMode !== "source" && <><button title="Decrease note text size" aria-label="Decrease note text size" disabled={readerTextSize <= 0} onClick={() => setReaderTextSize((size) => Math.max(0, size - 1))}><Type size={14} />−</button><button title="Increase note text size" aria-label="Increase note text size" disabled={readerTextSize >= 3} onClick={() => setReaderTextSize((size) => Math.min(3, size + 1))}><Type size={17} />+</button></>}
                {readerMode !== "notes" && <><button title="Zoom out PDF" aria-label="Zoom out PDF" disabled={sourcePdfZoom <= 75} onClick={() => setSourcePdfZoom((zoom) => Math.max(75, zoom - 25))}><ZoomOut size={16} /></button><span className="readerZoomValue">{sourcePdfZoom}%</span><button title="Zoom in PDF" aria-label="Zoom in PDF" disabled={sourcePdfZoom >= 200} onClick={() => setSourcePdfZoom((zoom) => Math.min(200, zoom + 25))}><ZoomIn size={16} /></button></>}
                <button title={readerExpanded ? "Exit full view" : "Full view"} aria-label={readerExpanded ? "Exit full view" : "Full view"} onClick={() => setReaderExpanded((expanded) => !expanded)}>{readerExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
              </div>
            </div>
            <div className="readerCrumb"><a href="/notes" onClick={(event) => { event.preventDefault(); setActiveNote(null); setView("dashboard"); }}>Notes</a><ChevronRight size={13} />{activeNote.subject}{activeNote.chapter && <><ChevronRight size={13} />{activeNote.chapter}</>}</div>
            <header className={`readerHero ${subjectColor(activeNote.subject)}`}>
              <div className="readerHeroMark"><ActiveSubjectIcon size={29} /></div>
              <div className={`readerSubject ${subjectColor(activeNote.subject)}`}><ActiveSubjectIcon size={15} />{activeNote.subject.toUpperCase()}<span>{activeNote.difficulty}</span></div>
              <h1>{activeNote.title}</h1>
              <div className="readerMeta">Updated {formatDate(activeNote.updated_at)}{activeNote.chapter && <span>{activeNote.chapter}</span>}{activeNote.source_document_id && <a href={`/api/notes/documents/${activeNote.source_document_id}/file`} target="_blank" rel="noreferrer">Source: {activeNote.source_filename || "PDF"}</a>}</div>
            </header>
            <div className={`readerStudyLayout readerMode-${readerMode}`} style={{ "--reader-text-scale": [0.95, 1, 1.12, 1.25][readerTextSize] } as React.CSSProperties}>
              {readerMode !== "source" && <div className="readerContent">{activeNote.content ? renderContent(activeNote.content) : <div className="readerEmpty">This note has no content yet. Add your study material with Edit note.</div>}</div>}
              {readerMode !== "notes" && activeNote.source_document_id && <section className="readerPdfPanel" aria-label="Original source PDF">
                <div className="readerPdfToolbar"><span><FileText size={15} /> Original source PDF</span><small>{activeNote.source_filename || "Study material"}</small><strong>{sourcePdfZoom}% zoom</strong></div>
                <iframe title={`Original PDF: ${activeNote.source_filename || activeNote.title}`} src={`/api/notes/documents/${activeNote.source_document_id}/file#toolbar=1&view=FitH&zoom=${sourcePdfZoom}`} />
              </section>}
            </div>
          </article>
          <aside className="readerQuick"><div className="quickProgress"><span>READING PROGRESS</span><strong>{progress}%</strong><div><i style={{ width: `${progress}%` }} /></div></div><div className="quickBox"><span>STUDY TOOLS</span><button onClick={() => void toggleNoteFlag(activeNote, "revision_marked")}><BookOpen size={15} />{activeNote.revision_marked ? "Remove revision mark" : "Add to revision"}</button><button onClick={() => startEdit(activeNote)}><FileText size={15} />Personal annotations</button></div><div className="quickBox related"><span>RELATED PRACTICE</span><a href={activeNote.subject === "PySpark" ? "/pyspark" : "/sql"}>{activeNote.subject === "PySpark" ? "Open PySpark Lab" : "Open SQL Lab"}<ChevronRight size={14} /></a></div></aside>
        </div>
      </> : <>
        <header className="notesTopbar dashboardTopbar"><div><div className="notesEyebrow">YOUR PERSONAL LEARNING LIBRARY</div><h1>{title}</h1></div><div className="notesTopActions"><button className="notesSecondary" disabled={pdfBusy} onClick={() => pdfFileRef.current?.click()}><Plus size={15} /> Upload PDF</button><button className="notesSecondary" onClick={() => { setView("pdf"); setActivePdf(null); }}><Sparkles size={15} /> Generate with AI</button><button className="notesPrimary" onClick={startCreate}><Plus size={16} /> Create note</button></div></header>
        {view !== "pdf" && <section className="notesToolbar"><label className="notesSearch"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, chapters and concepts" /><kbd>/</kbd></label><div className="notesCount"><FileText size={15} />{notes.length} saved {notes.length === 1 ? "note" : "notes"}</div></section>}
        {notice && <div className="notesNotice" role="status"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15} /></button></div>}
        {error && <div className="notesError" role="alert">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}
        {loading ? <div className="notesEmpty">Loading your notes…</div> : view === "pdf" ? <PdfLibrary documents={documents} activePdf={activePdf} subject={pdfSubject} busy={pdfBusy} onSubjectChange={setPdfSubject} onSelect={setActivePdf} onUpload={() => pdfFileRef.current?.click()} onGenerate={(document) => void generateFromPdf(document)} onDelete={(document) => void removePdf(document)} onOpenNote={(noteId) => { const note = notes.find((item) => item.id === noteId); if (note) void openNote(note); else setError("Generated note not found. Refresh your notes."); }} /> : view === "dashboard" && !search ? <>
          <section className="subjectSection"><div className="notesSectionHead"><div><span>EXPLORE BY SUBJECT</span><h2>Your study library</h2></div><small>Counts reflect your saved notes</small></div><div className="subjectGrid">{subjects.map((subject) => { const SubjectIcon = subjectIcons[subject] || BookOpen; return <button className={`subjectCard ${subjectColor(subject)}`} key={subject} onClick={() => { setActiveSubject(subject); setView("subject"); }}><span className="subjectIcon"><SubjectIcon size={19} /></span><strong>{subject}</strong><small>{notes.filter((note) => note.subject === subject).length} notes</small><ChevronRight size={16} /></button>; })}</div></section>
          <section className="notesSplit"><div className="notesSection"><div className="notesSectionHead"><div><span>KEEP YOUR MOMENTUM</span><h2>Recently viewed</h2></div><button onClick={() => { setView("recent"); setActiveNote(null); }}>View all <ChevronRight size={14} /></button></div>{recentlyViewed.length ? <div className="noteList">{recentlyViewed.map((note) => <NoteRow key={note.id} note={note} open={openNote} />)}</div> : <div className="inlineEmpty">Notes you open will appear here.</div>}</div><div className="notesSection"><div className="notesSectionHead"><div><span>QUICK ACCESS</span><h2>Bookmarked</h2></div><button onClick={() => { setView("bookmarks"); setActiveNote(null); }}>View all <ChevronRight size={14} /></button></div>{bookmarks.length ? <div className="noteList">{bookmarks.map((note) => <NoteRow key={note.id} note={note} open={openNote} />)}</div> : <div className="inlineEmpty">Bookmark a note to keep it close.</div>}</div></section>
          <section className="featuredSection"><div><span>START YOUR COLLECTION</span><h2>Make this library yours.</h2><p>Create study notes organized around the topics you are learning right now.</p></div><button className="notesPrimary" onClick={startCreate}><Plus size={16} /> Create your first note</button><div className="featuredMark"><BookOpen size={31} /></div></section>
        </> : <section className="notesSection listingSection"><div className="notesSectionHead"><div><span>{view === "subject" ? "SUBJECT LIBRARY" : "YOUR COLLECTION"}</span><h2>{search ? `Search results` : title}</h2></div><span className="resultCount">{filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}</span></div>{filteredNotes.length ? <div className="noteGrid">{filteredNotes.map((note) => <NoteCard key={note.id} note={note} open={openNote} bookmark={() => void toggleNoteFlag(note, "bookmarked")} />)}</div> : <EmptyNotes search={search} create={startCreate} />}</section>}
      </>}
    </main>

    {editing && <div className="noteModalBackdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}><form className="noteEditorModal" onSubmit={(event) => void saveNote(event)}><header><div><span>{activeNote ? "EDIT STUDY MATERIAL" : "NEW STUDY MATERIAL"}</span><h2>{activeNote ? "Edit note" : "Create a note"}</h2></div><button type="button" aria-label="Close editor" onClick={() => setEditing(false)}><X size={18} /></button></header><label>Title<input required maxLength={160} autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Window functions" /></label><div className="noteFormRow"><label>Subject<select value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label><label>Difficulty<select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Note["difficulty"] })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div><label>Chapter or folder<input maxLength={120} value={draft.chapter} onChange={(event) => setDraft({ ...draft, chapter: event.target.value })} placeholder="Optional chapter" /></label><label>Study material<textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder={'Use headings to structure your note:\n\n# Overview\nWrite your explanation here.\n\n```sql\nSELECT ...\n```'} /></label>{error && <div className="notesError" role="alert">{error}</div>}<footer>{activeNote && <button type="button" className="deleteNote" onClick={() => void removeNote(activeNote)}><Trash2 size={15} /> Delete</button>}<button type="button" className="notesSecondary" onClick={() => setEditing(false)}>Cancel</button><button className="notesPrimary" disabled={saving}>{saving ? "Saving…" : "Save note"}</button></footer></form></div>}
  </div>;
}

function PdfLibrary({ documents, activePdf, subject, busy, onSubjectChange, onSelect, onUpload, onGenerate, onDelete, onOpenNote }: {
  documents: PdfDocument[];
  activePdf: PdfDocument | null;
  subject: string;
  busy: boolean;
  onSubjectChange: (subject: string) => void;
  onSelect: (document: PdfDocument) => void;
  onUpload: () => void;
  onGenerate: (document: PdfDocument) => void;
  onDelete: (document: PdfDocument) => void;
  onOpenNote: (noteId: string) => void;
}) {
  return <section className="pdfLibrary">
    <div className="pdfLibraryToolbar"><div><span>ORIGINAL STUDY SOURCES</span><p>PDFs are private to your account. Generated notes are stored separately.</p></div><button className="notesPrimary" disabled={busy} onClick={onUpload}><Plus size={15} /> Upload PDF</button></div>
    {!documents.length ? <div className="notesEmpty"><span><FileText size={23} /></span><h3>No PDFs in your library</h3><p>Upload a study PDF to store the original and generate organized notes with AI.</p><button className="notesPrimary" disabled={busy} onClick={onUpload}><Plus size={15} /> Upload PDF</button></div> : <div className="pdfLibraryLayout">
      <div className="pdfDocumentList">{documents.map((document) => <article className={`pdfDocument ${activePdf?.id === document.id ? "selected" : ""}`} key={document.id}>
        <button className="pdfDocumentSelect" onClick={() => onSelect(document)}><FileText size={18} /><span><strong>{document.filename}</strong><small>{(document.size_bytes / 1024 / 1024).toFixed(1)} MB · {formatDate(document.created_at)}</small></span></button>
        <div className={`pdfStatus ${document.status}`}>{document.status === "processing" ? "Generating notes" : document.status}</div>
        {document.processing_error && <p className="pdfErrorText">{document.processing_error}</p>}
        <label className="pdfSubjectSelect">Generate notes for<select value={subject} onChange={(event) => onSubjectChange(event.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="pdfDocumentActions">{document.generated_note_id && <button onClick={() => onOpenNote(document.generated_note_id!)}>Open notes</button>}<button disabled={busy || document.status === "processing"} onClick={() => onGenerate(document)}>{document.status === "failed" ? "Retry" : document.status === "completed" ? "Generate again" : "Generate notes"}</button><button className="pdfDelete" onClick={() => onDelete(document)}>Delete PDF</button></div>
      </article>)}</div>
      <div className="pdfPreview"><div className="pdfPreviewToolbar"><strong>{activePdf?.filename || "Select a PDF"}</strong>{activePdf && <a href={`/api/notes/documents/${activePdf.id}/file`} target="_blank" rel="noreferrer">Open in new tab</a>}</div>{activePdf ? <iframe title={`Preview of ${activePdf.filename}`} src={`/api/notes/documents/${activePdf.id}/file`} /> : <div className="pdfPreviewEmpty"><FileText size={23} /><span>Select an uploaded PDF to preview it.</span></div>}</div>
    </div>}
  </section>;
}

function NoteRow({ note, open }: { note: Note; open: (note: Note) => void }) {
  return <button className="noteRow" onClick={() => void open(note)}><span className={`noteFileIcon ${subjectColor(note.subject)}`}><FileText size={17} /></span><span className="noteRowCopy"><strong>{note.title}</strong><small>{note.subject}{note.chapter ? ` · ${note.chapter}` : ""}</small></span><span className="noteRowDate">{formatDate(note.last_viewed_at || note.updated_at)}</span><ChevronRight size={15} /></button>;
}

function NoteCard({ note, open, bookmark }: { note: Note; open: (note: Note) => void; bookmark: () => void }) {
  return <article className={`noteCard ${subjectColor(note.subject)}`}><button className="noteCardOpen" onClick={() => void open(note)}><span className="noteCardTop"><FileText size={18} /><span>{note.difficulty}</span></span><strong>{note.title}</strong><small>{note.subject}{note.chapter ? ` · ${note.chapter}` : ""}</small><span className="noteCardPreview">{note.content.split("\n").find((line) => line.trim() && !line.trim().startsWith("#")) || "No preview text yet."}</span><span className="noteCardProgress"><span><i style={{ width: `${note.progress_percent}%` }} /></span>{note.progress_percent}% read</span></button><button className="noteCardBookmark" aria-label={note.bookmarked ? "Remove bookmark" : "Bookmark"} onClick={bookmark}><Bookmark size={15} fill={note.bookmarked ? "currentColor" : "none"} /></button></article>;
}

function EmptyNotes({ search, create }: { search: string; create: () => void }) {
  return <div className="notesEmpty"><span><FileText size={23} /></span><h3>{search ? "No matching notes" : "Nothing here yet"}</h3><p>{search ? "Try another title, chapter or concept." : "Your saved study materials will show up in this space."}</p>{!search && <button className="notesPrimary" onClick={create}><Plus size={15} /> Create a note</button>}</div>;
}