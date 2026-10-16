#!/usr/bin/env python3
"""A separate controlled follow-up: register all jobs atomically, record live state."""
import os
import sys
import time
import subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, rows, environment, save, COMPOSE
HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get("RESULTS_DIR", str(HERE / "results")))
REPETITIONS = int(os.environ.get("REPETITIONS", "10"))
RESULTS.mkdir(parents=True, exist_ok=True)
for repetition in range(1, REPETITIONS + 1):
    try:
        up(2)
        env = environment()
        sql('''CREATE TABLE observed (job int, started timestamptz, finished timestamptz);
CREATE FUNCTION observe(j int) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t timestamptz := clock_timestamp();
BEGIN PERFORM pg_sleep(2); INSERT INTO observed VALUES(j,t,clock_timestamp()); END $$;
BEGIN;
SELECT cron.schedule('a','1 second','SELECT observe(1)');
SELECT cron.schedule('b','1 second','SELECT observe(2)');
SELECT cron.schedule('c','1 second','SELECT observe(3)');
SELECT cron.schedule('d','1 second','SELECT observe(4)');
COMMIT;''')
        snapshots = []
        for i in range(3):
            time.sleep(6)
            snapshots.append({'observed_at':sql('SELECT clock_timestamp();'),
                'activity': rows("SELECT pid, backend_type, application_name, state, wait_event_type, wait_event, query FROM pg_stat_activity WHERE application_name='pg_cron' OR backend_type='pg_cron launcher'"),
                'history':rows('SELECT jobid, runid, status, start_time, end_time, return_message FROM cron.job_run_details ORDER BY runid'),
                'committed':rows('SELECT * FROM observed ORDER BY started')})
        save(RESULTS / f'diagnostic-{repetition}.json', {'environment':env, 'snapshots':snapshots})
        log = subprocess.check_output(COMPOSE + ['logs','--no-color','postgres'], text=True)
        (RESULTS/f'diagnostic-{repetition}.txt').write_text(log)
        print('diagnostic', repetition, 'committed:', [len(s['committed']) for s in snapshots], flush=True)
    finally:
        down()
