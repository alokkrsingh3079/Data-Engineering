import crypto from "node:crypto";
import { z } from "zod";

export type RunnerLanguage = "python" | "pyspark";

const runnerResultSchema = z.object({
  status: z.enum(["passed", "failed", "timeout", "error", "resource_limit_exceeded", "cancelled"]),
  executionMs: z.number().int().min(0).max(120_000),
  tests: z.array(z.object({
    name: z.string().min(1).max(120),
    passed: z.boolean(),
    status: z.string().max(40).optional(),
    executionMs: z.number().int().min(0).optional(),
    message: z.string().max(500).optional()
  }).strict()).max(100),
  message: z.string().max(500).nullable().optional(),
  output: z.object({
    columns: z.array(z.string().max(128)).max(100).optional(),
    schema: z.array(z.object({ name: z.string().max(128), type: z.string().max(80) }).strict()).max(100).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
    console: z.string().max(16_000).optional()
  }).strict().optional()
}).strict();

function runnerConfig(language: RunnerLanguage) {
  const prefix = language === "python" ? "PYTHON_RUNNER" : "SPARK_RUNNER";
  const rawUrl = process.env[`${prefix}_URL`];
  const token = process.env[`${prefix}_TOKEN`];
  if (!rawUrl || !token) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || (process.env.NODE_ENV !== "production" && url.hostname === "spark_runner");
  const privateSparkHttp = language === "pyspark" && process.env.SPARK_RUNNER_ALLOW_PRIVATE_HTTP === "true" && url.hostname === "spark_runner" && url.protocol === "http:";
  const privatePythonHttp = language === "python" && process.env.PYTHON_RUNNER_ALLOW_PRIVATE_HTTP === "true" && url.hostname === "python_runner" && url.protocol === "http:";
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && url.protocol === "http:") && !privateSparkHttp && !privatePythonHttp) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  url.pathname = url.pathname.replace(/\/$/, "");
  return { url, token };
}

export function isRunnerConfigured(language: RunnerLanguage): boolean {
  return runnerConfig(language) !== null;
}

export function runnerTokenFingerprints(): { language: RunnerLanguage; host: string; fingerprint: string }[] {
  return (["python", "pyspark"] as const).flatMap((language) => {
    const config = runnerConfig(language);
    return config ? [{
      language,
      host: config.url.host,
      fingerprint: crypto.createHash("sha256").update(config.token).digest("hex").slice(0, 16)
    }] : [];
  });
}

export async function runnerHealth(language: RunnerLanguage): Promise<{ configured: boolean; available: boolean; diagnostic?: string }> {
  const config = runnerConfig(language);
  if (!config) return { configured: false, available: false, diagnostic: "Runner URL or token is missing or invalid." };
  let diagnostic = "Runner request failed.";
  try {
    const response = await fetch(new URL("/health", config.url), {
      redirect: "error",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      diagnostic = `Runner at ${config.url.host} health check returned HTTP ${response.status}.`;
    } else {
      const authResponse = await fetch(new URL("/v1/auth-check", config.url), {
        headers: { Authorization: `Bearer ${config.token}` },
        redirect: "error",
        signal: AbortSignal.timeout(10_000)
      });
      if (authResponse.ok) return { configured: true, available: true };
      diagnostic = authResponse.status === 401
        ? `Runner at ${config.url.host} rejected the configured token (HTTP 401).`
        : `Runner at ${config.url.host} authenticated health check returned HTTP ${authResponse.status}.`;
    }
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : undefined;
    const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" && /^[A-Z0-9_]{1,40}$/.test(cause.code)
      ? cause.code
      : undefined;
    diagnostic = error instanceof Error && error.name === "TimeoutError"
      ? `Runner at ${config.url.host} health request timed out.`
      : code
        ? `Runner at ${config.url.host} network request failed (${code}).`
        : `Runner at ${config.url.host} network request failed.`;
  }
  console.warn(JSON.stringify({
    event: "runner_health_check_failed",
    language,
    host: config.url.host,
    diagnostic
  }));
  return { configured: true, available: false, diagnostic };
}

export type RunnerTestCase = { name: string; input: unknown; expected: unknown };

export async function executeOnRunner(input: {
  language: RunnerLanguage;
  taskId: string;
  functionName?: string;
  code: string;
  testCases: RunnerTestCase[];
}) {
  const config = runnerConfig(input.language);
  if (!config) return { status: "unavailable" as const };
  if (Buffer.byteLength(input.code, "utf8") > 32_000) return { status: "invalid" as const, message: "Code exceeds the 32 KB limit." };
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.taskId) || input.testCases.length < 1 || input.testCases.length > 100) {
    return { status: "invalid" as const, message: "Invalid runner task." };
  }
  try {
    const response = await fetch(new URL("/v1/execute", config.url), {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: input.taskId, functionName: input.functionName || input.taskId.replace(/-/g, "_"), language: input.language, code: input.code, testCases: input.testCases }),
      signal: AbortSignal.timeout(input.language === "pyspark" ? 150_000 : 15_000)
    });
    const text = await response.text();
    if (!response.ok) return {
      status: "error" as const,
      message: response.status === 401
        ? "Execution service rejected the configured bearer token (HTTP 401). Verify the backend token matches the runner's active token."
        : `Execution service returned HTTP ${response.status}.`
    };
    if (Buffer.byteLength(text, "utf8") > 512_000) return { status: "error" as const, message: "Execution service returned an invalid response." };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { status: "error" as const, message: "Execution service returned invalid data." };
    }
    const parsed = runnerResultSchema.safeParse(json);
    if (!parsed.success || parsed.data.tests.length !== input.testCases.length) return { status: "error" as const, message: "Execution service response did not match the task contract." };
    const passed = parsed.data.status === "passed" && parsed.data.tests.every((testCase) => testCase.passed);
    return {
      status: parsed.data.status,
      correct: passed,
      executionMs: parsed.data.executionMs,
      tests: parsed.data.tests,
      message: parsed.data.message,
      output: parsed.data.output
    };
  } catch (error) {
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : undefined;
    const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string" && /^[A-Z0-9_]{1,40}$/.test(cause.code)
      ? cause.code
      : undefined;
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Execution service request timed out."
      : code
        ? `Execution service network request failed (${code}).`
        : "Execution service is unavailable.";
    return { status: "unavailable" as const, message };
  }
}

