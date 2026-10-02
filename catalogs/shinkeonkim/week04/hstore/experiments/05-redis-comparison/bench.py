#!/usr/bin/env python3
"""실험 05 — hstore 행 vs Redis Hash: 같은 일을 시켰을 때.

객체 5만 개 × 필드 20개. 연산 3가지(필드 하나 쓰기 / 읽기 / 카운터 증가)를 클라이언트 1개와 8개로 잰다.
내구성 수준을 맞춰 세 쌍으로 비교한다.

  none    Redis: 영속화 없음                      PG: UNLOGGED 테이블 (WAL 없음)
  relaxed Redis: AOF appendfsync everysec         PG: synchronous_commit=off
  strict  Redis: AOF appendfsync always           PG: synchronous_commit=on (기본)

클라이언트는 각 서버 컨테이너 안에서 실행한다(pgbench, redis-benchmark). 둘 다 같은 Docker VM의 CPU를 쓰며,
서버는 한 번에 하나씩만 부하를 받는다. PG는 -M prepared 로 접속 후 문장 준비 비용을 뺀다.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import (up, down, sql, scalar, pgbench, redis_cli, redis_benchmark, environment, save,
                     _compose)

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
REPETITIONS = int(os.environ.get('REPETITIONS', '5'))
RESULTS.mkdir(parents=True, exist_ok=True)

OBJECTS = 50_000
FIELDS = 20
SECONDS = 4
REDIS_REQUESTS = 200_000

CONFIGS = {
    'none':    dict(sync_commit='on',  aof='no',  fsync='everysec', unlogged=True),
    'relaxed': dict(sync_commit='off', aof='yes', fsync='everysec', unlogged=False),
    'strict':  dict(sync_commit='on',  aof='yes', fsync='always',   unlogged=False),
}


def value(i, f):
    import hashlib
    return hashlib.md5(f'{i}:{f}'.encode()).hexdigest()[:12]


def load_pg(unlogged):
    sql(f"""
    DROP TABLE IF EXISTS kv;
    CREATE {'UNLOGGED ' if unlogged else ''}TABLE kv (id int PRIMARY KEY, attrs hstore NOT NULL);
    INSERT INTO kv
    SELECT i, hstore(
        ARRAY(SELECT 'f' || lpad(f::text, 2, '0') FROM generate_series(1, {FIELDS}) f),
        ARRAY(SELECT substr(md5(i::text || ':' || f::text), 1, 12) FROM generate_series(1, {FIELDS}) f))
    FROM generate_series(0, {OBJECTS - 1}) i;
    VACUUM (ANALYZE) kv;
    """)


def resp(*parts):
    out = [f'*{len(parts)}\r\n']
    for p in parts:
        p = str(p)
        out.append(f'${len(p.encode())}\r\n{p}\r\n')
    return ''.join(out)


def load_redis():
    redis_cli('FLUSHALL')
    base = int(redis_info('used_memory'))
    lines = []
    for i in range(OBJECTS):
        args = ['HSET', f'h:{i:012d}']
        for f in range(1, FIELDS + 1):
            args += [f'f{f:02d}', value(i, f)]
        lines.append(resp(*args))
    payload = ''.join(lines)
    proc = _compose('exec', '-T', 'redis', 'redis-cli', '--pipe', input=payload, text=True, capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr)
    dbsize = int(redis_cli('DBSIZE'))
    assert dbsize == OBJECTS, dbsize
    return int(redis_info('used_memory')) - base


def redis_info(field):
    for line in redis_cli('INFO', 'memory').splitlines():
        if line.startswith(field + ':'):
            return line.split(':')[1].strip()
    raise KeyError(field)


def pg_ops():
    rid = f'\\set rid random(0, {OBJECTS - 1})\n'
    return {
        'write_one_field': rid + "UPDATE kv SET attrs = attrs || hstore('f05', 'v12345678') WHERE id = :rid;\n",
        'read_one_field': rid + "SELECT attrs -> 'f05' FROM kv WHERE id = :rid;\n",
        'increment_counter': rid + "UPDATE kv SET attrs = attrs || hstore('cnt', (coalesce((attrs -> 'cnt')::int, 0) + 1)::text) WHERE id = :rid;\n",
    }


REDIS_OPS = {
    'write_one_field': ['HSET', 'h:__rand_int__', 'f05', 'v12345678'],
    'read_one_field': ['HGET', 'h:__rand_int__', 'f05'],
    'increment_counter': ['HINCRBY', 'h:__rand_int__', 'cnt', '1'],
}


def measure(cfg):
    out = {'postgres': {}, 'redis': {}}
    ops = pg_ops()
    for op, script in ops.items():
        for clients in (1, 8):
            r = pgbench(script, clients=clients, seconds=SECONDS, extra=('-M', 'prepared'))
            assert r['failed'] == 0, r
            out['postgres'][f'{op}_c{clients}'] = {'ops_per_sec': r['tps'], 'avg_ms': r['latency_ms']}
    for op, cmd in REDIS_OPS.items():
        for clients in (1, 8):
            r = redis_benchmark('-h', '127.0.0.1', '-c', str(clients), '-n', str(REDIS_REQUESTS),
                                '-r', str(OBJECTS), *cmd)
            out['redis'][f'{op}_c{clients}'] = {'ops_per_sec': r['rps'], 'avg_ms': r['avg_ms'], 'p99_ms': r['p99_ms']}
    return out


for repetition in range(1, REPETITIONS + 1):
    result = {'configs': {}}
    for name, cfg in CONFIGS.items():
        try:
            up(redis=True, sync_commit=cfg['sync_commit'], aof=cfg['aof'], fsync=cfg['fsync'])
            env = environment(redis=True)
            env['redis_appendonly'] = redis_cli('CONFIG', 'GET', 'appendonly').splitlines()[-1]
            env['redis_appendfsync'] = redis_cli('CONFIG', 'GET', 'appendfsync').splitlines()[-1]
            save_lines = redis_cli('CONFIG', 'GET', 'save').splitlines()
            env['redis_save'] = save_lines[1] if len(save_lines) > 1 else ''
            load_pg(cfg['unlogged'])
            redis_bytes = load_redis()
            pg_bytes = int(scalar("SELECT pg_total_relation_size('kv')"))
            measured = measure(cfg)
            measured['memory'] = {'redis_dataset_bytes': redis_bytes, 'postgres_total_bytes': pg_bytes,
                                  'postgres_avg_hstore_bytes': int(scalar('SELECT round(avg(pg_column_size(attrs))) FROM kv'))}
            measured['environment'] = env
            result['configs'][name] = measured
        finally:
            down()
    save(RESULTS / f'{repetition}.json', {'repetition': repetition, 'objects': OBJECTS, 'fields': FIELDS, **result})
    line = ', '.join(
        f"{n}: write c8 pg={c['postgres']['write_one_field_c8']['ops_per_sec']:.0f}/s redis={c['redis']['write_one_field_c8']['ops_per_sec']:.0f}/s"
        for n, c in result['configs'].items())
    print(f'run {repetition}: {line}', flush=True)
