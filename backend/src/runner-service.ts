import { spawn } from "node:child_process";
import crypto from "node:crypto";
import express from "express";
import { z } from "zod";

const port = Number(process.env.PYTHON_RUNNER_PORT || 4020);
const host = process.env.PYTHON_RUNNER_HOST || "127.0.0.1";
const maxOutputBytes = 64 * 1024;
const maxConcurrentRuns = 2;
const maxRunsPerMinute = 12;
const activeRuns = new Set<string>();
const requestBuckets = new Map<string, { count: number; startedAt: number }>();
const expectedToken = process.env.PYTHON_RUNNER_TOKEN || "";
const pythonExecutable = process.env.PYTHON_EXECUTABLE || "/usr/bin/python3";

const requestSchema = z.object({
  taskId: z.enum(["python-dedupe-events"]),
  language: z.literal("python"),
  code: z.string().min(1).max(32_000),
  testCases: z.array(z.object({
    name: z.string().min(1).max(120),
    input: z.unknown(),
    expected: z.unknown()
  }).strict()).min(1).max(100)
}).strict();

const harness = String.raw`
import contextlib
import io
import json
import sys
import traceback

request = json.load(sys.stdin)
namespace = {"__name__": "__submission__"}
results = []
status = "failed"
message = None
try:
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        exec(compile(request["code"], "<submission>", "exec"), namespace, namespace)
        function_name = request["functionName"]
        function = namespace.get(function_name)
        if not callable(function):
            raise ValueError("Define the required function: " + function_name)
        for test_case in request["testCases"]:
            try:
                actual = function(test_case["input"])
                passed = actual == test_case["expected"]
            except BaseException:
                passed = False
            results.append({"name": test_case["name"], "passed": passed})
    status = "passed" if results and all(item["passed"] for item in results) else "failed"
except BaseException as error:
    status = "error"
    message = type(error).__name__ + ": " + str(error)[:240]
    results = [{"name": item["name"], "passed": False} for item in request["testCases"]]
print(json.dumps({"status": status, "tests": results, "message": message}, separators=(",", ":")))
`;

function authorized(header: string | undefined) {
  if (!expectedToken || !header?.startsWith("Bearer ")) return false;
  const presented = Buffer.from(header.slice(7));
  const expected = Buffer.from(expectedToken);
  return presented.length === expected.length && crypto.timingSafeEqual(presented, expected);
}

function sandboxArgs(): string[] {
  return [
    "--cpu=4:5",
    "--as=536870912",
    "--nproc=256",
    "--fsize=1048576",
    "--nofile=64",
    "--",
    "/usr/bin/bwrap",
    "--die-with-parent",
    "--new-session",
    "--unshare-all",
    "--clearenv",
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", "/etc", "/etc",
    "--proc", "/proc",
    "--dev", "/dev",
    "--tmpfs", "/tmp",
    "--chdir", "/tmp",
    "--setenv", "HOME", "/tmp",
    "--setenv", "PATH", "/usr/bin:/bin",
    "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
    "--setenv", "PYTHONNOUSERSITE", "1",
    "--setenv", "PYTHONHASHSEED", "0",
    "--",
    pythonExecutable,
    "-I",
    "-S",
    "-c",
    harness
  ];
}

export function runSandboxedPython(input: z.infer<typeof requestSchema>): Promise<{ status: string; executionMs: number; tests: { name: string; passed: boolean }[]; message?: string }> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn("/usr/bin/prlimit", sandboxArgs(), { stdio: ["pipe", "pipe", "ignore"], detached: true });
    let stdout = Buffer.alloc(0);
    let exceededOutput = false;
    let timedOut = false;
    let finished = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid!, "SIGKILL"); } catch {}
    }, 6000);
    const finish = (value: { status: string; executionMs: number; tests: { name: string; passed: boolean }[]; message?: string }) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(value);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = Buffer.concat([stdout, chunk]);
      if (stdout.length > maxOutputBytes) {
        exceededOutput = true;
        try { process.kill(-child.pid!, "SIGKILL"); } catch {}
      }
    });
    child.on("error", () => finish({ status: "error", executionMs: Date.now() - startedAt, tests: input.testCases.map(({ name }) => ({ name, passed: false })), message: "Sandbox could not be started." }));
    child.on("close", (code, signal) => {
      const executionMs = Date.now() - startedAt;
      if (timedOut || signal === "SIGXCPU" || signal === "SIGKILL" || code === 137 || code === 152) return finish({ status: "timeout", executionMs, tests: input.testCases.map(({ name }) => ({ name, passed: false })), message: "Execution exceeded a CPU, memory, or wall-clock resource limit." });
      if (exceededOutput) return finish({ status: "error", executionMs, tests: input.testCases.map(({ name }) => ({ name, passed: false })), message: "Execution output exceeded the 64 KB limit." });
      let result: any;
      try { result = JSON.parse(stdout.toString("utf8")); } catch {}
      if (code !== 0 || !result || !["passed", "failed", "error"].includes(result.status) || !Array.isArray(result.tests) || result.tests.length !== input.testCases.length) {
        return finish({ status: "error", executionMs, tests: input.testCases.map(({ name }) => ({ name, passed: false })), message: "Sandbox returned an invalid result." });
      }
      finish({ status: result.status, executionMs, tests: result.tests, ...(result.message ? { message: String(result.message).slice(0, 500) } : {}) });
    });
    child.stdin.end(JSON.stringify({
      code: input.code,
      testCases: input.testCases,
      functionName: input.taskId === "python-dedupe-events" ? "dedupe_events" : ""
    }));
  });
}

export async function verifySandbox(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("/usr/bin/prlimit", sandboxArgs(), { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 1000) stderr += chunk.toString("utf8").slice(0, 1000 - stderr.length);
    });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || "bubblewrap and prlimit are required for the Python runner")));
    child.stdin.end(JSON.stringify({ code: "print('sandbox-ready')", testCases: [], functionName: "" }));
  });
}

export function createRunnerApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use((request, response, next) => {
    if (!authorized(request.header("authorization"))) return response.status(401).json({ error: "Authentication required" });
    next();
  });
  app.get("/health", (_request, response) => response.json({ ok: true, language: "python", sandbox: "bubblewrap" }));
  app.post("/v1/execute", async (request, response) => {
    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: "Invalid runner request" });
    if (activeRuns.size >= maxConcurrentRuns) return response.status(429).json({ error: "Runner capacity is full" });
    const ip = request.ip || "unknown";
    const current = requestBuckets.get(ip);
    const now = Date.now();
    if (!current || now - current.startedAt >= 60_000) requestBuckets.set(ip, { count: 1, startedAt: now });
    else if (++current.count > maxRunsPerMinute) return response.status(429).json({ error: "Runner rate limit exceeded" });
    const id = crypto.randomUUID();
    activeRuns.add(id);
    try {
      const result = await runSandboxedPython(parsed.data);
      response.json(result);
    } catch {
      response.status(503).json({ error: "Runner execution failed" });
    } finally {
      activeRuns.delete(id);
    }
  });
  return app;
}

async function main() {
  if (!expectedToken) throw new Error("PYTHON_RUNNER_TOKEN is required");
  await verifySandbox();
  createRunnerApp().listen(port, host, () => console.log(`Isolated Python runner listening on ${host}:${port}`));
}

if (process.argv[1]?.endsWith("runner-service.ts") || process.argv[1]?.endsWith("runner-service.js")) {
  main().catch((error) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