const sparkJobState = z.enum(["queued", "running", "succeeded", "failed", "timed_out", "cancelled", "resource_limit_exceeded"]);
const sparkJobResult = z.object({
  status: z.enum(["passed", "failed", "timeout", "error", "resource_limit_exceeded", "cancelled"]),
  executionMs: z.number().int().min(0).max(120_000),
  tests: z.array(z.object({ name: z.string().min(1).max(120), passed: z.boolean(), status: z.string().max(40).optional(), executionMs: z.number().int().min(0).optional(), message: z.string().max(500).optional() }).strict()).max(3),
  output: z.object({ columns: z.array(z.string()).optional(), schema: z.array(z.object({ name: z.string(), type: z.string() }).strict()).optional(), rows: z.array(z.record(z.string(), z.unknown())).max(500).optional(), console: z.string().max(16_000).optional() }).strict().optional(),
  message: z.string().max(500).nullable().optional()
}).strict();

export async function createSparkJob(input: { taskId: string; functionName: string; code: string; testCases: RunnerTestCase[]; returnOutput: boolean }) {
  const config = runnerConfig("pyspark");
  if (!config) return { status: "unavailable" as const };
  if (Buffer.byteLength(input.code, "utf8") > 32_000 || input.testCases.length < 1 || input.testCases.length > 3 || !/^[a-zA-Z_][a-zA-Z0-9_]{0,100}$/.test(input.functionName)) return { status: "invalid" as const };
  try {
    const response = await fetch(new URL("/v1/jobs", config.url), {
      method: "POST",
      redirect: "error",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ language: "pyspark", taskId: input.taskId, functionName: input.functionName, code: input.code, testCases: input.testCases, returnOutput: input.returnOutput }),
      signal: AbortSignal.timeout(8_000)
    });
    if (response.status === 429) return { status: "capacity" as const };
    const payload: unknown = await response.json();
    if (!response.ok) return { status: "error" as const };
    const parsed = z.object({ jobId: z.string().uuid(), status: z.literal("queued"), createdAt: z.string() }).strict().safeParse(payload);
    return parsed.success ? { status: "ok" as const, job: parsed.data } : { status: "error" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}

export async function getSparkJob(jobId: string) {
  const config = runnerConfig("pyspark");
  if (!config) return { status: "unavailable" as const };
  try {
    const response = await fetch(new URL(`/v1/jobs/${encodeURIComponent(jobId)}`, config.url), {
      headers: { Authorization: `Bearer ${config.token}` }, redirect: "error", signal: AbortSignal.timeout(5_000)
    });
    if (response.status === 404) return { status: "not_found" as const };
    const payload: unknown = await response.json();
    const parsed = z.object({ jobId: z.string().uuid(), status: sparkJobState, createdAt: z.string(), startedAt: z.string().nullable().optional(), finishedAt: z.string().nullable().optional(), result: sparkJobResult.nullable() }).strict().safeParse(payload);
    return response.ok && parsed.success ? { status: "ok" as const, job: parsed.data } : { status: "error" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}

export async function cancelSparkJob(jobId: string) {
  const config = runnerConfig("pyspark");
  if (!config) return { status: "unavailable" as const };
  try {
    const response = await fetch(new URL(`/v1/jobs/${encodeURIComponent(jobId)}`, config.url), {
      method: "DELETE", headers: { Authorization: `Bearer ${config.token}` }, redirect: "error", signal: AbortSignal.timeout(5_000)
    });
    if (response.status === 404) return { status: "not_found" as const };
    if (response.status === 409) return { status: "complete" as const };
    if (!response.ok) return { status: "error" as const };
    return { status: "cancelled" as const };
  } catch {
    return { status: "unavailable" as const };
  }
}