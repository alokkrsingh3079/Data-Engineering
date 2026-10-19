import json
import os
import time
import urllib.error
import urllib.request

RUNNER_URL = os.environ.get("SPARK_RUNNER_URL", "http://127.0.0.1:4021").rstrip("/")
TOKEN = os.environ.get("SPARK_RUNNER_TOKEN", "")
FUNCTION_NAMES = {
    "pyspark-event-counts": "count_by_event_type",
    "pyspark-join-department-payroll": "payroll_by_department",
    "pyspark-window-salary-rank": "rank_department_salaries",
    "pyspark-fill-null-scores": "fill_missing_scores",
}


def execute(task_id, code, cases, timeout=150, return_output=True):
    request = urllib.request.Request(
        RUNNER_URL + "/v1/jobs",
        data=json.dumps({"language": "pyspark", "taskId": task_id, "functionName": FUNCTION_NAMES[task_id], "code": code, "testCases": cases, "returnOutput": return_output}).encode(),
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        queued = json.load(response)
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status_request = urllib.request.Request(
            RUNNER_URL + "/v1/jobs/" + queued["jobId"],
            headers={"Authorization": "Bearer " + TOKEN},
        )
        with urllib.request.urlopen(status_request, timeout=5) as response:
            job = json.load(response)
        if job["status"] in ("succeeded", "failed", "timed_out", "cancelled", "resource_limit_exceeded"):
            return job["result"]
        time.sleep(0.5)
    raise AssertionError("Spark job polling exceeded its deadline")


def assert_pass(task_id, code, case):
    result = execute(task_id, code, [case])
    assert result["status"] == "passed", (task_id, result)
    assert result["tests"][0]["passed"], (task_id, result)
    return result


def main():
    if not TOKEN:
        raise SystemExit("Set SPARK_RUNNER_TOKEN before running the Spark smoke tests.")
    ready_deadline = time.monotonic() + 60
    while time.monotonic() < ready_deadline:
        try:
            with urllib.request.urlopen(RUNNER_URL + "/health", timeout=2) as response:
                if response.status == 200:
                    break
        except (OSError, urllib.error.URLError):
            time.sleep(0.25)
    else:
        raise AssertionError("Spark runner did not become ready")

    aggregation = assert_pass(
        "pyspark-event-counts",
        "from pyspark.sql import functions as F\ndef count_by_event_type(events): return events.groupBy('event_type').count().orderBy('event_type')",
        {"name": "aggregation", "input": [{"event_type": "view"}, {"event_type": "purchase"}, {"event_type": "view"}], "expected": [{"event_type": "purchase", "count": 1}, {"event_type": "view", "count": 2}], "ordered": True},
    )
    assert aggregation["output"]["rows"][-1]["count"] == 2
    assert_pass(
        "pyspark-join-department-payroll",
        "from pyspark.sql import functions as F\ndef payroll_by_department(employees, departments): return employees.join(departments, 'department_id').groupBy('department_name').agg(F.sum('salary').alias('total_salary')).orderBy('department_name')",
        {"name": "join", "input": {"employees": [{"employee_id": 1, "department_id": 10, "salary": 50000}, {"employee_id": 2, "department_id": 10, "salary": 60000}], "departments": [{"department_id": 10, "department_name": "Engineering"}]}, "expected": [{"department_name": "Engineering", "total_salary": 110000}], "ordered": True},
    )
    assert_pass(
        "pyspark-window-salary-rank",
        "from pyspark.sql import functions as F\nfrom pyspark.sql.window import Window\ndef rank_department_salaries(employees): return employees.withColumn('salary_rank', F.rank().over(Window.partitionBy('department_id').orderBy(F.desc('salary')))).orderBy('department_id', 'employee_id')",
        {"name": "window", "input": [{"employee_id": 1, "department_id": 10, "salary": 90000}, {"employee_id": 2, "department_id": 10, "salary": 70000}], "expected": [{"employee_id": 1, "department_id": 10, "salary": 90000, "salary_rank": 1}, {"employee_id": 2, "department_id": 10, "salary": 70000, "salary_rank": 2}], "ordered": True},
    )
    assert_pass(
        "pyspark-fill-null-scores",
        "from pyspark.sql import functions as F\ndef fill_missing_scores(scores): return scores.withColumn('score', F.coalesce(F.col('score'), F.lit(0))).orderBy('student_id')",
        {"name": "nulls", "input": [{"student_id": 1, "score": 88}, {"student_id": 2, "score": None}], "expected": [{"student_id": 1, "score": 88}, {"student_id": 2, "score": 0}], "ordered": True},
    )

    syntax = execute("pyspark-event-counts", "def count_by_event_type(:", [{"name": "syntax", "input": [{"event_type": "x"}], "expected": []}])
    assert syntax["status"] == "error" and syntax["message"], syntax

    hidden = execute("pyspark-event-counts", "from pyspark.sql import functions as F\ndef count_by_event_type(events): return events.groupBy('event_type').count().orderBy('event_type')", [{"name": "private expected output", "input": [{"event_type": "x"}], "expected": [{"event_type": "x", "count": 1}]}], return_output=False)
    assert hidden["status"] == "passed" and not hidden.get("output"), hidden
    assert hidden["tests"][0]["name"] == "Hidden test 1", hidden
    assert "expected" not in json.dumps(hidden), hidden

    incorrect = execute("pyspark-event-counts", "from pyspark.sql import functions as F\ndef count_by_event_type(events): return events.groupBy('event_type').count()", [{"name": "wrong ordered output", "input": [{"event_type": "x"}, {"event_type": "x"}], "expected": [{"event_type": "x", "count": 1}], "ordered": True}])
    assert incorrect["status"] == "failed" and incorrect["tests"][0]["passed"] is False, incorrect

    isolated = execute("pyspark-event-counts", "import socket\nfrom pyspark.sql import functions as F\ndef count_by_event_type(events):\n    client = socket.socket(); client.settimeout(1)\n    connected = client.connect_ex(('1.1.1.1', 80)) == 0\n    client.close()\n    if connected: raise RuntimeError('network available')\n    return events.groupBy('event_type').count().orderBy('event_type')", [{"name": "network isolation", "input": [{"event_type": "x"}], "expected": [{"event_type": "x", "count": 1}], "ordered": True}])
    assert isolated["status"] == "passed", isolated

    started = time.monotonic()
    timeout = execute("pyspark-event-counts", "def count_by_event_type(events):\n    while True: pass", [{"name": "timeout", "input": [{"event_type": "x"}], "expected": []}], timeout=60)
    assert timeout["status"] == "timeout", timeout
    assert time.monotonic() - started <= 55, timeout

    create_request = urllib.request.Request(
        RUNNER_URL + "/v1/jobs",
        data=json.dumps({"language": "pyspark", "taskId": "pyspark-event-counts", "functionName": FUNCTION_NAMES["pyspark-event-counts"], "code": "def count_by_event_type(events):\n    while True: pass", "testCases": [{"name": "cancel", "input": [{"event_type": "x"}], "expected": []}]}).encode(),
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(create_request, timeout=5) as response:
        queued = json.load(response)
    cancel_request = urllib.request.Request(RUNNER_URL + "/v1/jobs/" + queued["jobId"], headers={"Authorization": "Bearer " + TOKEN}, method="DELETE")
    with urllib.request.urlopen(cancel_request, timeout=5) as response:
        cancelled = json.load(response)
    assert cancelled["status"] == "cancelled", cancelled

    print("Spark smoke tests passed: aggregation, join, window, nulls, incorrect answer, hidden-output secrecy, syntax error, timeout, cancellation, network isolation")


if __name__ == "__main__":
    main()