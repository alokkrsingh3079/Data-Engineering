import json
import os
import socket
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import docker
from docker.errors import DockerException, NotFound

MAX_BODY_BYTES = 256 * 1024
MAX_CODE_BYTES = 32 * 1024
MAX_CASE_BYTES = 32 * 1024
MAX_OUTPUT_BYTES = 64 * 1024
MAX_CASES = 100
MAX_CONCURRENT = 2
TIMEOUT_SECONDS = 8
TOKEN = os.environ.get("PYTHON_RUNNER_TOKEN", "")
IMAGE = os.environ.get("PYTHON_JOB_IMAGE", "sql-practice-python-runner:3.11")
SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT)
client = docker.from_env(timeout=5)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def execute_case(code, function_name, case):
    job_id = str(uuid.uuid4())
    container = None
    started = time.monotonic()
    payload = {"code": code, "functionName": function_name, "input": case["input"]}
    try:
        container = client.containers.create(
            image=IMAGE,
            command=["python", "/opt/python-runner/job.py"],
            name="python-job-" + job_id,
            labels={"com.sql-practice.python-job": job_id},
            stdin_open=True,
            tty=True,
            detach=True,
            network_mode="none",
            read_only=True,
            user="10001:10001",
            cap_drop=["ALL"],
            security_opt=["no-new-privileges:true"],
            mem_limit="256m",
            nano_cpus=1_000_000_000,
            pids_limit=32,
            tmpfs={"/tmp": "rw,exec,nosuid,nodev,size=32m,mode=1777"},
            log_config=docker.types.LogConfig(type="none"),
            environment={"HOME":"/tmp","TMPDIR":"/tmp","PYTHONDONTWRITEBYTECODE":"1","PYTHONNOUSERSITE":"1"},
        )
        attached = container.attach_socket(params={"stdin":1,"stdout":1,"stderr":1,"stream":1})
        stream = attached._sock
        stream.settimeout(0.5)
        container.start()
        stream.sendall(json.dumps(payload, separators=(",", ":")).encode() + b"\n")
        output = bytearray()
        deadline = started + TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            try:
                chunk = stream.recv(8192)
                if not chunk:
                    break
                output.extend(chunk)
                if len(output) > MAX_OUTPUT_BYTES:
                    container.kill()
                    return {"passed":False,"status":"error","message":"Output exceeded the 64 KB limit."}
            except socket.timeout:
                container.reload()
                if container.status != "running":
                    break
        else:
            container.kill()
            return {"passed":False,"status":"timeout","message":"Execution exceeded the 8-second limit."}
        exit_code = container.wait(timeout=2).get("StatusCode", 1)
        if exit_code != 0:
            return {"passed":False,"status":"error","message":"Python process exited before returning a result."}
        try:
            actual = json.loads(bytes(output).decode(errors="replace").strip().splitlines()[-1])
        except (json.JSONDecodeError, IndexError):
            return {"passed":False,"status":"error","message":"Python returned an invalid result."}
        if not actual.get("ok"):
            return {"passed":False,"status":"error","message":str(actual.get("error","Python execution failed."))[:500]}
        passed = canonical(actual.get("value")) == canonical(case["expected"])
        if not case.get("ordered", True) and isinstance(actual.get("value"), list) and isinstance(case["expected"], list):
            passed = sorted(canonical(value) for value in actual["value"]) == sorted(canonical(value) for value in case["expected"])
        return {"passed":passed,"status":"succeeded" if passed else "incorrect","executionMs":int((time.monotonic()-started)*1000)}
    except DockerException:
        return {"passed":False,"status":"error","message":"Isolated Python container could not be started."}
    finally:
        if container:
            try:
                container.remove(force=True)
            except DockerException:
                pass


def execute(request):
    results = [execute_case(request["code"], request["functionName"], case) for case in request["testCases"]]
    errors = [item for item in results if item["status"] not in ("succeeded", "incorrect")]
    passed = all(item["passed"] for item in results)
    status = "passed" if passed else ("timeout" if any(item["status"] == "timeout" for item in errors) else "error" if errors else "failed")
    tests = [{"name":f"Hidden test {index+1}","passed":item["passed"]} for index,item in enumerate(results)]
    return {"status":status,"executionMs":min(sum(item.get("executionMs",0) for item in results),120_000),"tests":tests,"message":next((item.get("message") for item in errors if item.get("message")),None)}


class Handler(BaseHTTPRequestHandler):
    server_version = "PythonRunner"

    def log_message(self, _format, *_args):
        return

    def authorized(self):
        return bool(TOKEN) and self.headers.get("Authorization", "") == "Bearer " + TOKEN

    def send_json(self, status, body):
        payload = json.dumps(body, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/v1/auth-check":
            if not self.authorized():
                self.send_json(401, {"error": "Authentication required"})
                return
            try:
                client.ping()
                client.images.get(IMAGE)
            except (DockerException, NotFound):
                self.send_json(503, {"ok": False, "error": "Docker executor is not ready"})
                return
            self.send_json(200, {"ok": True, "language": "python"})
            return
        if self.path != "/health":
            self.send_json(404,{"error":"Not found"})
            return
        try:
            client.ping()
            client.images.get(IMAGE)
        except (DockerException, NotFound):
            self.send_json(503,{"ok":False,"error":"Docker executor is not ready"})
            return
        self.send_json(200,{"ok":True,"language":"python","pythonVersion":"3.11"})

    def do_POST(self):
        if self.path != "/v1/execute":
            self.send_json(404,{"error":"Not found"})
            return
        if not self.authorized():
            self.send_json(401,{"error":"Authentication required"})
            return
        try:
            length = int(self.headers.get("Content-Length","0"))
            if not 1 <= length <= MAX_BODY_BYTES:
                raise ValueError
            request = json.loads(self.rfile.read(length))
            if request.get("language") != "python" or not isinstance(request.get("code"),str) or not request["code"].strip():
                raise ValueError
            if len(request["code"].encode()) > MAX_CODE_BYTES:
                raise ValueError
            if not isinstance(request.get("taskId"),str) or not request["taskId"].replace("-","").isalnum():
                raise ValueError
            if not isinstance(request.get("functionName"),str) or not request["functionName"].isidentifier():
                raise ValueError
            cases = request.get("testCases")
            if not isinstance(cases,list) or not 1 <= len(cases) <= MAX_CASES:
                raise ValueError
            for case in cases:
                if not isinstance(case,dict) or "input" not in case or "expected" not in case:
                    raise ValueError
                if len(json.dumps(case,separators=(",", ":")).encode()) > MAX_CASE_BYTES:
                    raise ValueError
        except (ValueError,TypeError,json.JSONDecodeError):
            self.send_json(400,{"error":"Invalid runner request"})
            return
        if not SLOTS.acquire(blocking=False):
            self.send_json(429,{"error":"Runner capacity is full"})
            return
        try:
            self.send_json(200,execute(request))
        except Exception:
            self.send_json(503,{"error":"Python execution failed"})
        finally:
            SLOTS.release()


def main():
    if not TOKEN:
        raise RuntimeError("PYTHON_RUNNER_TOKEN is required")
    client.ping()
    client.images.get(IMAGE)
    ThreadingHTTPServer((os.environ.get("PYTHON_RUNNER_HOST","0.0.0.0"),int(os.environ.get("PYTHON_RUNNER_PORT","4020"))),Handler).serve_forever()


if __name__ == "__main__":
    main()
