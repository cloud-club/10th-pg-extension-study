#!/usr/bin/env python3
"""Compare pg_cron v1.6.8 with one PollForTasks condition changed."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import time

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get("RESULTS_DIR", str(HERE / "results")))
REPETITIONS = int(os.environ.get("REPETITIONS", "10"))
PREFIX = f"pgcron-causal-{os.getpid()}"
IMAGES = {
    "original": f"{PREFIX}-original:v1.6.8",
    "fixed": f"{PREFIX}-fixed:v1.6.8",
}


def run(command, *, sql=None, check=True):
    process = subprocess.run(command, input=sql, text=True, capture_output=True)
    if check and process.returncode:
        raise RuntimeError(f"{' '.join(command)}\n{process.stderr}")
    return process.stdout.strip()


def psql(container, statement):
    return run([
        "docker", "exec", "-i", container, "psql", "-X", "-qAt",
        "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1",
    ], sql=statement)


def build_images():
    for variant, patch in (("original", "0"), ("fixed", "1")):
        subprocess.run([
            "docker", "build", "-f", str(HERE / "causal.Dockerfile"),
            "--build-arg", f"APPLY_WAITING_PATCH={patch}",
            "-t", IMAGES[variant], str(HERE),
        ], check=True)


def wait_until_stable(container):
    deadline = time.monotonic() + 40
    consecutive_successes = 0
    while time.monotonic() < deadline:
        process = subprocess.run([
            "docker", "exec", "-i", container, "psql", "-X", "-qAt",
            "-U", "postgres", "-d", "postgres",
        ], input="SELECT 1;", text=True, capture_output=True)
        if process.returncode == 0 and process.stdout.strip() == "1":
            consecutive_successes += 1
        else:
            consecutive_successes = 0
        if consecutive_successes == 3:
            return
        time.sleep(0.5)
    raise RuntimeError(f"{container}: PostgreSQL did not become stable")


def run_case(variant, repetition):
    container = f"{PREFIX}-{variant}-{repetition}"
    run([
        "docker", "run", "--rm", "-d", "--name", container,
        "--tmpfs", "/var/lib/postgresql/data", "-e", "POSTGRES_PASSWORD=x",
        IMAGES[variant], "postgres",
        "-c", "shared_preload_libraries=pg_cron",
        "-c", "cron.database_name=postgres",
        "-c", "cron.host=/var/run/postgresql",
        "-c", "cron.max_running_jobs=2",
    ])
    try:
        wait_until_stable(container)
        psql(container, """CREATE EXTENSION pg_cron;
CREATE TABLE observed (job int, started timestamptz, finished timestamptz);
CREATE FUNCTION observe(j int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t timestamptz := clock_timestamp();
BEGIN
  PERFORM pg_sleep(2);
  INSERT INTO observed VALUES (j, t, clock_timestamp());
END $$;
BEGIN;
SELECT cron.schedule('a', '1 second', 'SELECT observe(1)');
SELECT cron.schedule('b', '1 second', 'SELECT observe(2)');
SELECT cron.schedule('c', '1 second', 'SELECT observe(3)');
SELECT cron.schedule('d', '1 second', 'SELECT observe(4)');
COMMIT;""")
        committed = []
        for _ in range(3):
            time.sleep(6)
            committed.append(int(psql(container, "SELECT count(*) FROM observed;")))
        timeouts = int(psql(container, """SELECT count(*)
FROM cron.job_run_details
WHERE return_message = 'job startup timeout';"""))
        return {
            "variant": variant,
            "repetition": repetition,
            "committed": committed,
            "startup_timeouts": timeouts,
        }
    finally:
        subprocess.run(["docker", "stop", container], capture_output=True)


def main():
    RESULTS.mkdir(parents=True, exist_ok=True)
    build_images()
    rows = []
    for repetition in range(1, REPETITIONS + 1):
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            pair = list(executor.map(
                lambda variant: run_case(variant, repetition),
                ("original", "fixed"),
            ))
        rows.extend(pair)
        print(json.dumps(pair, ensure_ascii=False), flush=True)

    original = [row for row in rows if row["variant"] == "original"]
    fixed = [row for row in rows if row["variant"] == "fixed"]
    assert all(row["committed"][0] == row["committed"][1] for row in original)
    assert all(row["startup_timeouts"] == 2 for row in original)
    assert all(row["committed"][1:] == [10, 16] for row in fixed)
    assert all(row["startup_timeouts"] == 0 for row in fixed)
    (RESULTS / "causal-comparison.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        "PASS: the one-condition patch removed stalls and timeouts in "
        f"{REPETITIONS} repetition(s) per variant"
    )


if __name__ == "__main__":
    main()
