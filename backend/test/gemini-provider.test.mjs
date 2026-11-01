import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMENI_API_KEY = 'test-gemini-key';
const { aiConfigured, model, generateSqlLearningLesson, generateSqlLearningTest, streamHybridNoteSection, hybridNoteAssistRequest } = await import('../src/ai.ts');

test('AI is configured through the existing GEMENI_API_KEY setting and uses Gemini by default', () => {
  assert.equal(aiConfigured, true);
  assert.equal(model, 'gemini-2.5-flash');
});

test('SQL Learning generation calls Gemini with a JSON response schema', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;
  let requestHeaders;
  globalThis.fetch = async (url, options) => {
    requestUrl = new URL(url);
    requestBody = JSON.parse(options.body);
    requestHeaders = options.headers;
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"overview":"Lesson overview"}' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await generateSqlLearningLesson({
      topic: 'SELECT',
      module: 'SQL Fundamentals',
      schema: '{"columns":[{"name":"salary","data_type":"text"}]}',
      validationFeedback: ['Example "Average salary" failed. PostgreSQL error: function avg(text) does not exist']
    });
    assert.equal(result.overview, 'Lesson overview');
    assert.equal(requestUrl.hostname, 'generativelanguage.googleapis.com');
    assert.equal(requestUrl.pathname, `/v1beta/models/${model}:generateContent`);
    assert.equal(requestUrl.search, '');
    assert.equal(requestHeaders['x-goog-api-key'], 'test-gemini-key');
    assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
    assert.equal(requestBody.generationConfig.responseSchema.type, 'OBJECT');
    assert.match(requestBody.contents[0].parts[0].text, /AVG and SUM only with columns whose supplied schema type is numeric/);
    assert.match(requestBody.contents[0].parts[0].text, /function avg\(text\) does not exist/);
    assert.deepEqual(requestBody.generationConfig.responseSchema.propertyOrdering, [
      'overview', 'theory', 'syntax', 'parameters', 'returnType', 'rules',
      'commonMistakes', 'useCases', 'interviewRelevance', 'dialectNotes', 'examples'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini streaming note assistance forwards text deltas', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestHeaders;
  globalThis.fetch = async (url, options) => {
    requestUrl = new URL(url);
    requestHeaders = options.headers;
    return new Response(
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Generated section' }] } }] })}`,
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    );
  };
  const deltas = [];

  try {
    const input = hybridNoteAssistRequest.parse({
      action: 'improve',
      subject: 'SQL',
      difficulty: 'beginner',
      selectedText: 'A table stores data.'
    });
    await streamHybridNoteSection(input, (delta) => deltas.push(delta), new AbortController().signal);
    assert.deepEqual(deltas, ['Generated section']);
    assert.equal(requestUrl.searchParams.has('key'), false);
    assert.equal(requestHeaders['x-goog-api-key'], 'test-gemini-key');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Gemini provider errors preserve actionable quota status', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' }
  }), { status: 429, headers: { 'Content-Type': 'application/json' } });

  try {
    await assert.rejects(
      generateSqlLearningLesson({ topic: 'SELECT', module: 'SQL Fundamentals', schema: '{}' }),
      /Gemini API returned HTTP 429: Resource exhausted/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SQL Learning test generation warns against unsafe casts of formatted numeric text', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"questions":[]}' }] } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await generateSqlLearningTest({
      topic: 'Numeric conversion',
      module: 'SQL Fundamentals',
      schema: '{"column_name":"amount","data_type":"text"}',
      testNumber: 1,
      topicScope: { targetTopic: "SELECT", prerequisiteTopics: [] },
      validationFeedback: ['SQL: SELECT amount::numeric. PostgreSQL error (22P02): invalid input syntax for type numeric; query attempted to cast unvalidated text']
    });
    const prompt = requestBody.contents[0].parts[0].text;
    assert.match(prompt, /Treat text-typed columns as text/);
    assert.match(prompt, /CASE and a strict numeric regular expression before casting/);
    assert.match(prompt, /Current target topic: "SELECT"/);
    assert.match(prompt, /Previously introduced topics: None/);
    assert.match(prompt, /Use basic SELECT\/FROM syntax only as needed to make an executable read-only query/);
    assert.match(prompt, /Do not use any other SQL concept, operator, clause, function, or technique that belongs to a later or unlisted topic/);
    assert.match(prompt, /invalid input syntax for type numeric/);
    assert.equal(requestBody.generationConfig.responseSchema.properties.questions.minItems, 15);
    assert.equal(requestBody.generationConfig.responseSchema.properties.questions.maxItems, 15);
    assert.equal(requestBody.generationConfig.maxOutputTokens, 16000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
