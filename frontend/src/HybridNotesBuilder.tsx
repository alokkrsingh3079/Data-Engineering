import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Image, Mic, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import type { Note } from "./NotesStudio";
import { renderInlineNoteMarkdown } from "./note-markdown";
import "./hybrid-notes-builder.css";

type Language = "plaintext" | "sql" | "python" | "pyspark" | "json";
type Section = { id: string; title: string; kind: "markdown" | "code"; language: Language; content: string };
type Metadata = { title: string; subject: string; topic: string; subtopic: string; difficulty: Note["difficulty"]; tags: string; source: string };
type AssistAction = "definition" | "explain" | "simplify" | "improve" | "example" | "code" | "explain-code" | "expected-output" | "interview" | "use-cases" | "missing-concepts" | "readability" | "summarize" | "expand" | "revision" | "custom";
type SpeechResult = { 0: { transcript: string }; length: number };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
type VoiceState = "idle" | "recording" | "transcribing";

const API = "";
const MAX_VOICE_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_NOTE_CHARS = 5_000_000;
const MAX_IMAGE_BYTES = 900 * 1024;
const MAX_IMAGE_FILE_BYTES = 15 * 1024 * 1024;
const noteColors = ["red", "orange", "amber", "yellow", "lime", "green", "teal", "cyan", "blue", "indigo", "violet", "purple", "pink"] as const;
const subjects = ["SQL", "Python", "PySpark", "Data Engineering", "ETL Testing", "Databricks", "Azure", "Snowflake", "Data Warehousing", "Interview Preparation", "Azure Data Factory", "ETL & Data Warehousing", "Data Engineering System Design", "Data Engineering Concepts"];
const languages: Language[] = ["plaintext", "sql", "python", "pyspark", "json"];
const actions: { value: AssistAction; label: string }[] = [
  { value: "definition", label: "Generate a definition" },
  { value: "explain", label: "Explain the concept" },
  { value: "simplify", label: "Explain in simple language" },
  { value: "improve", label: "Improve selected explanation" },
  { value: "example", label: "Generate a practical example" },
  { value: "code", label: "Generate code" },
  { value: "explain-code", label: "Explain code line by line" },
  { value: "expected-output", label: "Add illustrative expected output" },
  { value: "interview", label: "Generate interview questions and answers" },
  { value: "use-cases", label: "Add real-world use cases" },
  { value: "missing-concepts", label: "Identify missing concepts" },
  { value: "readability", label: "Improve formatting and readability" },
  { value: "summarize", label: "Summarize this section" },
  { value: "expand", label: "Expand into detailed study notes" },
  { value: "revision", label: "Generate revision points" },
  { value: "custom", label: "Custom instruction" },
];

function newSection(title = "New section", kind: Section["kind"] = "markdown"): Section {
  return { id: crypto.randomUUID(), title, kind, language: "python", content: "" };
}

function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];
  for (const line of content.split("\n")) {
    const heading = /^##\s+(.+)$/.exec(line.trim());
    if (heading) {
      if (currentLines.length || currentTitle) sections.push({ ...newSection(currentTitle || "Notes"), content: currentLines.join("\n").trim() });
      currentTitle = heading[1].trim();
      currentLines = [];
    } else currentLines.push(line);
  }
  if (currentLines.length || currentTitle) sections.push({ ...newSection(currentTitle || "Notes"), content: currentLines.join("\n").trim() });
  return sections.length ? sections : [newSection("Notes")];
}

function serializeSections(sections: Section[]) {
  return sections.map((section) => {
    const heading = section.title.trim() ? `## ${section.title.trim()}\n\n` : "";
    const body = section.kind === "code"
      ? `\`\`\`${section.language === "plaintext" ? "" : section.language}\n${section.content}\n\`\`\``
      : section.content;
    return `${heading}${body}`.trim();
  }).filter(Boolean).join("\n\n");
}

function codeExtensions(language: Language) {
  if (language === "sql") return [sql()];
  if (language === "python" || language === "pyspark") return [python()];
  return [];
}

