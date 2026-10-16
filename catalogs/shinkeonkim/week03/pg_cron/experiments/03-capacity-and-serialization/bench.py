#!/usr/bin/env python3
"""Repeated capacity measurements; 12-second admission window + drain."""
import os
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, rows, environment, save

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get("RESULTS_DIR", str(HERE / "results")))
REPETITIONS = int(os.environ.get("REPETITIONS", "10"))
RESULTS.mkdir(parents=True, exist_ok=True)
for repetition in range(1, REPETITIONS + 1):
    for label, jobs, capacity in [('one-job', 1, 4), ('four-jobs-cap2', 4, 2), ('four-jobs-cap4', 4, 4)]:
        try:
            up(capacity)
            env = environment()
            sql('''CREATE TABLE measurement_window (starts timestamptz, ends timestamptz);
CREATE TABLE runs (job int, started timestamptz, finished timestamptz);
CREATE FUNCTION probe(j int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t timestamptz := clock_timestamp();
BEGIN
 IF t >= (SELECT ends FROM measurement_window) THEN RETURN; END IF;
 PERFORM pg_sleep(2);
 INSERT INTO runs VALUES (j, t, clock_timestamp());
END $$;
INSERT INTO measurement_window SELECT clock_timestamp(), clock_timestamp() + interval '12 seconds';''')
            for job in range(jobs):
                sql(f"SELECT cron.schedule('probe-{job}', '1 second', 'SELECT probe({job})');")
            time.sleep(17)  # all admitted 2-second operations have time to commit
            sql('SELECT cron.unschedule(jobid) FROM cron.job;')
            raw = rows('SELECT job, started, finished, extract(epoch FROM started) AS start_epoch, extract(epoch FROM finished) AS end_epoch FROM runs ORDER BY started')
            points = sorted([(r['start_epoch'], 1) for r in raw] + [(r['end_epoch'], -1) for r in raw])
            running = peak = 0
            for _, delta in points:
                running += delta
                peak = max(peak, running)
            for job in range(jobs):
                intervals = [r for r in raw if r['job'] == job]
                assert all(a['end_epoch'] <= b['start_epoch'] for a, b in zip(intervals, intervals[1:])), 'same job overlap'
            assert raw and peak <= min(jobs, capacity)
            summary = {'repetition': repetition, 'case': label, 'jobs': jobs,
                'admission_seconds': 12, 'completed_admitted_runs': len(raw),
                'admitted_runs_per_second': len(raw) / 12, 'peak_overlap': peak,
                'runs_by_job': {str(j): sum(r['job'] == j for r in raw) for j in range(jobs)}}
            save(RESULTS / f'{repetition}-{label}.json', {'environment': env, 'summary': summary,
                'window': rows('SELECT * FROM measurement_window'), 'runs': raw,
                'cron_history': rows('SELECT jobid, runid, status, return_message, start_time, end_time FROM cron.job_run_details ORDER BY runid')})
            print(summary, flush=True)
        finally:
            down()
