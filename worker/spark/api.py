import json
import os
import socket
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import docker
from docker.errors import DockerException, NotFound

MAX_BODY_BYTES = 64 * 1024
MAX_CODE_BYTES = 32 * 1024
MAX_TESTS = 3
MAX_CONCURRENT_JOBS = 2
MAX_QUEUED_JOBS = 8
JOB_TIMEOUT_SECONDS = 45
MAX_OUTPUT_BYTES = 256 * 1024
MAX_JOBS = threading.BoundedSemaphore(MAX_CONCURRENT_JOBS)
JOB_LOCK = threading.Lock()
JOBS = {}
CANCELLED_JOBS = set()
EXECUTOR = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS, thread_name_prefix="spark-job")
TOKEN = os.environ.get("SPARK_RUNNER_TOKEN", "")
JOB_IMAGE = os.environ.get("SPARK_JOB_IMAGE", "sql-practice-spark-runner:3.5.6")
client = docker.from_env(timeout=5)


def _canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _run_case(request, case, job_id=""):
    with JOB_LOCK:
        if job_id in CANCELLED_JOBS:
            return {"passed": False, "status": "cancelled", "message": "Job was cancelled."}
    payload = {
        "code": request["code"],
        "functionName": request["functionName"],
        "testCases": request["testCases"],
    }
    container = None
    started = time.monotonic()
    try:
        container = client.containers.create(
            image=JOB_IMAGE,
            command=["python", "/opt/spark-runner/job.py"],
            name="spark-job-" + job_id,
            labels={"com.sql-practice.spark-job": job_id},
            stdin_open=True,
            tty=True,
            detach=True,
            network_mode="none",
            read_only=True,
            user="10001:10001",
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit="2g",
            nano_cpus=1_000_000_000,
            pids_limit=128,
            tmpfs={"/tmp": "rw,exec,nosuid,nodev,size=256m,mode=1777"},
            log_config=docker.types.LogConfig(type="none"),
            environment={
                "HOME": "/tmp",
                "TMPDIR": "/tmp",
                "JAVA_HOME": "/usr/lib/jvm/java-17-openjdk-amd64",
                "JAVA_TOOL_OPTIONS": "-XX:ActiveProcessorCount=2 -XX:ParallelGCThreads=2 -XX:ConcGCThreads=1 -Xss512k",
                "SPARK_LOCAL_IP": "127.0.0.1",
                "PYSPARK_PYTHON": "/usr/local/bin/python",
                "PYSPARK_DRIVER_PYTHON": "/usr/local/bin/python",
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTHONNOUSERSITE": "1",
            },
        )
        connection = container.attach_socket(params={"stdin": 1, "stdout": 1, "stderr": 1, "stream": 1})
        stream = connection._sock
        stream.settimeout(0.5)
        with JOB_LOCK:
            if job_id in CANCELLED_JOBS:
                return {"passed": False, "status": "cancelled", "message": "Job was cancelled."}
        container.start()
        stream.sendall(json.dumps(payload, separators=(",", ":")).encode() + b"\n")
        output = bytearray()
        deadline = started + JOB_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            try:
                chunk = stream.recv(8192)
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > MAX_OUTPUT_BYTES:
                    container.kill()
                    return {"passed": False, "status": "resource_limit_exceeded", "message": "Output exceeded the 256 KB limit."}
            except socket.timeout:
                container.reload()
                if container.status != "running":
                    break
        else:
            container.kill()
            return {"passed": False, "status": "timeout", "message": "Execution exceeded the 45-second limit."}
        exit_code = container.wait(timeout=3).get("StatusCode", 1)
        if exit_code != 0:
            return {"passed": False, "status": "runtime_error", "message": "Spark process exited before returning a result."}
        try:
            actual = json.loads(bytes(output).decode(errors="replace").strip().splitlines()[-1])
        except (json.JSONDecodeError, IndexError):
            return {"passed": False, "status": "runtime_error", "message": "Spark returned an invalid result."}
        if not actual.get("ok") or not isinstance(actual.get("cases"), list) or len(actual["cases"]) != len(request["testCases"]):
            return {"passed": False, "status": "runtime_error", "message": str(actual.get("error", "Spark execution failed."))[:500]}
        elapsed = int((time.monotonic() - started) * 1000)
        tests = []
        outputs = []
        for index, test_case in enumerate(request["testCases"]):
            actual_case = actual["cases"][index]
            if not actual_case.get("ok"):
                tests.append({"name": test_case.get("name", f"Test case {index + 1}"), "passed": False, "status": "runtime_error", "message": str(actual_case.get("error", "Spark execution failed."))[:500]})
                outputs.append(None)
                continue
            expected = test_case["expected"]
            expected_rows = expected if isinstance(expected, list) else expected.get("rows", [])
            expected_columns = test_case.get("expected_columns") or (list(expected_rows[0].keys()) if expected_rows else actual_case["columns"])
            actual_compare = [_canonical([row.get(column) for column in expected_columns]) for row in actual_case["rows"]]
            expected_compare = [_canonical([row.get(column) for column in expected_columns]) for row in expected_rows]
            if not test_case.get("ordered", False):
                actual_compare.sort()
                expected_compare.sort()
            passed = set(actual_case["columns"]) == set(expected_columns) and actual_compare == expected_compare
            expected_types = test_case.get("expected_schema")
            if expected_types:
                passed = passed and {item["name"]: item["type"] for item in actual_case["schema"]} == expected_types
            tests.append({"name": test_case.get("name", f"Test case {index + 1}"), "passed": passed, "status": "succeeded" if passed else "incorrect"})
            outputs.append({"columns": actual_case["columns"], "schema": actual_case["schema"], "rows": actual_case["rows"], "console": actual_case.get("console", "")[:16000]})
        statuses = [test["status"] for test in tests]
        status = "runtime_error" if "runtime_error" in statuses else "incorrect" if "incorrect" in statuses else "succeeded"
        return {"passed": all(test["passed"] for test in tests), "status": status, "executionMs": elapsed, "tests": tests, "outputs": outputs, "message": next((test.get("message") for test in tests if test.get("message")), None)}
    except DockerException:
        return {"passed": False, "status": "error", "message": "Isolated Spark container could not be started."}
    finally:
        if container:
            try:
                container.remove(force=True)
            except DockerException:
                pass


