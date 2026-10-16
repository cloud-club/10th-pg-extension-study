#!/usr/bin/env python3
"""Capture cron metadata examples in an isolated pg_cron 1.6.8 database."""
import json
import sys
from pathlib import Path

OWNER = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(OWNER / 'week03/pg_cron/experiments/runtime'))
import harness as h  # noqa: E402

h.COMPOSE += ['-p', 'pgcron-storage-content-check']
OUT = OWNER / 'web/src/data/cron-storage-demo.json'


def capture(sql):
    return {
        'sql': sql,
        'output': h.sql('\\pset format aligned\n\\pset tuples_only off\n' + sql),
    }


try:
    h.up(4)
    result = {
        'note': ('PostgreSQL 16 / pg_cron 1.6.8 · 별도 임시 study DB에서 실측. '
                 'jobid·runid·PID·시각·물리 파일명은 실행마다 달라진다.'),
        'location': capture("""SELECT current_database() AS connected_db,
       e.extname, n.nspname AS extension_schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_cron';"""),
        'tables': capture("""SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'cron'
ORDER BY table_name;"""),
        'columns': capture("""SELECT table_name, ordinal_position AS no, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'cron'
  AND table_name IN ('job', 'job_run_details')
ORDER BY table_name, ordinal_position;"""),
        'empty': capture("SELECT count(*) AS jobs_before FROM cron.job;"),
    }
    h.sql("""CREATE TABLE public.cron_storage_heartbeat (
  tick timestamptz DEFAULT clock_timestamp()
);""")
    result['schedule'] = capture("""SELECT cron.schedule(
  'storage-demo', '2 seconds',
  $$INSERT INTO public.cron_storage_heartbeat DEFAULT VALUES$$
) AS jobid;""")
    result['job'] = capture("""SELECT jobid, jobname, schedule, command, nodename, nodeport,
       database, username, active
FROM cron.job
WHERE jobname = 'storage-demo';""")
    h.until(lambda: h.sql('SELECT count(*) FROM cron_storage_heartbeat;') != '0')
    h.until(lambda: h.sql("""SELECT count(*) FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname='storage-demo')
  AND status = 'succeeded';""") != '0')
    result['run'] = capture("""SELECT runid, jobid, job_pid, database, username,
       status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'storage-demo')
ORDER BY runid DESC LIMIT 1;""")
    result['effect'] = capture(
        "SELECT count(*) AS heartbeat_rows FROM public.cron_storage_heartbeat;")
    result['physical'] = capture("""SELECT current_database() AS database, n.nspname AS schema,
       c.relname AS table_name, pg_relation_filepath(c.oid) AS internal_path
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'cron'
  AND c.relname IN ('job', 'job_run_details')
ORDER BY c.relname;""")
    result['unschedule'] = capture("SELECT cron.unschedule('storage-demo');")
    result['after_unschedule'] = capture("""SELECT
  (SELECT count(*) FROM cron.job WHERE jobname = 'storage-demo') AS jobs_after,
  (SELECT count(*) FROM cron.job_run_details WHERE jobid = 1) AS histories_after;""")
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    assert h.sql("SELECT count(*) FROM cron.job WHERE jobname='storage-demo';") == '0'
    print('PASS: cron.job row, run history, business effect and physical relation path captured')
finally:
    h.down()
