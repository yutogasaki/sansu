import json
import os
import pathlib
import signal
import subprocess
import sys
import time

folder = pathlib.Path(__file__).resolve().parent
candidate = pathlib.Path(sys.argv[1]).resolve()
output = folder / "attempt-01"
log = folder / "first-run.log.txt"
if output.exists() or log.exists():
    raise SystemExit("Preserve the first diagnostic attempt")
started = time.monotonic()
with log.open("x") as stream:
    process = subprocess.Popen(
        ["node", "--expose-gc", "--max-old-space-size=4096", str(folder / "diagnose.mjs"), str(candidate), str(output)],
        stdout=stream, stderr=subprocess.STDOUT, start_new_session=True,
    )
    timed_out = False
    try:
        code = process.wait(timeout=180)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGKILL)
        code = process.wait()
result = {"exitCode": code, "timedOut": timed_out, "wallSeconds": time.monotonic() - started,
          "heapLimitMiB": 4096, "wallLimitSeconds": 180, "candidate": str(candidate)}
(folder / "execution.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
raise SystemExit(1 if code else 0)