def execute(request):
    job_id = request.get("jobId", str(uuid.uuid4()))
    result = _run_case(request, None, job_id)
    passed = result["passed"]
    status = result["status"]
    summary = [{"name": test.get("name") if request.get("returnOutput", True) else f"Hidden test {index + 1}", **{key: test[key] for key in ("passed", "status", "message") if key in test}} for index, test in enumerate(result.get("tests", []))]
    outputs = result.get("outputs", [])
    public_output = next((output for output in outputs if output), {})
    return {
        "status": "passed" if passed else ("timeout" if status == "timeout" else "resource_limit_exceeded" if status == "resource_limit_exceeded" else "error" if status in ("error", "runtime_error") else "failed"),
        "executionMs": min(result.get("executionMs", 0), 120_000),
        "tests": summary,
        "output": {key: public_output[key] for key in ("columns", "schema", "rows", "console") if key in public_output} if request.get("returnOutput", True) else {},
        "message": result.get("message"),
    }


def _run_queued(job_id, request):
    with JOB_LOCK:
        job = JOBS.get(job_id)
        if not job or job["status"] == "cancelled":
            return
        job["status"] = "running"
        job["startedAt"] = datetime.now(timezone.utc).isoformat()
    result = execute({**request, "jobId": job_id})
    status = {
        "passed": "succeeded",
        "failed": "failed",
        "timeout": "timed_out",
        "error": "failed",
        "resource_limit_exceeded": "resource_limit_exceeded",
        "cancelled": "cancelled",
    }.get(result["status"], "failed")
    with JOB_LOCK:
        job = JOBS.get(job_id)
        if job and job["status"] != "cancelled":
            job.update({"status": status, "result": result, "finishedAt": datetime.now(timezone.utc).isoformat(), "finishedEpoch": time.time()})


