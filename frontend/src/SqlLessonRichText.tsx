import React, { createElement, type ReactNode } from "react";
import { renderInlineNoteMarkdown } from "./note-markdown";

type LessonBlock =
  | { type: "heading"; level: number; text: string; key: number }
  | { type: "paragraph"; text: string; key: number }
  | { type: "list"; ordered: boolean; items: string[]; key: number }
  | { type: "quote"; lines: string[]; key: number }
  | { type: "code"; language: string; text: string; key: number }
  | { type: "table"; rows: string[][]; key: number };

function decodeLessonEntities(value: string) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39|#x[0-9a-f]+|#\d+);/gi, (entity) => {
    const named: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
      "&#39;": "'",
    };
    const normalized = entity.toLowerCase();
    if (named[normalized]) return named[normalized];
    const codePoint = normalized.startsWith("&#x")
      ? Number.parseInt(normalized.slice(3, -1), 16)
      : Number.parseInt(normalized.slice(2, -1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;
  });
}

export function lessonSyntaxText(value: string) {
  const decoded = decodeLessonEntities(value).trim();
  const fenced = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1\s*$/.exec(decoded);
  return fenced ? fenced[2] : decoded;
}

function lessonBlocks(markdown: string): LessonBlock[] {
  const lines = decodeLessonEntities(markdown).replace(/\r\n?/g, "\n").split("\n");
  const blocks: LessonBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index++;
      continue;
    }

    const fence = /^(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const code: string[] = [];
      index++;
      while (index < lines.length && !new RegExp(`^\\s*${marker}{3,}`).test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push({ type: "code", language: fence[2].trim(), text: code.join("\n"), key: index });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: Math.min(heading[1].length + 2, 6), text: heading[2], key: index++ });
      continue;
    }

    if (/^\|.*\|$/.test(line)) {
      const sourceRows: string[] = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) sourceRows.push(lines[index++]);
      const rows = sourceRows
        .filter((row) => !/^\s*\|?\s*:?-{2,}/.test(row))
        .map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
      blocks.push({ type: "table", rows, key: index });
      continue;
    }

    if (/^[-*+]\s/.test(line) || /^\d+[.)]\s/.test(line)) {
      const ordered = /^\d+[.)]\s/.test(line);
      const items: string[] = [];
      const pattern = ordered ? /^\d+[.)]\s/ : /^[-*+]\s/;
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(lines[index++].trim().replace(pattern, ""));
      }
      blocks.push({ type: "list", ordered, items, key: index });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].trim().replace(/^>\s?/, ""));
      blocks.push({ type: "quote", lines: quote, key: index });
      continue;
    }

    const paragraph = [line];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(?:#{1,6}\s+|[-*+]\s|\d+[.)]\s|>|\|.*\||`{3,}|~{3,})/.test(lines[index].trim())
    ) paragraph.push(lines[index++].trim());
    blocks.push({ type: "paragraph", text: paragraph.join(" "), key: index });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  return renderInlineNoteMarkdown(text);
}

export default function SqlLessonRichText({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className}>
      {lessonBlocks(content).map((block) => {
        if (block.type === "heading") {
          return createElement(`h${block.level}`, { key: block.key }, inline(block.text));
        }
        if (block.type === "paragraph") return <p key={block.key}>{inline(block.text)}</p>;
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return <Tag key={block.key}>{block.items.map((item, index) => <li key={index}>{inline(item)}</li>)}</Tag>;
        }
        if (block.type === "quote") {
          return <blockquote key={block.key}>{block.lines.map((line, index) => <p key={index}>{inline(line)}</p>)}</blockquote>;
        }
        if (block.type === "code") {
          return <pre key={block.key} data-language={block.language}><code>{block.text}</code></pre>;
        }
        const [header = [], ...body] = block.rows;
        return (
          <div className="sqlLessonTableWrap" key={block.key}>
            <table>
              <thead><tr>{header.map((cell, index) => <th key={index}>{inline(cell)}</th>)}</tr></thead>
              <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{header.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
