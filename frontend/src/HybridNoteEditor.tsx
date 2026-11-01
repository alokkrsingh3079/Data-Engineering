import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

const colors: Record<string, string> = {
  red: "#ef5350",
  orange: "#ff8a3d",
  amber: "#e8ae32",
  yellow: "#d9b52b",
  lime: "#8ebd35",
  green: "#37a66b",
  teal: "#20a69a",
  cyan: "#21a9c7",
  blue: "#3988e8",
  indigo: "#6969df",
  violet: "#905bd6",
  purple: "#ae58c6",
  pink: "#df5c9b",
};
export const hybridNoteColorNames = Object.keys(colors);

const imagePattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function inlineMarkdownToHtml(value: string) {
  const token = /(!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})\)|\[color=(red|orange|amber|yellow|lime|green|teal|cyan|blue|indigo|violet|purple|pink)\]([\s\S]*?)\[\/color\]|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let html = "";
  let cursor = 0;
  for (const match of value.matchAll(token)) {
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(cursor, index));
    if (match[2] !== undefined && imagePattern.test(match[3])) {
      html += `<img alt="${escapeHtml(match[2])}" src="${match[3]}">`;
    } else if (match[4] && colors[match[4]]) {
      html += `<span data-note-color="${match[4]}" style="color:${colors[match[4]]}">${inlineMarkdownToHtml(match[5])}</span>`;
    } else if (match[6] !== undefined) html += `<code>${escapeHtml(match[6])}</code>`;
    else if (match[7] !== undefined) html += `<strong>${inlineMarkdownToHtml(match[7])}</strong>`;
    else if (match[8] !== undefined) html += `<em>${inlineMarkdownToHtml(match[8])}</em>`;
    cursor = index + match[0].length;
  }
  return html + escapeHtml(value.slice(cursor));
}

