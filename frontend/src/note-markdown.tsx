import type { ReactNode } from "react";

const noteColors: Record<string, string> = {
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

const inlineToken = /(!\[([^\]]*)\]\((data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})\)|\[color=(red|orange|amber|yellow|lime|green|teal|cyan|blue|indigo|violet|purple|pink)\]([\s\S]*?)\[\/color\]|\[Source: page (\d+)\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function renderInlineNoteMarkdown(
  value: string,
  citationHref?: (page: string) => string | undefined,
  depth = 0,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(inlineToken.source, "g");

  while ((match = pattern.exec(value))) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));
    const token = match[0];
    if (match[2] !== undefined && match[3]) {
      nodes.push(<img key={`image-${match.index}`} src={match[3]} alt={match[2]} loading="lazy" />);
    } else if (match[4] && match[5] !== undefined) {
      nodes.push(<span key={`color-${match.index}`} style={{ color: noteColors[match[4]] }}>{depth < 8 ? renderInlineNoteMarkdown(match[5], citationHref, depth + 1) : match[5]}</span>);
    } else if (match[6]) {
      const href = citationHref?.(match[6]);
      nodes.push(href ? <a key={`citation-${match.index}`} className="sourceCitation" href={href} target="_blank" rel="noreferrer">Source page {match[6]}</a> : token);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`code-${match.index}`}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`em-${match.index}`}>{token.slice(1, -1)}</em>);
    }
    cursor = pattern.lastIndex;
  }

  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}