function MarkdownPreview({ content, onCopyError, onCopySuccess }: { content: string; onCopyError: (message: string) => void; onCopySuccess: () => void }) {
  const lines = content.split("\n");
  const nodes: JSX.Element[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const fence = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const language = (fence[2].trim().toLowerCase() || "plaintext") as Language;
      const code: string[] = [];
      index++;
      while (index < lines.length && !new RegExp(`^\\s*${marker}{3,}`).test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      nodes.push(<div className="hybridPreviewCode" key={`code-${index}`}><div><span>{language}</span><button type="button" aria-label="Copy code" onClick={() => void Promise.resolve().then(() => navigator.clipboard.writeText(code.join("\n"))).then(onCopySuccess).catch(() => onCopyError("Clipboard access was denied. Select and copy the code manually."))}><Copy size={13} />Copy</button></div><CodeMirror value={code.join("\n")} extensions={codeExtensions(languages.includes(language) ? language : "plaintext")} theme={oneDark} editable={false} basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }} /></div>);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = `h${heading[1].length}` as "h1" | "h2" | "h3";
      nodes.push(<Tag key={`heading-${index}`}>{renderInlineNoteMarkdown(heading[2])}</Tag>);
      index++;
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const table: string[] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) table.push(lines[index++]);
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const rows = table.filter((row) => !/^\s*\|?\s*:?-{2,}/.test(row)).map(cells);
      const [header = [], ...body] = rows;
      nodes.push(<div className="hybridPreviewTable" key={`table-${index}`}><table><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{renderInlineNoteMarkdown(cell)}</th>)}</tr></thead><tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{header.map((_, cellIndex) => <td key={cellIndex}>{renderInlineNoteMarkdown(row[cellIndex] || "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s/.test(lines[index])) items.push(lines[index++].trim().replace(/^[-*]\s/, ""));
      nodes.push(<ul key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineNoteMarkdown(item)}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+[.)]\s/.test(lines[index])) items.push(lines[index++].trim().replace(/^\d+[.)]\s/, ""));
      nodes.push(<ol key={`ordered-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineNoteMarkdown(item)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].trim().replace(/^>\s?/, ""));
      nodes.push(<blockquote key={`quote-${index}`}>{quote.map((part, partIndex) => <p key={partIndex}>{renderInlineNoteMarkdown(part)}</p>)}</blockquote>);
      continue;
    }
    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^[-*]\s|^\d+[.)]\s|^>|^\|.*\|$|^`{3,}|^~{3,}/.test(lines[index].trim())) paragraph.push(lines[index++].trim());
    nodes.push(<p key={`paragraph-${index}`}>{renderInlineNoteMarkdown(paragraph.join(" "))}</p>);
  }
  return <div className="hybridPreviewContent">{nodes.length ? nodes : <p className="hybridPreviewEmpty">Your note preview will appear here.</p>}</div>;
}

