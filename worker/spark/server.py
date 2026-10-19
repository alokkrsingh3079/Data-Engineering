import json
import os
import resource
import selectors
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY_BYTES = 64 * 1024
MAX_OUTPUT_BYTES = 256 * 1024
MAX_CODE_BYTES = 32 * 1024
MAX_TESTS = 20
MAX_CONCURRENT_JOBS = 2
JOB_TIMEOUT_SECONDS = 45
MAX_JOBS = threading.BoundedSemaphore(MAX_CONCURRENT_JOBS)
TOKEN = os.environ.get("SPARK_RUNNER_TOKEN", "")

HARNESS = r'''
import contextlib, io, json, sys
from pyspark.sql import SparkSession

request = json.load(sys.stdin)
spark = (SparkSession.builder.master("local[2]")
    .appName("interview-lab")
    .config("spark.ui.enabled", "false")
    .config("spark.driver.bindAddress", "127.0.0.1")
    .config("spark.driver.host", "127.0.0.1")
    .config("spark.sql.shuffle.partitions", "2")
    .config("spark.default.parallelism", "2")
    .config("spark.driver.memory", "512m")
    .config("spark.sql.execution.arrow.pyspark.enabled", "false")
    .getOrCreate())
spark.sparkContext.setLogLevel("ERROR")
namespace = {"__name__": "__submission__"}
try:
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        exec(compile(request["code"], "<submission>", "exec"), namespace, namespace)
        function = namespace.get(request["functionName"])
        if not callable(function):
            raise ValueError("Define the required function: " + request["functionName"])
        raw_input = request["input"]
        if isinstance(raw_input, list):
            arguments = [spark.createDataFrame(raw_input)]
        elif isinstance(raw_input, dict):
            arguments = [spark.createDataFrame(rows) for rows in raw_input.values()]
        else:
            raise ValueError("The exercise input must be a list or a dataset object.")
        result = function(*arguments)
        if not hasattr(result, "schema") or not hasattr(result, "limit"):
            raise TypeError("Your function must return a Spark DataFrame.")
        rows = result.limit(501).collect()
        if len(rows) > 500:
            raise ValueError("Output exceeds the 500-row limit.")
        columns = result.columns
        output = [{column: row[column] for column in columns} for row in rows]
        schema = [{"name": field.name, "type": field.dataType.simpleString()} for field in result.schema.fields]
    print(json.dumps({"ok": True, "columns": columns, "schema": schema, "rows": output}, default=str, separators=(",", ":")))
except BaseException as error:
    print(json.dumps({"ok": False, "error": type(error).__name__ + ": " + str(error)[:300}, separators=(",", ":")))
finally:
    spark.stop()
'''


