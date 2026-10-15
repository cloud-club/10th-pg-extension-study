"""Capture web demo output in an isolated Docker Compose project; removes its DB on exit."""
import sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'week03/pg_cron/experiments/runtime'))
import harness as h
h.COMPOSE+=['-p','pgcron-web-concurrency-check']
blocks={}
def capture(key,sql):
 out=h.sql('\\pset format aligned\n\\pset tuples_only off\n'+sql)
 blocks[key]={'sql':sql,'output':out}
 return out
try:
 h.up(4)
 capture('settings',"SELECT current_setting('cron.max_running_jobs') AS job_limit,\n       current_setting('cron.use_background_workers') AS worker_mode;")
 capture('setup',"""CREATE TABLE public.cron_demo_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  label text, pid integer, started timestamptz, finished timestamptz
);
CREATE FUNCTION public.cron_demo(label text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE t timestamptz := clock_timestamp();
BEGIN
  PERFORM pg_sleep(2);
  INSERT INTO public.cron_demo_runs(label, pid, started, finished)
  VALUES (label, pg_backend_pid(), t, clock_timestamp());
END $$;""")
 capture('register',"""SELECT name, cron.schedule(name, '1 second',
  format('SELECT public.cron_demo(%L)', name)) AS jobid
FROM (VALUES ('demo-a'), ('demo-b')) AS jobs(name);""")
 h.until(lambda:int(h.sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='pg_cron' AND wait_event='PgSleep'"))==2)
 capture('activity',"""SELECT pid, backend_type, application_name, state, wait_event
FROM pg_stat_activity
WHERE application_name IN ('pg_cron', 'pg_cron scheduler')
ORDER BY backend_type, pid;""")
 h.until(lambda:int(h.sql('SELECT count(*) FROM cron_demo_runs'))>=6,timeout=25)
 capture('cleanup',"SELECT cron.unschedule(jobid) FROM cron.job\nWHERE jobname IN ('demo-a', 'demo-b');")
 capture('runs',"""SELECT label, pid, to_char(started, 'HH24:MI:SS.MS') AS started,
       to_char(finished, 'HH24:MI:SS.MS') AS finished
FROM public.cron_demo_runs ORDER BY started, label;""")
 capture('overlap',"""SELECT count(*) FILTER (WHERE a.label = b.label) AS same_job_overlaps,
       count(*) FILTER (WHERE a.label <> b.label) AS other_job_overlaps
FROM cron_demo_runs a JOIN cron_demo_runs b
  ON a.id < b.id
 AND tstzrange(a.started, a.finished, '[)')
     && tstzrange(b.started, b.finished, '[)');""")
 capture('peak',"""SELECT max(concurrent_jobs) AS peak_jobs
FROM (
  SELECT a.id, count(*) AS concurrent_jobs
  FROM cron_demo_runs a JOIN cron_demo_runs b
    ON b.started <= a.started AND a.started < b.finished
  GROUP BY a.id
) AS observations;""")
 assert h.sql("SELECT count(*) FROM cron_demo_runs a JOIN cron_demo_runs b ON a.id<b.id AND a.label=b.label AND tstzrange(a.started,a.finished,'[)') && tstzrange(b.started,b.finished,'[)')")=='0'
 assert h.sql(blocks['peak']['sql']) == '2'
 assert int(h.sql("SELECT count(*) FROM cron_demo_runs a JOIN cron_demo_runs b ON a.id<b.id AND a.label<>b.label AND tstzrange(a.started,a.finished,'[)') && tstzrange(b.started,b.finished,'[)')")) > 0
 data={'note':'PostgreSQL 16 / pg_cron 1.6.8 · libpq · cron.max_running_jobs=4 · 2026-09-15 · 별도 임시 DB 실측. PID·시각·회차 수는 실행마다 달라진다.','blocks':blocks}
 (root/'web/src/data/cron-concurrency-demo.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 print('PASS: same-job overlaps=0, peak jobs=2')
finally:h.down()
