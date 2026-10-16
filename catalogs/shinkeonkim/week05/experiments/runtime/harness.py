"""pgvector·pgvectorscale 실험용 Docker 런타임. 표준 라이브러리만 사용한다.

week04/hstore/experiments/runtime/harness.py 와 같은 패턴이다.
모든 실험은 up()으로 새 컨테이너와 새 볼륨을 만들고 down()으로 지운다.
"""
import json
import os
from pathlib import Path
import re
import statistics
import subprocess
import time

HERE = Path(__file__).resolve().parent
COMPOSE = ['docker', 'compose', '-f', str(HERE / 'compose.yaml')]
PSQL = ['psql', '-X', '-qAt', '-U', 'postgres', '-d', 'study', '-v', 'ON_ERROR_STOP=1']


def _compose(*args, env=None, **kw):
    return subprocess.run(COMPOSE + list(args), env=env, **kw)


def sql(statement, db='study'):
    """SQL을 실행하고 stdout을 돌려준다. 실패하면 stderr와 함께 예외."""
    cmd = list(PSQL)
    cmd[cmd.index('study')] = db
    proc = _compose('exec', '-T', 'postgres', *cmd, input=statement, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout.strip()


def sql_raw(statement, db='study'):
    """-qAt 없이 실행해 NOTICE/일반 psql 출력을 그대로 돌려준다 (stdout+stderr 합침)."""
    cmd = ['psql', '-X', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1']
    proc = _compose('exec', '-T', 'postgres', *cmd, input=statement, text=True, capture_output=True)
    out = proc.stdout + proc.stderr
    if proc.returncode:
        raise RuntimeError(out)
    return out


def rows(query):
    """SELECT 결과를 dict 목록으로."""
    return json.loads(sql(f"SELECT coalesce(json_agg(t), '[]'::json) FROM ({query}) t;"))


def scalar(query):
    return sql(query).splitlines()[-1]


def timed_sql(statement, db='study'):
    """statement 실행 시간을 벽시계로 재서 (결과, 초)를 돌려준다. EXPLAIN ANALYZE 와는 별개 측정."""
    t0 = time.monotonic()
    out = sql_raw(statement, db)
    return out, time.monotonic() - t0


def up(*, extensions=('vector', 'vectorscale CASCADE')):
    _compose('up', '-d', '--force-recreate', '--wait', 'postgres', check=True,
             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for ext in extensions:
        sql(f'CREATE EXTENSION IF NOT EXISTS {ext};')


def down():
    _compose('down', '--volumes', '--remove-orphans', check=True,
             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def environment():
    return {
        'postgres': scalar('SELECT version();'),
        'vector_version': scalar("SELECT extversion FROM pg_extension WHERE extname='vector';"),
        'vectorscale_version': scalar("SELECT extversion FROM pg_extension WHERE extname='vectorscale';"),
        'shared_buffers': scalar('SHOW shared_buffers;'),
        'maintenance_work_mem': scalar('SHOW maintenance_work_mem;'),
        'cpu_count': _compose('exec', '-T', 'postgres', 'nproc', text=True, capture_output=True).stdout.strip(),
        'mem_total': _compose('exec', '-T', 'postgres', 'sh', '-c', 'grep MemTotal /proc/meminfo',
                               text=True, capture_output=True).stdout.strip(),
    }


def table_size_mb(table, index=None):
    if index:
        return float(scalar(f"SELECT round(pg_relation_size('{index}') / 1024.0 / 1024.0, 2);"))
    return float(scalar(f"SELECT round(pg_total_relation_size('{table}') / 1024.0 / 1024.0, 2);"))


def summarize(values):
    values = list(values)
    return {'median': statistics.median(values), 'min': min(values), 'max': max(values), 'runs': len(values)}


def save(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
