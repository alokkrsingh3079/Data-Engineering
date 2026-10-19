import contextlib
import io
import json
import sys


def main():
    request = json.loads(sys.stdin.readline())
    namespace = {"__name__": "__submission__"}
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            exec(compile(request["code"], "<submission>", "exec"), namespace, namespace)
            function = namespace.get(request["functionName"])
            if not callable(function):
                raise ValueError("Define the required function: " + request["functionName"])
            value = function(request["input"])
        print(json.dumps({"ok": True, "value": value}, separators=(",", ":")), flush=True)
    except BaseException as error:
        print(json.dumps({"ok": False, "error": type(error).__name__ + ": " + str(error)[:300]}, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