export default function HybridNotesBuilder({ note, onClose, onSaved }: { note?: Note | null; onClose: () => void; onSaved: (note: Note) => void }) {
  const [savedNote, setSavedNote] = useState<Note | null>(note || null);
  const [metadata, setMetadata] = useState<Metadata>(() => ({ title: note?.title || "", subject: note?.subject || "SQL", topic: note?.chapter || "", subtopic: note?.subtopic || "", difficulty: note?.difficulty || "intermediate", tags: (note?.tags || []).join(", "), source: note?.source || "" }));
  const [sections, setSections] = useState<Section[]>(() => parseSections(note?.content || ""));
  const [activeSectionId, setActiveSectionId] = useState("");
  const [stage, setStage] = useState<"edit" | "review">("edit");
  const [action, setAction] = useState<AssistAction>("explain");
  const [instruction, setInstruction] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [generationStreaming, setGenerationStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ sectionId: string; start: number; end: number } | null>(null);
  const [voiceText, setVoiceText] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceMode, setVoiceMode] = useState<"live" | "fallback">("live");
  const [imageBusy, setImageBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const cancelledRecordingRef = useRef(false);
  const liveTranscriptRef = useRef("");
  const sectionRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const generationStartedAt = useRef(0);
  const [baseline, setBaseline] = useState(() => JSON.stringify({ metadata, sections }));

  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const content = useMemo(() => serializeSections(sections), [sections]);
  const tags = useMemo(() => metadata.tags.split(",").map((tag) => tag.trim()).filter(Boolean), [metadata.tags]);
  const snapshot = JSON.stringify({ metadata, sections });
  const dirty = snapshot !== baseline;

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!dirty && !saving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty, saving]);

  useEffect(() => {
    if (!sections.some((section) => section.id === activeSectionId)) setActiveSectionId(sections[0]?.id || "");
  }, [sections, activeSectionId]);

  useEffect(() => {
    if (!aiBusy) return;
    const timer = window.setInterval(() => setGenerationSeconds(Math.floor((Date.now() - generationStartedAt.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [aiBusy]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function leaveBuilder() {
    if ((dirty || saving) && !window.confirm("You have unsaved changes. Leave the Hybrid Notes Builder without saving?")) return;
    onClose();
  }

  function updateSection(id: string, patch: Partial<Section>) {
    const existing = sections.find((section) => section.id === id);
    if (existing && patch.content !== undefined) {
      const total = sections.reduce((sum, section) => sum + section.content.length, 0);
      if (total - existing.content.length + patch.content.length > MAX_NOTE_CHARS) {
        setError("Notes are limited to 5,000,000 characters total, including embedded images. Remove content or an image to continue.");
        return;
      }
    }
    setError("");
    setSections((current) => current.map((section) => section.id === id ? { ...section, ...patch } : section));
  }

  function addSection(kind: Section["kind"] = "markdown") {
    const section = newSection(kind === "code" ? "Code example" : `Section ${sections.length + 1}`, kind);
    setSections((current) => [...current, section]);
    setActiveSectionId(section.id);
    setStage("edit");
  }

  function moveSection(id: string, direction: -1 | 1) {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function duplicateSection(section: Section) {
    const copy = { ...section, id: crypto.randomUUID(), title: `${section.title} (copy)` };
    setSections((current) => {
      const index = current.findIndex((item) => item.id === section.id);
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    setActiveSectionId(copy.id);
  }

  function removeSection(section: Section) {
    if (!window.confirm(`Delete the section "${section.title || "Untitled"}"?`)) return;
    const index = sections.findIndex((item) => item.id === section.id);
    const next = sections.filter((item) => item.id !== section.id);
    if (!next.length) next.push(newSection());
    if (activeSectionId === section.id) setActiveSectionId(next[Math.max(0, index - 1)].id);
    setSections(next);
  }

  function insertFormatting(before: string, after = before, placeholder = "text") {
    if (!activeSection || activeSection.kind !== "markdown") return;
    const textarea = sectionRefs.current[activeSection.id];
    const start = textarea?.selectionStart ?? activeSection.content.length;
    const end = textarea?.selectionEnd ?? start;
    const current = activeSection.content;
    const selected = current.slice(start, end) || placeholder;
    const next = `${current.slice(0, start)}${before}${selected}${after}${current.slice(end)}`;
    updateSection(activeSection.id, { content: next });
    setSelectedRange({ sectionId: activeSection.id, start: start + before.length, end: start + before.length + selected.length });
    requestAnimationFrame(() => {
      const editor = sectionRefs.current[activeSection.id];
      editor?.focus();
      editor?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function addImage(file: File) {
    if (!activeSection || activeSection.kind !== "markdown") {
      setError("Select a text section before adding an image.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setError("Choose an image smaller than 15 MB; it will be resized and compressed before insertion.");
      return;
    }
    setImageBusy(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      let blob: Blob | null = null;
      for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4]) {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (blob && blob.size <= MAX_IMAGE_BYTES) break;
      }
      if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error("This image could not be compressed below 900 KB. Try a smaller image.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image could not be read."));
        reader.onerror = () => reject(new Error("Image could not be read."));
        reader.readAsDataURL(blob);
      });
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\r\n]/g, "").trim() || "Note image";
      const insert = `![${alt}](${dataUrl})`;
      const current = activeSection.content;
      const textarea = sectionRefs.current[activeSection.id];
      const start = textarea?.selectionStart ?? current.length;
      const end = textarea?.selectionEnd ?? start;
      const prefix = start > 0 && current[start - 1] !== "\n" ? "\n\n" : "";
      const suffix = current.slice(end).startsWith("\n") ? "" : "\n\n";
      const nextContent = `${current.slice(0, start)}${prefix}${insert}${suffix}${current.slice(end)}`;
      const totalContentLength = sections.reduce((sum, section) => sum + section.content.length, 0);
      if (totalContentLength - current.length + nextContent.length > MAX_NOTE_CHARS) {
        throw new Error("This image would exceed the 5,000,000-character note limit. Remove content or an image first.");
      }
      updateSection(activeSection.id, { content: nextContent });
      setNotice("Image added. Review its placement in the preview; it will be saved with the note.");
      requestAnimationFrame(() => sectionRefs.current[activeSection.id]?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be added.");
    } finally {
      setImageBusy(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function generateSuggestion(override?: { instruction: string; selectedText?: string }) {
    if (!activeSection || aiBusy) return;
    setAiBusy(true);
    setGenerationStreaming(false);
    setGenerationSeconds(0);
    generationStartedAt.current = Date.now();
    setError("");
    setSuggestion("");
    try {
      const selectedText = override?.selectedText ?? (selectedRange?.sectionId === activeSection.id ? activeSection.content.slice(selectedRange.start, selectedRange.end) : "");
      const response = await fetch(`${API}/api/notes/assist`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          instruction: override?.instruction ?? instruction,
          title: metadata.title,
          subject: metadata.subject,
          topic: metadata.topic,
          subtopic: metadata.subtopic,
          difficulty: metadata.difficulty,
          language: activeSection.kind === "code" ? activeSection.language : "plaintext",
          sectionTitle: activeSection.title,
          selectedText,
          sectionContent: selectedText ? "" : activeSection.content.slice(0, 12_000),
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || `AI could not generate this section (HTTP ${response.status}).`);
      }
      if (!(response.headers.get("content-type") || "").toLowerCase().includes("application/x-ndjson") || !response.body) {
        throw new Error("The AI service did not start a streaming response. Restart the local backend and try again.");
      }
      setGenerationStreaming(true);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";
      let generated = "";
      let completed = false;
      const processLine = (line: string) => {
        if (!line.trim()) return;
        const packet = JSON.parse(line) as { delta?: string; done?: boolean; error?: string };
        if (packet.error) throw new Error(packet.error);
        if (packet.delta) {
          generated += packet.delta;
          setSuggestion(generated);
        }
        if (packet.done) completed = true;
      };
      while (true) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        for (const line of lines) processLine(line);
        if (done) break;
      }
      if (pending.trim()) processLine(pending);
      if (!completed || !generated.trim()) throw new Error("AI generation ended before a complete response arrived. Try again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI could not generate this section.");
    } finally {
      setAiBusy(false);
      setGenerationStreaming(false);
    }
  }

  function suggestionForSection(value: string, asCode: boolean) {
    if (!activeSection) return value;
    if (!asCode || activeSection.kind === "code" || value.trim().startsWith("```")) return value;
    return `\`\`\`${activeSection.language === "plaintext" ? "python" : activeSection.language}\n${value.trim()}\n\`\`\``;
  }

  function insertSuggestion(asCode = false) {
    if (!activeSection || !suggestion.trim()) return;
    const position = selectedRange?.sectionId === activeSection.id ? selectedRange.end : activeSection.content.length;
    const text = suggestionForSection(suggestion.trim(), asCode);
    const before = activeSection.content.slice(0, position).replace(/\s*$/, "");
    const after = activeSection.content.slice(position).replace(/^\s*/, "");
    updateSection(activeSection.id, { content: [before, text, after].filter(Boolean).join("\n\n") });
    setSuggestion("");
    requestAnimationFrame(() => {
      const editor = sectionRefs.current[activeSection.id];
      editor?.focus();
      editor?.setSelectionRange(Math.min(position + text.length + 2, editor.value.length), Math.min(position + text.length + 2, editor.value.length));
    });
  }

  function replaceSelection() {
    if (!activeSection || !suggestion.trim() || selectedRange?.sectionId !== activeSection.id || selectedRange.start === selectedRange.end) return;
    if (!window.confirm("Replace only the selected text with this AI suggestion? Your other note content will remain unchanged.")) return;
    const text = suggestionForSection(suggestion.trim(), activeSection.kind === "code");
    const next = `${activeSection.content.slice(0, selectedRange.start)}${text}${activeSection.content.slice(selectedRange.end)}`;
    updateSection(activeSection.id, { content: next });
    setSelectedRange(null);
    setSuggestion("");
  }

  function startVoice() {
    setVoiceError("");
    setVoiceText("");
    liveTranscriptRef.current = "";
    voiceChunksRef.current = [];
    cancelledRecordingRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Audio recording is not supported in this browser. Use a modern browser over HTTPS, or type your instruction.");
      return;
    }
    void navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      voiceStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) voiceChunksRef.current.push(event.data); };
      recorder.onerror = () => setVoiceError("Audio recording failed. Stop and retry, or type your instruction.");
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        recorderRef.current = null;
        if (cancelledRecordingRef.current) return;
        const audio = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!audio.size) {
          setVoiceState("idle");
          setVoiceError("The recording was empty. Check microphone access and try again.");
        } else if (audio.size > 8 * 1024 * 1024) {
          setVoiceState("idle");
          setVoiceError("The recording exceeded the 8 MB limit. Record a shorter instruction and try again.");
        } else void transcribeVoice(audio);
      };
      recorder.start();
      setVoiceState("recording");
      setVoiceMode("live");
      setNotice("Recording. Live captions appear as you speak; stop to review the backend transcription.");
      const speechWindow = window as SpeechWindow;
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setVoiceMode("fallback");
        setVoiceError("Live captions are unavailable in this browser. Audio is recording and will be transcribed when you stop.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
        liveTranscriptRef.current = transcript;
        setVoiceText(transcript);
      };
      recognition.onerror = (event) => {
        recognitionRef.current = null;
        setVoiceMode("fallback");
        setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Live captions were denied by the browser. Audio is still recording and will be transcribed when you stop."
          : `Live captions are unavailable (${event.error}). Audio is still recording and will be transcribed when you stop.`);
      };
      recognition.onend = () => { recognitionRef.current = null; };
      recognitionRef.current = recognition;
      try { recognition.start(); }
      catch {
        recognitionRef.current = null;
        setVoiceMode("fallback");
        setVoiceError("Live captions could not start. Audio is still recording and will be transcribed when you stop.");
      }
    }).catch((cause: unknown) => {
      const name = cause instanceof Error ? cause.name : "";
      setVoiceState("idle");
      setVoiceError(name === "NotAllowedError" || name === "PermissionDeniedError"
        ? "Microphone permission was denied. Allow microphone access in browser settings or type your instruction."
        : name === "NotFoundError"
          ? "No microphone was found. Connect one or type your instruction."
          : "The microphone could not be started. Check microphone permissions and use the app over HTTPS.");
    });
  }

  function stopVoice() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setVoiceState("transcribing");
    }
  }

  function cancelVoice() {
    cancelledRecordingRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    voiceChunksRef.current = [];
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else {
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      setVoiceState("idle");
    }
  }

  async function transcribeVoice(audio: Blob) {
    setVoiceState("transcribing");
    setVoiceError("");
    setNotice("Transcribing your recording. The result will appear for review before use.");
    try {
      if (audio.size > MAX_VOICE_AUDIO_BYTES) {
        throw new Error("Recording is larger than 5 MB. Record a shorter voice instruction and try again.");
      }
      const bytes = new Uint8Array(await audio.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
      }
      const mimeType = audio.type.toLowerCase().split(";")[0];
      if (!["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"].includes(mimeType)) {
        throw new Error(`Unsupported recording format (${mimeType || "unknown"}). Try a browser that records WebM, Ogg, MP4, MPEG, or WAV.`);
      }
      const response = await fetch(`${API}/api/notes/assist`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "transcription", mimeType, audioBase64: btoa(binary) }),
      });
      const responseText = await response.text();
      const isJson = (response.headers.get("content-type") || "").toLowerCase().includes("application/json");
      let result: { error?: string; text?: string } | null = null;
      if (isJson) try { result = JSON.parse(responseText) as { error?: string; text?: string }; } catch { result = null; }
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id") || response.headers.get("cf-ray");
        const detail = result?.error || (!isJson && response.status === 403
          ? "The API gateway denied this request before the voice-assistance API responded. Confirm the latest backend is deployed and the authenticated Notes AI-assistance endpoint is allowed."
          : !isJson
            ? response.status === 413
              ? "The recording exceeded the API request-size limit. Keep recordings under 5 MB and try again."
              : `The API returned a non-JSON response (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}).`
            : `Transcription failed (HTTP ${response.status}).`);
        throw new Error(`${detail}${requestId ? ` Request ID: ${requestId}.` : ""}`);
      }
      if (!isJson) throw new Error(`The transcription API returned a non-JSON response (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}). Check the backend deployment and try again.`);
      if (typeof result?.text !== "string" || !result.text.trim()) throw new Error("No speech was detected. Try a new recording or type your instruction.");
      setVoiceText(result.text.trim());
      liveTranscriptRef.current = result.text.trim();
      setNotice("Transcription ready. Review and correct it before inserting or sending it to AI.");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Voice transcription failed.";
      setVoiceError(`${detail} ${liveTranscriptRef.current ? "The live transcript is preserved below; you can edit and use it." : "Try again or type your instruction."}`);
    } finally {
      setVoiceState("idle");
    }
  }

  function insertTranscription() {
    if (!activeSection || !voiceText.trim()) return;
    const content = activeSection.content.trim();
    updateSection(activeSection.id, { content: [content, voiceText.trim()].filter(Boolean).join("\n\n") });
    setVoiceText("");
    setNotice("Transcription added to the current section.");
  }

  function transformTranscription() {
    if (!voiceText.trim()) {
      setVoiceError("Record or type an instruction before asking AI to create notes.");
      return;
    }
    const spokenText = voiceText.trim();
    const voiceInstruction = "Turn the user-approved voice transcription into content for the current note section. Preserve its requested details, follow the selected content type, and return only the section content.";
    setInstruction(voiceInstruction);
    void generateSuggestion({ instruction: voiceInstruction, selectedText: spokenText });
  }

  async function save(status: "draft" | "published") {
    if (saving) return;
    if (content.length > MAX_NOTE_CHARS) {
      setError("Notes are limited to 5,000,000 characters total. Remove content or an image before saving.");
      return;
    }
    if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
      setError("Use no more than 20 tags, with each tag 40 characters or fewer.");
      return;
    }
    if (status === "published" && (!metadata.title.trim() || !content.trim())) {
      setError("Add a title and at least one section before publishing this note.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const savedSnapshot = snapshot;
    const payload = {
      title: metadata.title.trim(),
      subject: metadata.subject,
      chapter: metadata.topic.trim(),
      subtopic: metadata.subtopic.trim(),
      difficulty: metadata.difficulty,
      tags,
      source: metadata.source.trim(),
      content,
      status,
    };
    try {
      const response = await fetch(savedNote ? `${API}/api/notes/${savedNote.id}` : `${API}/api/notes`, {
        method: savedNote ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "The note could not be saved.");
      setSavedNote(result as Note);
      setBaseline(savedSnapshot);
      onSaved(result as Note);
      setNotice(status === "draft" ? "Draft saved. You can continue editing and reopen it from My Notes." : "Note published and saved to My Notes.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function editSection(section: Section) {
    setActiveSectionId(section.id);
    setStage("edit");
    requestAnimationFrame(() => document.getElementById(`hybrid-section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  const selectedTextAvailable = selectedRange?.sectionId === activeSection?.id && selectedRange.start < selectedRange.end;

  return <section className="hybridBuilder" aria-label="Hybrid Notes Builder">
    <header className="hybridBuilderHeader">
      <div><button type="button" className="hybridBack" onClick={leaveBuilder}><ArrowLeft size={15} /> Notes library</button><span className="hybridEyebrow">HYBRID NOTES BUILDER</span><h1>{savedNote ? "Continue your study note" : "Build a study note"}</h1><p>Combine your own writing, reviewed AI suggestions, and voice input. Nothing is saved until you choose.</p></div>
      <div className={`hybridSaveState ${dirty ? "unsaved" : "saved"}`}><span />{saving ? "Saving…" : dirty ? "Unsaved changes" : savedNote ? "Saved" : "Not saved yet"}</div>
    </header>

    <div className="hybridMetadata">
      <label className="hybridTitleField">Note title<input maxLength={160} value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} placeholder="e.g. Understanding DataFrames in PySpark" /></label>
      <label>Subject / category<select value={metadata.subject} onChange={(event) => setMetadata({ ...metadata, subject: event.target.value })}>{subjects.map((subject) => <option key={subject}>{subject}</option>)}</select></label>
      <label>Topic<input maxLength={120} value={metadata.topic} onChange={(event) => setMetadata({ ...metadata, topic: event.target.value })} placeholder="DataFrames" /></label>
      <label>Subtopic <span>optional</span><input maxLength={120} value={metadata.subtopic} onChange={(event) => setMetadata({ ...metadata, subtopic: event.target.value })} placeholder="Filtering and transformations" /></label>
      <label>Difficulty<select value={metadata.difficulty} onChange={(event) => setMetadata({ ...metadata, difficulty: event.target.value as Metadata["difficulty"] })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
      <label>Tags <span>comma separated</span><input maxLength={900} value={metadata.tags} onChange={(event) => setMetadata({ ...metadata, tags: event.target.value })} placeholder="spark, dataframe, transformations" /></label>
      <label className="hybridSourceField">Source / reference <span>optional</span><input maxLength={300} value={metadata.source} onChange={(event) => setMetadata({ ...metadata, source: event.target.value })} placeholder="Documentation URL, book, or course" /></label>
    </div>

    <div className="hybridStageTabs" role="tablist" aria-label="Note workflow">
      <button type="button" role="tab" aria-selected={stage === "edit"} className={stage === "edit" ? "active" : ""} onClick={() => setStage("edit")}>1. Edit</button>
      <button type="button" role="tab" aria-selected={stage === "review"} className={stage === "review" ? "active" : ""} onClick={() => setStage("review")}>2. Review &amp; Preview</button>
    </div>

    {stage === "edit" ? <div className="hybridWorkspace">
      <aside className="hybridOutline"><div className="hybridPanelHeading"><strong>NOTE OUTLINE</strong><button type="button" aria-label="Add text section" onClick={() => addSection()}><Plus size={15} /></button></div>
        <div className="hybridOutlineSections">{sections.map((section, index) => <button type="button" className={section.id === activeSectionId ? "active" : ""} key={section.id} onClick={() => editSection(section)}><span>{String(index + 1).padStart(2, "0")}</span>{section.title || "Untitled section"}</button>)}</div>
        <button type="button" className="hybridAddSection" onClick={() => addSection()}><Plus size={14} /> Add text section</button>
        <button type="button" className="hybridAddSection" onClick={() => addSection("code")}><Plus size={14} /> Add code block</button>
        <div className="hybridOutlineHelp">Reorder or duplicate sections from the editor. Code blocks stay editable and retain their language.</div>
      </aside>

      <div className="hybridEditColumn">
        <div className="hybridPanelHeading"><strong>WRITE YOUR NOTE</strong><span>Markdown supported</span></div>
        {sections.map((section, index) => <article id={`hybrid-section-${section.id}`} key={section.id} className={`hybridSectionEditor ${section.id === activeSectionId ? "focused" : ""}`}>
          <div className="hybridSectionHeader"><label><span>SECTION {String(index + 1).padStart(2, "0")}</span><input value={section.title} maxLength={160} aria-label={`Section ${index + 1} title`} onFocus={() => setActiveSectionId(section.id)} onChange={(event) => updateSection(section.id, { title: event.target.value })} /></label>
            <div className="hybridSectionTools"><button type="button" title="Move section up" aria-label="Move section up" disabled={index === 0} onClick={() => moveSection(section.id, -1)}><ArrowUp size={14} /></button><button type="button" title="Move section down" aria-label="Move section down" disabled={index === sections.length - 1} onClick={() => moveSection(section.id, 1)}><ArrowDown size={14} /></button><button type="button" title="Duplicate section" aria-label="Duplicate section" onClick={() => duplicateSection(section)}><Copy size={14} /></button><button type="button" title="Delete section" aria-label="Delete section" onClick={() => removeSection(section)}><Trash2 size={14} /></button></div>
          </div>
          {section.kind === "code" ? <div className="hybridCodeEditor"><label>Language<select value={section.language} onChange={(event) => updateSection(section.id, { language: event.target.value as Language })}>{languages.map((language) => <option key={language}>{language}</option>)}</select></label><CodeMirror value={section.content} onChange={(value) => updateSection(section.id, { content: value })} extensions={codeExtensions(section.language)} theme={oneDark} basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }} /></div> : <>
            {section.id === activeSectionId && <div className="hybridFormatToolbar" aria-label="Markdown formatting toolbar">
              <button type="button" title="Heading 1" onClick={() => insertFormatting("# ", "", "Heading")}>H1</button><button type="button" title="Heading 2" onClick={() => insertFormatting("## ", "", "Heading")}>H2</button><button type="button" title="Heading 3" onClick={() => insertFormatting("### ", "", "Heading")}>H3</button><button type="button" title="Bold" onClick={() => insertFormatting("**", "**", "bold text")}><strong>B</strong></button><button type="button" title="Italic" onClick={() => insertFormatting("*", "*", "italic text")}><em>I</em></button><button type="button" title="Inline code" onClick={() => insertFormatting("`", "`", "code")}>{"</>"}</button><button type="button" title="Bulleted list" onClick={() => insertFormatting("- ", "", "List item")}>• List</button><button type="button" title="Numbered step" onClick={() => insertFormatting("1. ", "", "Step")}>1. List</button><button type="button" title="Insert table" onClick={() => insertFormatting("| Column | Value |\n| --- | --- |\n| Example | Detail |", "", "")}>Table</button><button type="button" title="Insert warning callout" onClick={() => insertFormatting("> [!WARNING]\n> ", "", "Check this carefully.")}>Warning</button>
              <span className="hybridColorPalette" role="group" aria-label="Text color">{noteColors.map((color) => <button type="button" key={color} className={`hybridColorSwatch ${color}`} title={`Apply ${color} text`} aria-label={`Apply ${color} text`} onClick={() => insertFormatting(`[color=${color}]`, "[/color]", "colored text")} />)}</span>
              <button type="button" className="hybridImageButton" title="Insert image" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}><Image size={13} />{imageBusy ? "Adding…" : "Image"}</button>
              <input ref={imageInputRef} className="hybridImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Choose an image for this note" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file); }} />
            </div>}
            <textarea ref={(element) => { sectionRefs.current[section.id] = element; }} value={section.content} onFocus={() => setActiveSectionId(section.id)} onSelect={(event) => setSelectedRange({ sectionId: section.id, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} onChange={(event) => { updateSection(section.id, { content: event.target.value }); setSelectedRange({ sectionId: section.id, start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }); }} rows={Math.max(7, Math.min(18, section.content.split("\n").length + 3))} maxLength={MAX_NOTE_CHARS} aria-label={`Content for ${section.title || "untitled section"}`} placeholder="Write notes, apply text colors, or add an image. Markdown headings, lists, tables, and code blocks are supported." />
          </>}
          {section.content.length > 0 && <small className="hybridCharacterCount">{section.content.length.toLocaleString()} characters</small>}
        </article>)}
        <button type="button" className="hybridAddInline" onClick={() => addSection()}><Plus size={15} /> Add another section</button>
      </div>

      <aside className="hybridAssistant">
        <div className="hybridPanelHeading"><strong><Sparkles size={15} /> AI ASSISTANT</strong><span>Section only</span></div>
        <label>Content type<select value={action} onChange={(event) => setAction(event.target.value as AssistAction)}>{actions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Instruction<textarea value={instruction} maxLength={1000} onChange={(event) => setInstruction(event.target.value)} rows={4} placeholder='e.g. Explain what a DataFrame is and show how to load a CSV in PySpark.' /></label>
        {selectedTextAvailable && <div className="hybridSelectedHint"><Check size={13} /> Selected text will be sent as context; it will not change unless you choose Replace selection.</div>}
        <button type="button" className="hybridGenerate" disabled={aiBusy || (!instruction.trim() && !selectedTextAvailable && !activeSection?.content.trim())} onClick={() => void generateSuggestion()}><Sparkles size={15} />{aiBusy ? `${generationStreaming ? "Generating" : "Connecting"} · ${generationSeconds}s` : "Generate suggestion"}</button>
        {aiBusy && !suggestion && <div className="hybridGenerationStatus" role="status">{generationStreaming ? "The AI is writing. Text will appear here as it is generated." : "Connecting to the AI service…"}{generationSeconds >= 20 && <span>This is taking longer than expected; the request will time out after 30 seconds.</span>}</div>}
        <p className="hybridAiNotice">AI suggestions are unverified. Review and edit code and examples before using them. Your note is never replaced automatically.</p>
        {Boolean(suggestion) && <div className="hybridSuggestion"><div className="hybridSuggestionHeader"><strong>{aiBusy ? "AI RESPONSE · LIVE" : "REVIEW SUGGESTION"}</strong>{aiBusy && <span>{generationSeconds}s</span>}<button type="button" aria-label="Discard suggestion" onClick={() => setSuggestion("")}><X size={14} /></button></div><textarea aria-label={aiBusy ? "AI response in progress" : "Edit AI suggestion"} value={suggestion} maxLength={12_000} readOnly={aiBusy} onChange={(event) => setSuggestion(event.target.value)} rows={10} />
          {!aiBusy && <div className="hybridSuggestionActions"><button type="button" onClick={() => insertSuggestion(action === "code")}><Plus size={13} /> Insert below selection</button>{selectedTextAvailable && <button type="button" className="danger" onClick={replaceSelection}>Replace selected text…</button>}{action === "code" && activeSection?.kind === "markdown" && <button type="button" onClick={() => insertSuggestion(true)}>Insert as code block</button>}</div>}
        </div>}
        <div className="hybridVoice"><div className="hybridVoiceTitle"><strong><Mic size={14} /> VOICE INPUT</strong><span>{voiceState === "recording" ? voiceMode === "live" ? "Recording · live captions" : "Recording · fallback mode" : voiceState === "transcribing" ? "Transcribing…" : "Optional"}</span></div><p>Live captions are shown as you speak. If browser captions cannot connect, the recording is transcribed by the server when you stop.</p>
          <div className="hybridVoiceActions">{voiceState === "recording" ? <><button type="button" className="recording" onClick={stopVoice}><Mic size={14} />Stop &amp; transcribe</button><button type="button" onClick={cancelVoice}>Cancel recording</button></> : <button type="button" disabled={voiceState === "transcribing"} onClick={startVoice}><Mic size={14} />{voiceState === "transcribing" ? "Transcribing…" : "Start dictation"}</button>}</div>
          {voiceError && <p className="hybridVoiceError" role="alert">{voiceError}</p>}
          {(voiceState === "recording" || voiceState === "transcribing" || Boolean(voiceText) || Boolean(voiceError)) && <label>{voiceState === "recording" ? voiceMode === "live" ? "Live transcript — review before using" : "Audio recording — live captions unavailable" : "Transcript — review or correct before using"}<textarea value={voiceText} maxLength={4000} rows={4} onChange={(event) => { setVoiceText(event.target.value); liveTranscriptRef.current = event.target.value; }} placeholder={voiceState === "recording" && voiceMode === "live" ? "Listening… recognized words will appear here as you speak." : voiceState === "recording" ? "Recording audio. Transcription will appear when you stop." : voiceState === "transcribing" ? "Transcribing recording…" : "No transcript was returned. Type or paste your instruction here."} /></label>}
          <small className="hybridVoicePrivacy">Live captions use browser speech recognition when available. When you stop, the recording is sent as a size-limited JSON request to the authenticated Notes AI service for transcription. Voice is optional; typing always works.</small>
          {voiceText.trim() && <><div className="hybridVoicePromptPreview"><strong>AI REQUEST PREVIEW</strong><span>Content type: {actions.find((item) => item.value === action)?.label} · Note section: {activeSection?.title || "Untitled section"}</span><p>Instruction: Turn the user-approved voice transcription into content for the current note section. Preserve its requested details, follow the selected content type, and return only the section content.</p><p>Transcript sent to AI: “{voiceText.trim()}”</p><small>The request also includes the note title, category, topic, difficulty, and programming language. Nothing is sent until you choose an action.</small></div><div className="hybridVoiceActions"><button type="button" onClick={insertTranscription}>Insert transcription</button><button type="button" disabled={aiBusy} onClick={transformTranscription}><Sparkles size={13} /> Create notes with AI</button></div></>}
        </div>
      </aside>
    </div> : <div className="hybridReview">
      <header><div><span>REVIEW BEFORE SAVING</span><h2>{metadata.title || "Untitled study note"}</h2><p>{metadata.subject}{metadata.topic ? ` · ${metadata.topic}` : ""}{metadata.subtopic ? ` · ${metadata.subtopic}` : ""} · {metadata.difficulty}</p>{tags.length > 0 && <div className="hybridReviewTags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}{metadata.source && <small>Source: {metadata.source}</small>}</div><button type="button" className="notesSecondary" onClick={() => setStage("edit")}><ArrowLeft size={14} /> Back to edit</button></header>
      <article className="hybridReviewPaper"><h1>{metadata.title || "Untitled study note"}</h1><div className="hybridReviewMeta">{metadata.subject} · {metadata.difficulty}{metadata.topic && ` · ${metadata.topic}`}</div><MarkdownPreview content={content} onCopyError={setError} onCopySuccess={() => setNotice("Code copied")} />{sections.map((section) => <button type="button" className="hybridEditSectionLink" key={section.id} onClick={() => editSection(section)}>Edit {section.title || "untitled section"}</button>)}</article>
    </div>}

    {error && <div className="hybridMessage error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div>}
    {notice && <div className="hybridMessage success" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={14} /></button></div>}
    <footer className="hybridFooter"><span>{content.length.toLocaleString()} / {MAX_NOTE_CHARS.toLocaleString()} characters {savedNote?.status === "draft" && <em>· Draft</em>}</span><div><button type="button" className="notesSecondary" onClick={leaveBuilder}><X size={14} /> Cancel</button><button type="button" className="notesSecondary" disabled={saving} onClick={() => void save("draft")}><Save size={14} />{saving ? "Saving…" : "Save draft"}</button>{stage === "edit" ? <button type="button" className="notesPrimary" onClick={() => setStage("review")}>Review note <ArrowUp size={14} /></button> : <button type="button" className="notesPrimary" disabled={saving || !metadata.title.trim() || !content.trim()} onClick={() => void save("published")}><Check size={14} />{saving ? "Saving…" : "Publish / Save note"}</button>}</div></footer>
  </section>;
}