def _limits():
    resource.setrlimit(resource.RLIMIT_CPU, (35, 35))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_OUTPUT_BYTES, MAX_OUTPUT_BYTES))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    resource.setrlimit(resource.RLIMIT_NPROC, (128, 128))


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _execute_case(code, function_name, test_case):
    payload = {"code": code, "functionName": function_name, "input": test_case["input"]}
    started = time.monotonic()
    command = [
        "bwrap", "--die-with-parent", "--new-session", "--unshare-all",
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/etc", "/etc",
        "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
        "--chdir", "/tmp", "--setenv", "HOME", "/tmp",
        "--setenv", "TMPDIR", "/tmp", "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin",
        "--setenv", "JAVA_HOME", "/usr/lib/jvm/java-17-openjdk-amd64",
        "--setenv", "SPARK_LOCAL_IP", "127.0.0.1",
        "--setenv", "PYSPARK_PYTHON", "/usr/local/bin/python",
        "--setenv", "PYSPARK_DRIVER_PYTHON", "/usr/local/bin/python",
        "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
        "--setenv", "PYTHONNOUSERSITE", "1",
        "--", "python", "-I", "-c", HARNESS,
    ]
    try:
        child = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=False,
            cwd="/tmp",
            env={"PATH": "/usr/local/bin:/usr/bin:/bin"},
            preexec_fn=_limits,
            start_new_session=True,
        )
        child.stdin.write(json.dumps(payload, separators=(",", ":")).encode())
        child.stdin.close()
        output = bytearray()
        timed_out = False
        output_exceeded = False
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = JOB_TIMEOUT_SECONDS - (time.monotonic() - started)
                if remaining <= 0:
                    timed_out = True
                    break
                for key, _ in selector.select(min(remaining, 0.1)):
                    chunk = os.read(key.fd, 8192)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    output.extend(chunk)
                    if len(output) > MAX_OUTPUT_BYTES:
                        output_exceeded = True
                        break
                if output_exceeded:
                    break
            if timed_out or output_exceeded:
                os.killpg(child.pid, signal.SIGKILL)
        return_code = child.wait(timeout=2)
    except (OSError, ValueError):
        return {"passed": False, "status": "error", "executionMs": int((time.monotonic() - started) * 1000), "message": "Spark execution could not be started."}

    elapsed = int((time.monotonic() - started) * 1000)
    if timed_out:
        return {"passed": False, "status": "timeout", "executionMs": elapsed}
    if output_exceeded:
        return {"passed": False, "status": "resource_limit_exceeded", "executionMs": elapsed, "message": "Output exceeded the 256 KB limit."}
    try:
        actual = json.loads(bytes(output).decode().strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        return {"passed": False, "status": "error", "executionMs": elapsed, "message": "Spark returned an invalid result."}
    if return_code != 0 or not actual.get("ok"):
        error = str(actual.get("error", "Spark execution failed."))
        return {"passed": False, "status": "failed", "executionMs": elapsed, "message": error[:500]}

    expected = test_case["expected"]
    expected_rows = expected if isinstance(expected, list) else expected.get("rows", [])
    expected_columns = test_case.get("expected_columns") or (list(expected_rows[0].keys()) if expected_rows else actual["columns"])
    expected_types = test_case.get("expected_schema")
    actual_rows = actual["rows"]
    ordered = test_case.get("ordered", False)
    actual_compare = [_canonical([row.get(column) for column in expected_columns]) for row in actual_rows]
    expected_compare = [_canonical([row.get(column) for column in expected_columns]) for row in expected_rows]
    if not ordered:
        actual_compare.sort()
        expected_compare.sort()
    passed = actual["columns"] == expected_columns and actual_compare == expected_compare
    if expected_types:
        passed = passed and {item["name"]: item["type"] for item in actual["schema"]} == expected_types
    result = {
        "passed": passed,
        "status": "succeeded",
        "executionMs": elapsed,
        "columns": actual["columns"],
        "schema": actual["schema"],
        "rows": actual_rows,
    }
    if "name" in test_case:
        result["name"] = test_case["name"]
    return result


def execute(request):
    function_name = request["taskId"].replace("-", "_")
    results = [_execute_case(request["code"], function_name, case) for case in request["testCases"]]
    status = next((item["status"] for item in results if item["status"] != "succeeded"), "succeeded")
    total_ms = sum(item["executionMs"] for item in results)
    passed = all(item["passed"] for item in results)
    summary = [{key: item[key] for key in ("name", "passed", "status", "executionMs", "message") if key in item} for item in results]
    public_output = next((item for item in results if item.get("status") == "succeeded"), {})
    return {
        "status": "passed" if passed else ("timeout" if status == "timeout" else "error" if status == "error" else "failed"),
        "executionMs": min(total_ms, 120_000),
        "tests": summary,
        "output": {key: public_output[key] for key in ("columns", "schema", "rows") if key in public_output},
        "message": next((item.get("message") for item in results if item.get("message")), None),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "SparkRunner"

    def log_message(self, _format, *_args):
        return

    def _authorized(self):
        supplied = self.headers.get("Authorization", "")
        return bool(TOKEN) and supplied == "Bearer " + TOKEN

    def _send(self, status, body):
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"ok": True, "language": "pyspark", "sparkVersion": "3.5.6", "pythonVersion": "3.11", "javaVersion": "17"})
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/v1/execute":
            self._send(404, {"error": "Not found"})
            return
        if not self._authorized():
            self._send(401, {"error": "Authentication required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_BODY_BYTES:
                raise ValueError
            request = json.loads(self.rfile.read(length))
            if request.get("language") != "pyspark" or not isinstance(request.get("code"), str) or not request["code"].strip():
                raise ValueError
            if len(request["code"].encode()) > MAX_CODE_BYTES:
                raise ValueError
            if not isinstance(request.get("taskId"), str) or not request["taskId"].replace("-", "").isalnum():
                raise ValueError
            cases = request.get("testCases")
            if not isinstance(cases, list) or not 1 <= len(cases) <= MAX_TESTS:
                raise ValueError
            for case in cases:
                if not isinstance(case, dict) or "input" not in case or "expected" not in case:
                    raise ValueError
                if len(json.dumps(case, separators=(",", ":")).encode()) > 32 * 1024:
                    raise ValueError
        except (ValueError, TypeError, json.JSONDecodeError):
            self._send(400, {"error": "Invalid runner request"})
            return
        if not MAX_JOBS.acquire(blocking=False):
            self._send(429, {"error": "Runner capacity is full"})
            return
        try:
            self._send(200, execute(request))
        except Exception:
            self._send(503, {"error": "Spark execution failed"})
        finally:
            MAX_JOBS.release()


def main():
    if not TOKEN:
        raise RuntimeError("SPARK_RUNNER_TOKEN is required")
    ThreadingHTTPServer((os.environ.get("SPARK_RUNNER_HOST", "0.0.0.0"), int(os.environ.get("SPARK_RUNNER_PORT", "4021"))), Handler).serve_forever()


if __name__ == "__main__":
    main()