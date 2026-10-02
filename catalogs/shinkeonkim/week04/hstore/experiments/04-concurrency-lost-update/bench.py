#!/usr/bin/env python3
"""실험 04 — 같은 hstore 행을 동시에 갱신하면 어떻게 되나.

클라이언트 8개가 같은 행(id=1 또는 id=2)에 각자 50번 갱신한다(총 400번).

키 추가 시나리오(같은 행에 서로 다른 키 400개를 넣는다. 기대: 키 400개)
  rmw_autocommit        앱이 SELECT로 읽고 값을 합쳐 UPDATE 한다 (ORM의 load → modify → save)
  rmw_read_committed    같은 일을 한 트랜잭션(READ COMMITTED) 안에서 한다
  rmw_for_update        SELECT ... FOR UPDATE 후 UPDATE
  atomic_concat         UPDATE ... SET attrs = attrs || hstore(k, v)
  atomic_repeatable_read  atomic_concat 을 REPEATABLE READ 로

카운터 시나리오(키 하나 'cnt' 를 400번 올린다. 기대: 400)
  counter_rmw / counter_atomic / counter_for_update / counter_atomic_repeatable_read

마지막으로 경합 실험: 갱신 대상 행이 1개일 때와 1000개일 때의 처리량을 클라이언트 수별로 잰다.
"""
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, scalar, pgbench, environment, save

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
REPETITIONS = int(os.environ.get('REPETITIONS', '10'))
RESULTS.mkdir(parents=True, exist_ok=True)

CLIENTS = 8
PER_CLIENT = 50
EXPECTED = CLIENTS * PER_CLIENT

KEY_ADD = {
    'rmw_autocommit': """
SELECT nextval('k_seq') AS n \\gset
SELECT attrs AS old FROM doc WHERE id = 1 \\gset
UPDATE doc SET attrs = ':old'::hstore || hstore('k' || :n, 'v') WHERE id = 1;
""",
    'rmw_read_committed': """
SELECT nextval('k_seq') AS n \\gset
BEGIN;
SELECT attrs AS old FROM doc WHERE id = 1 \\gset
UPDATE doc SET attrs = ':old'::hstore || hstore('k' || :n, 'v') WHERE id = 1;
COMMIT;
""",
    'rmw_for_update': """
SELECT nextval('k_seq') AS n \\gset
BEGIN;
SELECT attrs AS old FROM doc WHERE id = 1 FOR UPDATE \\gset
UPDATE doc SET attrs = ':old'::hstore || hstore('k' || :n, 'v') WHERE id = 1;
COMMIT;
""",
    'atomic_concat': """
SELECT nextval('k_seq') AS n \\gset
UPDATE doc SET attrs = attrs || hstore('k' || :n, 'v') WHERE id = 1;
""",
    'atomic_repeatable_read': """
SELECT nextval('k_seq') AS n \\gset
BEGIN ISOLATION LEVEL REPEATABLE READ;
UPDATE doc SET attrs = attrs || hstore('k' || :n, 'v') WHERE id = 1;
COMMIT;
""",
}

COUNTER = {
    'counter_rmw': """
SELECT (attrs -> 'cnt')::int AS c FROM doc WHERE id = 2 \\gset
UPDATE doc SET attrs = attrs || hstore('cnt', (:c + 1)::text) WHERE id = 2;
""",
    'counter_atomic': """
UPDATE doc SET attrs = attrs || hstore('cnt', ((attrs -> 'cnt')::int + 1)::text) WHERE id = 2;
""",
    'counter_for_update': """
BEGIN;
SELECT (attrs -> 'cnt')::int AS c FROM doc WHERE id = 2 FOR UPDATE \\gset
UPDATE doc SET attrs = attrs || hstore('cnt', (:c + 1)::text) WHERE id = 2;
COMMIT;
""",
    'counter_atomic_repeatable_read': """
BEGIN ISOLATION LEVEL REPEATABLE READ;
UPDATE doc SET attrs = attrs || hstore('cnt', ((attrs -> 'cnt')::int + 1)::text) WHERE id = 2;
COMMIT;
""",
}


