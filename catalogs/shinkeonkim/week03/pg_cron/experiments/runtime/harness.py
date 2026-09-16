"""Isolated Docker runtime; standard-library-only experiment helpers."""
import json
import os
from pathlib import Path
import subprocess
import time

HERE = Path(__file__).resolve().parent
COMPOSE = ['docker', 'compose', '-f', str(HERE / 'compose.yaml')]


def sql(statement):
    proc = subprocess.run(COMPOSE + ['exec', '-T', 'postgres', 'psql', '-X', '-qAt',
        '-U', 'postgres', '-d', 'study', '-v', 'ON_ERROR_STOP=1'],
        input=statement, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout.strip()


def rows(query):
    return json.loads(sql(f"SELECT coalesce(json_agg(t), '[]'::json) FROM ({query}) t;"))


def up(capacity=4):
    env = dict(os.environ, CRON_CAPACITY=str(capacity))
    subprocess.run(COMPOSE + ['up', '-d', '--build', '--force-recreate', '--wait'],
                   env=env, check=True)
    sql('CREATE EXTENSION pg_cron;')


def down():
    subprocess.run(COMPOSE + ['down', '--volumes'], check=True)


def environment():
    return {'postgres': sql('SELECT version();'),
            'extension_sql_version': sql("SELECT extversion FROM pg_extension WHERE extname='pg_cron';"),
            'package': subprocess.check_output(COMPOSE + ['exec', '-T', 'postgres',
                'dpkg-query', '-W', 'postgresql-16-cron'], text=True).strip(),
            'capacity': sql('SHOW cron.max_running_jobs;'),
            'mode': sql('SHOW cron.use_background_workers;'),
            'cpu_count': subprocess.check_output(COMPOSE + ['exec', '-T', 'postgres', 'nproc'], text=True).strip(),
            'image_id': subprocess.check_output(COMPOSE + ['images', '-q', 'postgres'], text=True).strip()}


def until(predicate, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(.25)
    raise RuntimeError('observation timed out')


def save(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
