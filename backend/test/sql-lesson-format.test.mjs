import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import SqlLessonRichText, { lessonSyntaxText } from '../../frontend/src/SqlLessonRichText.tsx';

const frontendRequire = createRequire(new URL('../../frontend/package.json', import.meta.url));
const React = frontendRequire('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server');

test('SQL Learning rich text renders paragraphs and inline Markdown instead of raw syntax markers', () => {
  const html = renderToStaticMarkup(React.createElement(SqlLessonRichText, {
    content: 'First paragraph with **important text** and `SELECT`.\n\nSecond paragraph uses &gt; safely.'
  }));

  assert.match(html, /<p>First paragraph with <strong>important text<\/strong> and <code>SELECT<\/code>\.<\/p>/);
  assert.match(html, /<p>Second paragraph uses &gt; safely\.<\/p>/);
  assert.doesNotMatch(html, /\*\*important text\*\*/);
  assert.doesNotMatch(html, /&amp;gt;/);
});

test('SQL Learning rich text renders lists and code fences as semantic blocks', () => {
  const html = renderToStaticMarkup(React.createElement(SqlLessonRichText, {
    content: '## Key points\n\n- Use `WHERE` to filter rows.\n- Avoid **SELECT ALL** when unnecessary.\n\n```sql\nSELECT 1;\n```'
  }));

  assert.match(html, /<h4>Key points<\/h4>/);
  assert.match(html, /<ul><li>Use <code>WHERE<\/code> to filter rows\.<\/li>/);
  assert.match(html, /<strong>SELECT ALL<\/strong>/);
  assert.match(html, /<pre data-language="sql"><code>SELECT 1;<\/code><\/pre>/);
});

test('SQL Learning syntax removes Markdown fences and decodes escaped operators', () => {
  assert.equal(lessonSyntaxText('```sql\nSELECT value\nFROM source\nWHERE score &gt; 10\n```'), 'SELECT value\nFROM source\nWHERE score > 10');
});
