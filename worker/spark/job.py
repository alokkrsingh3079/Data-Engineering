import contextlib
import io
import json
import sys

from pyspark.sql import SparkSession
from pyspark.sql import functions as F


def create_input_dataframe(spark, rows):
    if not isinstance(rows, list) or not rows or not all(isinstance(row, dict) for row in rows):
        return spark.createDataFrame(rows)

    columns = set().union(*(row.keys() for row in rows))
    all_null_columns = [column for column in columns if all(row.get(column) is None for row in rows)]
    if not all_null_columns:
        return spark.createDataFrame(rows)

    marker = "__spark_null_schema_inference__"
    prepared = [
        {**row, **{column: marker for column in all_null_columns}}
        for row in rows
    ]
    dataframe = spark.createDataFrame(prepared)
    for column in all_null_columns:
        dataframe = dataframe.withColumn(column, F.lit(None).cast("string"))
    return dataframe


def main():
    request = json.loads(sys.stdin.readline())
    spark = (SparkSession.builder.master("local[2]")
        .appName("interview-lab")
        .config("spark.ui.enabled", "false")
        .config("spark.driver.bindAddress", "127.0.0.1")
        .config("spark.driver.host", "127.0.0.1")
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.default.parallelism", "2")
        .config("spark.driver.memory", "512m")
        .config("spark.executor.memory", "512m")
        .config("spark.sql.adaptive.enabled", "false")
        .config("spark.sql.execution.arrow.pyspark.enabled", "false")
        .getOrCreate())
    spark.sparkContext.setLogLevel("ERROR")
    try:
        cases = []
        for test_case in request["testCases"]:
            case_spark = spark.newSession()
            namespace = {"__name__": "__submission__"}
            console = io.StringIO()
            try:
                with contextlib.redirect_stdout(console), contextlib.redirect_stderr(console):
                    exec(compile(request["code"], "<submission>", "exec"), namespace, namespace)
                    function = namespace.get(request["functionName"])
                    if not callable(function):
                        raise ValueError("Define the required function: " + request["functionName"])
                    raw_input = test_case["input"]
                    if isinstance(raw_input, dict) and set(raw_input.keys()) == {"input"}:
                        raw_input = raw_input["input"]
                    if isinstance(raw_input, list):
                        arguments = [create_input_dataframe(case_spark, raw_input)]
                    elif isinstance(raw_input, dict):
                        arguments = [create_input_dataframe(case_spark, rows) for rows in raw_input.values()]
                    else:
                        raise ValueError("The exercise input must be a list or a dataset object.")
                    result = function(*arguments)
                    if not hasattr(result, "schema") or not hasattr(result, "limit"):
                        raise TypeError("Your function must return a Spark DataFrame.")
                    rows = result.limit(501).collect()
                    if len(rows) > 500:
                        raise ValueError("Output exceeds the 500-row limit.")
                    columns = result.columns
                    output_rows = [{column: row[column] for column in columns} for row in rows]
                    schema = [{"name": field.name, "type": field.dataType.simpleString()} for field in result.schema.fields]
                cases.append({"ok": True, "columns": columns, "schema": schema, "rows": output_rows, "console": console.getvalue()[:16000]})
            except BaseException as error:
                cases.append({"ok": False, "error": type(error).__name__ + ": " + str(error)[:300], "console": console.getvalue()[:16000]})
        print(json.dumps({"ok": True, "cases": cases}, default=str, separators=(",", ":")), flush=True)
    except BaseException as error:
        print(json.dumps({"ok": False, "error": type(error).__name__ + ": " + str(error)[:300]}, separators=(",", ":")), flush=True)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()