def reset():
    sql("""
    DROP TABLE IF EXISTS doc; DROP SEQUENCE IF EXISTS k_seq;
    CREATE TABLE doc (id int PRIMARY KEY, attrs hstore NOT NULL);
    INSERT INTO doc VALUES (1, ''), (2, 'cnt=>0');
    CREATE SEQUENCE k_seq;
    """)


def run_key_add(name):
    reset()
    bench = pgbench(KEY_ADD[name], clients=CLIENTS, transactions=PER_CLIENT)
    keys = int(scalar("SELECT count(*) FROM each((SELECT attrs FROM doc WHERE id = 1))"))
    ok = bench['processed']
    return {'attempted': EXPECTED, 'succeeded': ok, 'failed': bench['failed'],
            'serialization_failures': bench['serialization_failures'],
            'keys_present': keys, 'lost_updates': ok - keys, 'tps': bench['tps']}


def run_counter(name):
    reset()
    bench = pgbench(COUNTER[name], clients=CLIENTS, transactions=PER_CLIENT)
    final = int(scalar("SELECT (attrs -> 'cnt')::int FROM doc WHERE id = 2"))
    ok = bench['processed']
    return {'attempted': EXPECTED, 'succeeded': ok, 'failed': bench['failed'],
            'serialization_failures': bench['serialization_failures'],
            'final_value': final, 'lost_increments': ok - final, 'tps': bench['tps']}


def run_contention(target_rows, clients, seconds=4):
    sql(f"""
    DROP TABLE IF EXISTS hot;
    CREATE TABLE hot (id int PRIMARY KEY, attrs hstore NOT NULL);
    INSERT INTO hot SELECT i, 'cnt=>0' FROM generate_series(1, {target_rows}) i;
    """)
    script = f"""
\\set rid random(1, {target_rows})
UPDATE hot SET attrs = attrs || hstore('cnt', ((attrs -> 'cnt')::int + 1)::text) WHERE id = :rid;
"""
    bench = pgbench(script, clients=clients, seconds=seconds)
    total = int(scalar('SELECT sum((attrs -> \'cnt\')::int) FROM hot'))
    assert total == bench['processed'], (total, bench)       # 원자적 갱신이므로 유실이 없어야 한다
    return {'tps': bench['tps'], 'latency_ms': bench['latency_ms'], 'processed': bench['processed']}


for repetition in range(1, REPETITIONS + 1):
    try:
        up()
        env = environment()
        result = {'key_add': {}, 'counter': {}, 'contention': {}}
        for name in KEY_ADD:
            result['key_add'][name] = run_key_add(name)
        for name in COUNTER:
            result['counter'][name] = run_counter(name)
        for rows_ in (1, 1000):
            for clients in (1, 2, 4, 8, 16):
                result['contention'][f'rows{rows_}_clients{clients}'] = run_contention(rows_, clients)
        # 보장이 있어야 하는 시나리오는 어떤 회차에서도 유실이 없어야 한다
        for name in ('atomic_concat', 'rmw_for_update'):
            assert result['key_add'][name]['lost_updates'] == 0, (name, result['key_add'][name])
        for name in ('counter_atomic', 'counter_for_update', 'counter_atomic_repeatable_read'):
            assert result['counter'][name]['lost_increments'] == 0, (name, result['counter'][name])
        save(RESULTS / f'{repetition}.json', {'environment': env, 'repetition': repetition, 'clients': CLIENTS,
                                               'per_client': PER_CLIENT, **result})
        ka = result['key_add']
        print(f"run {repetition}: keys(rmw_autocommit)={ka['rmw_autocommit']['keys_present']}/{EXPECTED} "
              f"rmw_rc={ka['rmw_read_committed']['keys_present']} for_update={ka['rmw_for_update']['keys_present']} "
              f"atomic={ka['atomic_concat']['keys_present']} RR ok={ka['atomic_repeatable_read']['succeeded']}", flush=True)
    finally:
        down()
