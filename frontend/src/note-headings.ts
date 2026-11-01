export function noteHeadings(content: string) {
  const headings: { title: string; level: number; id: string }[] = [];
  let fenceMarker = "";
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const fence = /^(`{3,}|~{3,})/.exec(trimmed);
    if (fence) {
      if (!fenceMarker) fenceMarker = fence[1][0];
      else if (fence[1][0] === fenceMarker) fenceMarker = "";
      continue;
    }
    if (fenceMarker) continue;
    const match = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (!match) continue;
    const title = match[2].trim();
    headings.push({
      title,
      level: match[1].length,
      id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    });
  }

  const firstHeading = headings[0];
  const hasDocumentTitle = firstHeading && (
    firstHeading.title.toLowerCase() === "notes"
    || headings.slice(1).some((heading) => heading.level > firstHeading.level)
  );
  const candidates = headings
    .slice(hasDocumentTitle ? 1 : 0)
    .filter(({ title }) => !/^\d+[.)]\s/.test(title));
  const sections = candidates.filter((heading) => heading.level === 2);
  const outline = sections.length
    ? sections
    : candidates.filter((heading) => heading.level === Math.min(...candidates.map(({ level }) => level)));
  return outline.map(({ title, id }) => ({ title, id }));
}