export function markdownToEditorHtml(markdown: string) {
  const lines = markdown.split("\n");
  const blocks: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const fence = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !new RegExp(`^\\s*${fence[1][0]}{3,}`).test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(`<pre data-language="${escapeHtml(fence[2].trim())}"><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      index++;
      continue;
    }
    if (/^[-*]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      const ordered = /^\d+[.)]\s/.test(line);
      const items: string[] = [];
      while (index < lines.length && (ordered ? /^\d+[.)]\s/.test(lines[index].trim()) : /^[-*]\s/.test(lines[index].trim()))) {
        items.push(`<li>${inlineMarkdownToHtml(lines[index++].trim().replace(ordered ? /^\d+[.)]\s/ : /^[-*]\s/, ""))}</li>`);
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].trim().replace(/^>\s?/, ""));
      blocks.push(`<blockquote>${quote.map((part) => `<p>${inlineMarkdownToHtml(part)}</p>`).join("")}</blockquote>`);
      continue;
    }
    if (/^\|.*\|$/.test(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) tableLines.push(lines[index++]);
      const rows = tableLines.filter((row) => !/^\s*\|?\s*:?-{2,}/.test(row)).map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
      const [header = [], ...body] = rows;
      blocks.push(`<table><thead><tr>${header.map((cell) => `<th>${inlineMarkdownToHtml(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${header.map((_, cellIndex) => `<td>${inlineMarkdownToHtml(row[cellIndex] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+|^[-*]\s|^\d+[.)]\s|^>|^\|.*\|$|^`{3,}|^~{3,}/.test(lines[index].trim())) paragraph.push(lines[index++].trim());
    blocks.push(`<p>${inlineMarkdownToHtml(paragraph.join(" "))}</p>`);
  }
  return blocks.join("");
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (!(node instanceof HTMLElement)) return "";
  const children = Array.from(node.childNodes).map(nodeToMarkdown).join("");
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return `**${children}**`;
  if (tag === "em" || tag === "i") return `*${children}*`;
  if (tag === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") return `\`${children}\``;
  if (tag === "span") {
    const color = node.dataset.noteColor;
    return color && colors[color] ? `[color=${color}]${children}[/color]` : children;
  }
  if (tag === "img") {
    const src = node.getAttribute("src") || "";
    return imagePattern.test(src) ? `![${(node.getAttribute("alt") || "Note image").replace(/[\[\]\r\n]/g, "")}](${src})` : "";
  }
  if (/^h[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${children}\n\n`;
  if (tag === "pre") {
    const language = (node.dataset.language || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const code = node.querySelector("code")?.textContent || node.textContent || "";
    return `\`\`\`${language}\n${code.replace(/\n+$/, "")}\n\`\`\`\n\n`;
  }
  if (tag === "li") return children;
  if (tag === "ul" || tag === "ol") {
    const items = Array.from(node.children).filter((child) => child.tagName.toLowerCase() === "li");
    return `${items.map((item, index) => `${tag === "ol" ? `${index + 1}.` : "-"} ${nodeToMarkdown(item).trim()}`).join("\n")}\n\n`;
  }
  if (tag === "blockquote") return `${children.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
  if (tag === "table") {
    const rows = Array.from(node.querySelectorAll("tr")).map((row) => `| ${Array.from(row.children).map((cell) => nodeToMarkdown(cell).trim()).join(" | ")} |`);
    if (rows.length > 1) rows.splice(1, 0, `| ${Array.from(node.querySelector("tr")?.children || []).map(() => "---").join(" | ")} |`);
    return `${rows.join("\n")}\n\n`;
  }
  if (tag === "p" || tag === "div") return `${children.trim()}\n\n`;
  return children;
}

export function editorHtmlToMarkdown(html: string) {
  const document = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return Array.from(document.body.firstElementChild?.childNodes || [])
    .map(nodeToMarkdown)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type HybridNoteEditorHandle = {
  applyFormat: (format: string, value?: string) => void;
  insertMarkdown: (markdown: string, replaceSelection?: boolean) => void;
  getSelectedText: () => string;
  focus: () => void;
};

type Props = {
  sectionId: string;
  content: string;
  title: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  onSelectionChange?: (selectedText: string) => void;
};

const HybridNoteEditor = forwardRef<HybridNoteEditorHandle, Props>(function HybridNoteEditor(
  { sectionId, content, title, onChange, onFocus, onSelectionChange },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(content);
  const initialized = useRef(false);
  const savedRange = useRef<Range | null>(null);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (initialized.current && content === lastEmitted.current) return;
    editor.innerHTML = markdownToEditorHtml(content);
    lastEmitted.current = content;
    initialized.current = true;
  }, [content, sectionId]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) return;
    const markdown = editorHtmlToMarkdown(editor.innerHTML);
    lastEmitted.current = markdown;
    onChange(markdown);
  }

  function captureSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    savedRange.current = range.cloneRange();
    onSelectionChange?.(selection.toString());
  }

  function restoreSelection() {
    const editor = editorRef.current;
    if (!editor) return null;
    editor.focus();
    const selection = window.getSelection();
    const range = savedRange.current;
    if (selection && range && editor.contains(range.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(range);
      return range;
    }
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(end);
    savedRange.current = end.cloneRange();
    return end;
  }

  useImperativeHandle(ref, () => ({
    applyFormat(format, value) {
      const range = restoreSelection();
      if (!range) return;
      const selection = window.getSelection();
      if (format === "color") {
        const color = value || "blue";
        const editor = editorRef.current;
        if (!editor) return;
        if (range.collapsed) {
          const wrapper = document.createElement("span");
          wrapper.dataset.noteColor = color;
          wrapper.style.color = colors[color] || colors.blue;
          wrapper.textContent = "colored text";
          range.insertNode(wrapper);
          range.selectNodeContents(wrapper);
        } else {
          const startContainer = range.startContainer;
          const startOffset = range.startOffset;
          const endContainer = range.endContainer;
          const endOffset = range.endOffset;
          const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
          const textNodes: Text[] = [];
          while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            if (node.textContent && range.intersectsNode(node)) textNodes.push(node);
          }
          const wrappers: HTMLSpanElement[] = [];
          for (const node of textNodes.reverse()) {
            const start = node === startContainer ? startOffset : 0;
            const end = node === endContainer ? endOffset : node.length;
            if (start >= end) continue;
            let selectedNode = node;
            if (end < selectedNode.length) selectedNode.splitText(end);
            if (start > 0) selectedNode = selectedNode.splitText(start);
            const existingColor = selectedNode.parentElement?.closest("span[data-note-color]");
            if (existingColor instanceof HTMLSpanElement && editor.contains(existingColor)) {
              existingColor.dataset.noteColor = color;
              existingColor.style.color = colors[color] || colors.blue;
              wrappers.push(existingColor);
            } else {
              const wrapper = document.createElement("span");
              wrapper.dataset.noteColor = color;
              wrapper.style.color = colors[color] || colors.blue;
              selectedNode.parentNode?.insertBefore(wrapper, selectedNode);
              wrapper.appendChild(selectedNode);
              wrappers.push(wrapper);
            }
          }
          if (wrappers.length) {
            const ordered = wrappers.reverse();
            range.setStartBefore(ordered[0]);
            range.setEndAfter(ordered[ordered.length - 1]);
          }
        }
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else if (format === "table") {
        document.execCommand("insertHTML", false, "<table><tbody><tr><th>Column</th><th>Value</th></tr><tr><td>Example</td><td>Detail</td></tr></tbody></table><p><br></p>");
      } else if (format === "warning") {
        document.execCommand("insertHTML", false, "<blockquote><p><strong>WARNING:</strong> Check this carefully.</p></blockquote><p><br></p>");
      } else if (format === "code") {
        document.execCommand("formatBlock", false, "pre");
      } else if (format === "h1" || format === "h2" || format === "h3") {
        document.execCommand("formatBlock", false, format);
      } else if (format === "bold") document.execCommand("bold");
      else if (format === "italic") document.execCommand("italic");
      else if (format === "inlineCode") {
        const inline = document.createElement("code");
        const selected = selection?.toString() || "code";
        inline.textContent = selected;
        if (!range.collapsed) range.deleteContents();
        range.insertNode(inline);
        range.selectNodeContents(inline);
        selection?.removeAllRanges();
        selection?.addRange(range);
      } else if (format === "unorderedList") document.execCommand("insertUnorderedList");
      else if (format === "orderedList") document.execCommand("insertOrderedList");
      captureSelection();
      emitChange();
    },
    insertMarkdown(markdown, replaceSelection = false) {
      const range = restoreSelection();
      if (!range) return;
      const selection = window.getSelection();
      if (replaceSelection) range.deleteContents();
      else range.collapse(false);
      const fragment = document.createRange().createContextualFragment(markdownToEditorHtml(markdown));
      const lastNode = fragment.lastChild;
      range.insertNode(fragment);
      if (lastNode) range.setStartAfter(lastNode);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      savedRange.current = range.cloneRange();
      emitChange();
    },
    getSelectedText() {
      return savedRange.current?.toString() || "";
    },
    focus() {
      editorRef.current?.focus();
    },
  }), [onChange, onSelectionChange]);

  return <div
    ref={editorRef}
    className="hybridRichEditor"
    contentEditable
    suppressContentEditableWarning
    role="textbox"
    aria-label={`Content for ${title || "untitled section"}`}
    aria-multiline="true"
    data-placeholder="Write notes here. Select text and use the toolbar to format it; changes appear immediately."
    onFocus={onFocus}
    onMouseUp={captureSelection}
    onKeyUp={captureSelection}
    onInput={emitChange}
    onPaste={(event) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
      emitChange();
    }}
    onBlur={() => {
      const markdown = editorRef.current ? editorHtmlToMarkdown(editorRef.current.innerHTML) : "";
      lastEmitted.current = markdown;
      onChange(markdown);
    }}
  />;
});

export default HybridNoteEditor;
