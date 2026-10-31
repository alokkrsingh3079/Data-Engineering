export function noteHeadings(content: string) {
  const headings = content.split("\n").flatMap((line) => {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    return match ? [{
      title: match[2],
      level: match[1].length,
      id: match[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }] : [];
  });
  const sections = headings.filter((heading) => heading.level === 2);
  return (sections.length ? sections : headings).map(({ title, id }) => ({ title, id }));
}
