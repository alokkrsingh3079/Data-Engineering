import { z } from "zod";

export type RunnerLanguage = "python" | "pyspark";

const runnerResultSchema = z.object({
  status: z.enum(["passed", "failed", "timeout", "error"]),
  executionMs: z.number().int().min(0).max(120_000),
  tests: z.array(z.object({ name: z.string().min(1).max(120), passed: z.boolean() }).strict()).max(100),
  message: z.string().max(500).optional()
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
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && local && url.protocol === "http:")) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  url.pathname = url.pathname.replace(/\/$/, "");
  return { url, token };
}

export function isRunnerConfigured(language: RunnerLanguage): boolean {
  return runnerConfig(language) !== null;
}

export async function runnerHealth(language: RunnerLanguage): Promise<{ configured: boolean; available: boolean }> {
  const config = runnerConfig(language);
  if (!config) return { configured: false, available: false };
  try {
    const response = await fetch(new URL("/health", config.url), {
      headers: { Authorization: `Bearer ${config.token}` },
      redirect: "error",
      signal: AbortSignal.timeout(2000)
    });
    return { configured: true, available: response.ok };
  } catch {
    return { configured: true, available: false };
  }
}

export type RunnerTestCase = { name: string; input: unknown; expected: unknown };

export async function executeOnRunner(input: {
  language: RunnerLanguage;
  taskId: string;
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
      body: JSON.stringify({ taskId: input.taskId, language: input.language, code: input.code, testCases: input.testCases }),
      signal: AbortSignal.timeout(15_000)
    });
    const text = await response.text();
    if (!response.ok || Buffer.byteLength(text, "utf8") > 512_000) return { status: "error" as const, message: "Execution service returned an invalid response." };
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
      message: parsed.data.message
    };
  } catch {
    return { status: "unavailable" as const, message: "Execution service is unavailable." };
  }
}