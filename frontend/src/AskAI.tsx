import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { Activity, ArrowUp, BarChart3, BookOpen, Code2, Database, ImagePlus, Layers3, LogOut, MessageSquare, Plus, Sparkles, Target, Trash2, X } from "lucide-react";
import "./studio-sidebar.css";
import "./ask-ai.css";

type Attachment = { id: string; name: string; mimeType: string; url: string };
type Message = { id: string; role: "user" | "assistant"; content: string; attachments: Attachment[] };
type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
type DraftImage = { id: string; name: string; mimeType: string; dataUrl: string };
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const maxImageBytes = 5 * 1024 * 1024;

const prompts = [
  "Explain how a Spark shuffle works and when it becomes expensive.",
  "Review this SQL query for correctness and performance.",
  "Show a safe, idempotent pattern for incremental ETL loads.",
  "Help me debug a Python transformation that drops duplicate events.",
];

export default function AskAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [input, setInput] = useState("");
  const [userName, setUserName] = useState("Learner");
  const [model, setModel] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const threadEnd = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/ai/status", { signal: controller.signal }),
      fetch("/api/auth/me", { credentials: "include", signal: controller.signal }),
      fetch("/api/ai/conversations", { credentials: "include", signal: controller.signal }),
    ]).then(async ([statusResponse, accountResponse, historyResponse]) => {
      if (accountResponse.status === 401) {
        location.href = "/login";
        return;
      }
      const [status, account, history] = await Promise.all([
        statusResponse.ok ? statusResponse.json() : null,
        accountResponse.ok ? accountResponse.json() : null,
        historyResponse.ok ? historyResponse.json() : [],
      ]);
      setAiConfigured(Boolean(status?.configured));
      setModel(status?.model || "");
      setUserName(account?.user?.name || "Learner");
      setConversations(history);
      if (history.length) {
        const latest = history[0] as Conversation;
        setConversationId(latest.id);
        const threadResponse = await fetch(`/api/ai/conversations/${latest.id}`, { credentials: "include", signal: controller.signal });
        if (threadResponse.ok) setMessages((await threadResponse.json()).messages || []);
      }
    }).catch((cause) => {
      if (cause.name !== "AbortError") setError("Could not connect to the assistant.");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function sendMessage(text = input) {
    const content = text.trim();
    if ((!content && !draftImages.length) || busy || !aiConfigured) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId || undefined, content, attachments: draftImages.map(({ name, mimeType, dataUrl }) => ({ name, mimeType, dataUrl })) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || `Assistant request failed (${response.status}).`);
      if (!result?.userMessage || !result?.assistantMessage || !result?.conversation?.id) throw new Error("The assistant returned an invalid response.");
      setConversationId(result.conversation.id);
      setMessages((current) => [...current, result.userMessage, result.assistantMessage]);
      setConversations((current) => [result.conversation, ...current.filter((item) => item.id !== result.conversation.id)].slice(0, 50));
      setInput("");
      setDraftImages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The assistant is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function selectConversation(id: string) {
    if (busy) return;
    setError("");
    try {
      const response = await fetch(`/api/ai/conversations/${id}`, { credentials: "include" });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not load this conversation.");
      setConversationId(result.id);
      setMessages(result.messages || []);
      setDraftImages([]);
      setInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this conversation.");
    }
  }

  function startNewChat() {
    if (busy) return;
    setConversationId("");
    setMessages([]);
    setDraftImages([]);
    setInput("");
    setError("");
  }

  async function deleteConversation(id: string) {
    if (busy) return;
    const response = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      setError("Could not delete this conversation.");
      return;
    }
    setConversations((current) => current.filter((item) => item.id !== id));
    if (conversationId === id) startNewChat();
  }

  async function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (draftImages.length + files.length > 4) {
      setError("Attach up to four images to one message.");
      return;
    }
    if (files.some((file) => !imageTypes.has(file.type))) {
      setError("Use PNG, JPEG, WebP, or GIF images.");
      return;
    }
    if (files.some((file) => file.size <= 0 || file.size > maxImageBytes) || files.reduce((sum, file) => sum + file.size, 0) + draftImages.reduce((sum, image) => sum + Math.ceil(image.dataUrl.length * 0.75), 0) > maxImageBytes) {
      setError("Images must total 5 MB or less.");
      return;
    }
    try {
      const loaded = await Promise.all(files.map((file) => new Promise<DraftImage>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, dataUrl: reader.result }) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      })));
      setDraftImages((current) => [...current, ...loaded]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read image.");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    location.href = "/login";
  }

  return <div className="studioShell askAiShell">
    <aside className="studioSidebar">
      <a className="studioBrand" href="/" aria-label="Data Engineering Studio home">
        <span className="studioBrandMark"><Layers3 size={18} /></span>
        <span><strong>Data Engineering</strong><small>PRACTICE PLATFORM</small></span>
      </a>
      <nav className="studioActions" aria-label="Main navigation">
        <a href="/"><BarChart3 size={15} /> Dashboard</a>
        <a href="/sql"><Database size={15} /> SQL lab</a>
        <a href="/learn/python-etl"><Code2 size={15} /> Python lab</a>
        <a href="/pyspark"><Layers3 size={15} /> PySpark lab</a>
        <a href="/learn/azure-data-factory"><Activity size={15} /> Azure &amp; Databricks</a>
        <a href="/learn/etl-data-quality"><Target size={15} /> ETL testing</a>
        <a href="/interview"><BookOpen size={15} /> Interview</a>
        <a className="studioNavActive" href="/ask-ai"><Sparkles size={15} /> Ask AI</a>
        <a href="/analytics"><BarChart3 size={15} /> Progress &amp; Analytics</a>
      </nav>
      <button className="studioSidebarAccount" onClick={() => void signOut()} title="Sign out">
        <span>{userName.slice(0, 1).toUpperCase()}</span>
        <span><strong>{userName}</strong><small>LEARNER ACCOUNT</small></span>
        <LogOut size={15} />
      </button>
    </aside>

    <main className="studioPage askAiPage">
      <header className="askAiHeader">
        <div><span><Sparkles size={16} /> DATA ENGINEERING ASSISTANT</span><h1>Ask AI</h1></div>
        <div className={`askAiStatus ${aiConfigured ? "ready" : aiConfigured === false ? "offline" : "checking"}`}>
          <i />{aiConfigured ? model || "AI ready" : aiConfigured === false ? "AI unavailable" : "Checking AI"}
        </div>
      </header>
      <div className="askAiWorkspace">
        <aside className="askAiHistory" aria-label="Chat history">
          <div className="askAiHistoryHead"><strong>HISTORY</strong><button type="button" onClick={startNewChat} disabled={busy} title="Start a new chat" aria-label="Start a new chat"><Plus size={16} /></button></div>
          <div className="askAiHistoryList">
            {conversations.map((conversation) => <div className={`askAiHistoryItem ${conversationId === conversation.id ? "selected" : ""}`} key={conversation.id}>
              <button type="button" onClick={() => void selectConversation(conversation.id)} disabled={busy} title={conversation.title}><MessageSquare size={14} /><span>{conversation.title}</span></button>
              <button type="button" className="askAiDelete" onClick={() => void deleteConversation(conversation.id)} disabled={busy} aria-label={`Delete ${conversation.title}`} title="Delete conversation"><Trash2 size={13} /></button>
            </div>)}
            {!conversations.length && <p className="askAiHistoryEmpty">Your conversations will appear here.</p>}
          </div>
        </aside>
        <div className="askAiChat">
          <section className={`askAiThread ${messages.length ? "hasMessages" : "emptyThread"}`} aria-live="polite" aria-label="Conversation">
            {!messages.length ? <div className="askAiWelcome">
              <div className="askAiWelcomeMark"><Sparkles size={22} /></div>
              <h2>What are you working through?</h2>
              <p>Ask a question or share one or more images to get started.</p>
              <div className="askAiPrompts">{prompts.map((prompt) => <button key={prompt} type="button" disabled={!aiConfigured || busy} onClick={() => void sendMessage(prompt)}>{prompt}<ArrowUp size={14} /></button>)}</div>
            </div> : <div className="askAiMessages">
              {messages.map((message) => <article className={`askAiMessage ${message.role}`} key={message.id}>
                <span className="askAiAvatar">{message.role === "assistant" ? <Sparkles size={15} /> : userName.slice(0, 1).toUpperCase()}</span>
                <div><small>{message.role === "assistant" ? "ASSISTANT" : "YOU"}</small>{message.content && <p>{message.content}</p>}
                  {message.attachments?.length ? <div className="askAiAttachedImages">{message.attachments.map((attachment) => <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer"><img src={attachment.url} alt={attachment.name} loading="lazy" /></a>)}</div> : null}
                </div>
              </article>)}
              {busy && <article className="askAiMessage assistant"><span className="askAiAvatar"><Sparkles size={15} /></span><div><small>ASSISTANT</small><p className="askAiThinking"><i /><i /><i /></p></div></article>}
            </div>}
            <div ref={threadEnd} />
          </section>
          <div className="askAiComposeWrap">
            {error && <div className="askAiError" role="alert">{error}</div>}
            {aiConfigured === false && <div className="askAiUnavailable" role="status">AI is not configured on the server. Add an OpenAI API key to the backend environment.</div>}
            {draftImages.length > 0 && <div className="askAiDraftImages">{draftImages.map((image) => <div key={image.id}><img src={image.dataUrl} alt={image.name} /><span title={image.name}>{image.name}</span><button type="button" onClick={() => setDraftImages((current) => current.filter((item) => item.id !== image.id))} aria-label={`Remove ${image.name}`} title="Remove image"><X size={13} /></button></div>)}</div>}
            <form className="askAiComposer" onSubmit={submit}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} maxLength={4000} rows={2} placeholder="Ask a question or paste code…" aria-label="Message to AI" disabled={!aiConfigured || busy} />
              <div>
                <input ref={imageInput} className="askAiFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={(event) => void addImages(event)} aria-label="Attach images" />
                <button className="askAiAttachButton" type="button" onClick={() => imageInput.current?.click()} disabled={!aiConfigured || busy || draftImages.length >= 4} aria-label="Attach images" title="Attach up to four images"><ImagePlus size={17} /></button>
                <span>{input.length.toLocaleString()} / 4,000 · {draftImages.length} / 4 images</span>
                <button type="submit" aria-label="Send message" title="Send message" disabled={(!input.trim() && !draftImages.length) || busy || !aiConfigured}>{busy ? <span className="askAiSpinner" /> : <ArrowUp size={17} />}</button>
              </div>
            </form>
            <p className="askAiFootnote">AI responses can be inaccurate. Verify important technical details.</p>
          </div>
        </div>
      </div>
    </main>
  </div>;
}