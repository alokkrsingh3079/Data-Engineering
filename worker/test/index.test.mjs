import assert from "node:assert/strict";
import test from "node:test";
import worker from "../index.js";

const env = { API_ORIGIN: "https://api.example.com" };

test("retries transient gateway responses for idempotent job submissions", async (t) => {
  const bodies = [];
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (request) => {
    calls += 1;
    bodies.push(await request.text());
    if (calls === 1) return new Response("<html>upstream unavailable</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" }
    });
    return Response.json({ jobId: "job-1" }, { status: 202 });
  });

  const request = new Request("https://app.example.com/api/learning/questions/example/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" },
    body: JSON.stringify({ code: "select()", mode: "run" })
  });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { jobId: "job-1" });
  assert.equal(calls, 2);
  assert.equal(bodies[0], bodies[1]);
});

test("does not retry non-idempotent POST requests and normalizes HTML gateway errors", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response("<html>upstream unavailable</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" }
    });
  });

  const request = new Request("https://app.example.com/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "note" })
  });
  const response = await worker.fetch(request, env);

  assert.equal(response.status, 502);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), {
    error: "The API is temporarily unavailable. Please try again shortly."
  });
  assert.equal(calls, 1);
});

test("returns a JSON gateway error after safe-request retries fail", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    throw new Error("upstream connection failed");
  });

  const response = await worker.fetch(
    new Request("https://app.example.com/api/health"),
    env
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "The API is temporarily unavailable. Please try again shortly."
  });
  assert.equal(calls, 5);
});