def _create_job(request):
    now = datetime.now(timezone.utc).isoformat()
    job_id = str(uuid.uuid4())
    with JOB_LOCK:
        expired = [key for key, job in JOBS.items() if job.get("finishedAt") and time.time() - job.get("finishedEpoch", 0) > 3600]
        for key in expired:
            JOBS.pop(key, None)
            CANCELLED_JOBS.discard(key)
        active = sum(job["status"] in ("queued", "running") for job in JOBS.values())
        if active >= MAX_CONCURRENT_JOBS + MAX_QUEUED_JOBS:
            return None
        JOBS[job_id] = {"jobId": job_id, "status": "queued", "createdAt": now, "result": None, "finishedEpoch": 0}
    future = EXECUTOR.submit(_run_queued, job_id, {**request, "jobId": job_id})
    with JOB_LOCK:
        if job_id in JOBS:
            JOBS[job_id]["future"] = future
    return job_id


class Handler(BaseHTTPRequestHandler):
    server_version = "SparkRunner"

    def log_message(self, _format, *_args):
        return

    def _authorized(self):
        return bool(TOKEN) and self.headers.get("Authorization", "") == "Bearer " + TOKEN

    def _send(self, status, body):
        encoded = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path.startswith("/v1/jobs/"):
            if not self._authorized():
                self._send(401, {"error": "Authentication required"})
                return
            job_id = self.path.removeprefix("/v1/jobs/")
            with JOB_LOCK:
                job = JOBS.get(job_id)
                visible = {key: job.get(key) for key in ("jobId", "status", "createdAt", "startedAt", "finishedAt", "result")} if job else None
            if not visible:
                self._send(404, {"error": "Job not found"})
                return
            self._send(200, visible)
            return
        if self.path != "/health":
            self._send(404, {"error": "Not found"})
            return
        try:
            client.ping()
            client.images.get(JOB_IMAGE)
        except (DockerException, NotFound):
            self._send(503, {"ok": False, "error": "Docker executor is not ready"})
            return
        self._send(200, {"ok": True, "language": "pyspark", "sparkVersion": "3.5.6", "pythonVersion": "3.11", "javaVersion": "17"})

    def do_POST(self):
        if self.path not in ("/v1/execute", "/v1/jobs"):
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
            if not isinstance(request.get("functionName"), str) or not request["functionName"].isidentifier():
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
        acquired = False
        if self.path == "/v1/execute":
            acquired = MAX_JOBS.acquire(blocking=False)
            if not acquired:
                self._send(429, {"error": "Runner capacity is full"})
                return
        try:
            if self.path == "/v1/jobs":
                job_id = _create_job(request)
                if not job_id:
                    self._send(429, {"error": "Runner queue is full"})
                    return
                self._send(202, {"jobId": job_id, "status": "queued", "createdAt": JOBS[job_id]["createdAt"]})
            else:
                self._send(200, execute(request))
        except Exception:
            self._send(503, {"error": "Spark execution failed"})
        finally:
            if acquired:
                MAX_JOBS.release()

    def do_DELETE(self):
        if not self._authorized():
            self._send(401, {"error": "Authentication required"})
            return
        job_id = self.path.removeprefix("/v1/jobs/")
        with JOB_LOCK:
            job = JOBS.get(job_id)
            if not job:
                self._send(404, {"error": "Job not found"})
                return
            if job["status"] in ("succeeded", "failed", "timed_out", "resource_limit_exceeded", "cancelled"):
                self._send(409, {"error": "Job is already complete"})
                return
            job["status"] = "cancelled"
            CANCELLED_JOBS.add(job_id)
            job["finishedAt"] = datetime.now(timezone.utc).isoformat()
            job["finishedEpoch"] = time.time()
            future = job.get("future")
            if future:
                future.cancel()
        try:
            containers = client.containers.list(all=True, filters={"label": "com.sql-practice.spark-job=" + job_id})
        except DockerException:
            containers = []
        for container in containers:
            try:
                container.kill()
                container.remove(force=True)
            except DockerException:
                pass
        self._send(200, {"jobId": job_id, "status": "cancelled"})


def main():
    if not TOKEN:
        raise RuntimeError("SPARK_RUNNER_TOKEN is required")
    client.ping()
    client.images.get(JOB_IMAGE)
    ThreadingHTTPServer((os.environ.get("SPARK_RUNNER_HOST", "0.0.0.0"), int(os.environ.get("SPARK_RUNNER_PORT", "4021"))), Handler).serve_forever()


if __name__ == "__main__":
    main()