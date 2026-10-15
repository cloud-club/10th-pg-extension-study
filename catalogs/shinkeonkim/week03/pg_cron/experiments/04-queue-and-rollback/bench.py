#!/usr/bin/env python3
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, rows, environment, until, save
HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get("RESULTS_DIR", str(HERE / "results")))
REPETITIONS = int(os.environ.get("REPETITIONS", "10"))
RESULTS.mkdir(parents=True, exist_ok=True)
for repetition in range(1, REPETITIONS + 1):
    try:
        up()
        env = environment()
        sql((HERE / 'setup.sql').read_text())
        for worker in (1, 2):
            sql(f"SELECT cron.schedule('consumer-{worker}', '1 second', 'SELECT consume({worker})');")
        until(lambda: sql('SELECT count(*) FROM work WHERE done;') == '40')
        sql('SELECT cron.unschedule(jobid) FROM cron.job;')
        queue = rows('SELECT count(*) AS total, count(*) FILTER(WHERE done) AS done, min(attempts) AS min_attempts, max(attempts) AS max_attempts FROM work')[0]
        assert queue == {'total':40, 'done':40, 'min_attempts':1, 'max_attempts':1}
        assert sql('SELECT count(*) FROM effects;') == '40'
        failed_job = int(sql("SELECT cron.schedule('fault', '1 second', 'SELECT fail_after_write()');"))
        until(lambda: int(sql(f"SELECT count(*) FROM cron.job_run_details WHERE jobid={failed_job} AND status='failed';")) >= 2)
        sql(f'SELECT cron.unschedule({failed_job});')
        failures = rows(f"SELECT status, return_message FROM cron.job_run_details WHERE jobid={failed_job} AND status='failed'")
        assert all('intentional failure after insert' in r['return_message'] for r in failures)
        assert sql('SELECT count(*) FROM fault_effects;') == '0'
        result = {'environment':env, 'summary': {'repetition': repetition, 'queue':queue,
            'effects':40, 'failed_runs':len(failures), 'effects_after_failure':0},
            'work':rows('SELECT * FROM work ORDER BY id'), 'effects':rows('SELECT * FROM effects ORDER BY id'),
            'cron_history':rows('SELECT jobid, runid, status, return_message, start_time, end_time FROM cron.job_run_details ORDER BY runid')}
        save(RESULTS / f'{repetition}.json', result)
        print(result['summary'], flush=True)
    finally:
        down()
