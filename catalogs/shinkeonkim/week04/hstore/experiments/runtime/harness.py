"""hstore 실험용 Docker 런타임. 표준 라이브러리만 사용한다.

모든 실험은 `up()`으로 새 컨테이너와 새 볼륨을 만들고 `down()`으로 지운다.
SQL은 컨테이너 안의 psql로, 부하는 컨테이너 안의 pgbench·redis-benchmark로 실행한다.
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
    return subprocess.run(COMPOSE + ['--profile', 'redis'] + list(args), env=env, **kw)


def sql(statement, db='study'):
    """SQL을 실행하고 stdout을 돌려준다. 실패하면 stderr와 함께 예외."""
    cmd = list(PSQL)
    cmd[cmd.index('study')] = db
    proc = _compose('exec', '-T', 'postgres', *cmd, input=statement, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout.strip()


def rows(query):
    """SELECT 결과를 dict 목록으로."""
    return json.loads(sql(f"SELECT coalesce(json_agg(t), '[]'::json) FROM ({query}) t;"))


def scalar(query):
    return sql(query).splitlines()[-1]


def up(*, redis=False, sync_commit='on', aof='no', fsync='everysec', extension=True):
    env = dict(os.environ, PG_SYNC_COMMIT=sync_commit, REDIS_AOF=aof, REDIS_FSYNC=fsync)
    services = ['postgres'] + (['redis'] if redis else [])
    _compose('up', '-d', '--build', '--force-recreate', '--wait', *services, env=env, check=True,
             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if extension:
        sql('CREATE EXTENSION hstore;')


def down():
    _compose('down', '--volumes', '--remove-orphans', check=True,
             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def put_file(service, path, content):
    proc = _compose('exec', '-T', service, 'sh', '-c', f'cat > {path}', input=content, text=True,
                    capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)


def pgbench(script, *, clients=1, seconds=None, transactions=None, extra=(), init_sql=None):
    """pgbench 커스텀 스크립트를 실행하고 요약을 파싱한다.

    script 는 pgbench 스크립트 문자열이다. 서버는 컨테이너 안이라 소켓이 아닌 TCP 루프백으로 붙는다.
    """
    put_file('postgres', '/tmp/bench.sql', script)
    cmd = ['pgbench', '-n', '-h', '127.0.0.1', '-U', 'postgres', '-f', '/tmp/bench.sql',
           '-c', str(clients), '-j', str(min(clients, 4)), '--failures-detailed', '--max-tries=1']
    cmd += ['-T', str(seconds)] if seconds else ['-t', str(transactions)]
    cmd += list(extra) + ['study']
    proc = _compose('exec', '-T', '-e', 'PGPASSWORD=experiment-only', 'postgres', *cmd,
                    text=True, capture_output=True)
    out = proc.stdout + proc.stderr
    if proc.returncode and 'number of transactions actually processed' not in out:
        raise RuntimeError(out)

    def grab(pattern, cast=float, default=None):
        m = re.search(pattern, out)
        return cast(m.group(1)) if m else default

    result = {
        'tps': grab(r'tps = ([\d.]+)'),
        'latency_ms': grab(r'latency average = ([\d.]+) ms'),
        'processed': grab(r'number of transactions actually processed: (\d+)', int, 0),
        'failed': grab(r'number of failed transactions: (\d+)', int, 0),
        'serialization_failures': grab(r'number of serialization failures: (\d+)', int, 0),
        'deadlock_failures': grab(r'number of deadlock failures: (\d+)', int, 0),
    }
    # 스크립트 오류(문법·변수 오류)는 실패 거래로 세어지지 않고 그냥 0건 처리된다. 조용히 넘기지 않는다.
    if result['processed'] == 0 and result['failed'] == 0:
        raise RuntimeError('pgbench가 거래를 하나도 처리하지 못했다:\n' + out[-800:])
    return result


def redis_cli(*args):
    proc = _compose('exec', '-T', 'redis', 'redis-cli', *args, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    return proc.stdout.strip()


def redis_benchmark(*args):
    """redis-benchmark를 CSV로 실행하고 (rps, avg_ms) 를 돌려준다."""
    proc = _compose('exec', '-T', 'redis', 'redis-benchmark', '--csv', *args, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr + proc.stdout)
    line = [l for l in proc.stdout.splitlines() if l.startswith('"')][-1]
    cells = [c.strip('"') for c in line.split('","')]
    # CSV: test,rps,avg_latency_ms,min,p50,p95,p99,max
    return {'rps': float(cells[1]), 'avg_ms': float(cells[2]), 'p99_ms': float(cells[6])}


def environment(redis=False):
    env = {
        'postgres': scalar('SELECT version();'),
        'hstore_version': scalar("SELECT extversion FROM pg_extension WHERE extname='hstore';"),
        'synchronous_commit': scalar('SHOW synchronous_commit;'),
        'shared_buffers': scalar('SHOW shared_buffers;'),
        'cpu_count': _compose('exec', '-T', 'postgres', 'nproc', text=True, capture_output=True).stdout.strip(),
        'toast_compression': scalar('SHOW default_toast_compression;'),
    }
    if redis:
        info = _compose('exec', '-T', 'redis', 'redis-server', '--version', text=True, capture_output=True).stdout
        env['redis'] = info.strip()
    return env


def median(values):
    return statistics.median(values)


def summarize(values):
    values = list(values)
    return {'median': statistics.median(values), 'min': min(values), 'max': max(values), 'runs': len(values)}


def until(predicate, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(.25)
    raise RuntimeError('observation timed out')


def save(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
