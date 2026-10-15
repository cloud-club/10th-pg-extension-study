#!/usr/bin/env python3
"""실험 04 — DiskANN `storage_layout=plain` 빌드가 죽는 지점은 어디인가.

실험 03에서 51,000행·128차원 `plain` 빌드가 이 환경(RAM 3.8GiB)에서 서버를 죽였다.
그 원인을 "메모리 부족일 것"이라고 추정만 하고 넘어갔다 - 이 실험은 그 추정을 좁혀본다:
① 행 수를 줄여가며 어디서부터 죽지 않는지 찾고, ② `maintenance_work_mem`을 올리면
(총 컨테이너 메모리는 그대로 두고) 더 큰 행 수에서도 완주하는지 봐서, 병목이
`maintenance_work_mem` 설정값인지 아니면 컨테이너 전체 메모리(3.8GiB)인지 구분한다.
"""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'runtime'))
from harness import up, down, sql, sql_raw, scalar, environment, save, _compose

HERE = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('RESULTS_DIR', str(HERE / 'results')))
RESULTS.mkdir(parents=True, exist_ok=True)

DIM = 128
CONTAINER = 'pgvector-week05-research-postgres-1'


def generate(n):
    sql('SET max_parallel_workers_per_gather = 0; SELECT setseed(0.1);'
        ' DROP TABLE IF EXISTS t;'
        ' CREATE TABLE t (id bigserial PRIMARY KEY, embedding vector(128));'
        f" INSERT INTO t (id, embedding) SELECT v, array_agg(random() ORDER BY d)::vector"
        f" FROM generate_series(1,{n}) v, generate_series(1,{DIM}) d GROUP BY v;")


def try_plain_build(maintenance_work_mem=None):
    """plain 빌드를 시도하고 (성공여부, peak_mem_mb, 메시지)를 돌려준다."""
    import subprocess
    import threading
    import time

    peak = {'mb': 0.0}
    stop = threading.Event()

    def poll():
        while not stop.is_set():
            try:
                out = subprocess.run(
                    ['docker', 'stats', CONTAINER, '--no-stream', '--format', '{{.MemUsage}}'],
                    capture_output=True, text=True, timeout=5).stdout.strip()
                mb = out.split('/')[0].strip()
                val = float(re.sub('[^0-9.]', '', mb))
                if 'GiB' in mb:
                    val *= 1024
                peak['mb'] = max(peak['mb'], val)
            except Exception:
                pass
            time.sleep(0.5)

    t = threading.Thread(target=poll, daemon=True)
    t.start()

    mwm_stmt = f"SET maintenance_work_mem = '{maintenance_work_mem}';" if maintenance_work_mem else ''
    try:
        sql_raw(f"LOAD 'vectorscale-0.9.1'; {mwm_stmt}"
                f" CREATE INDEX ON t USING diskann (embedding vector_l2_ops) WITH (storage_layout = plain);")
        ok, msg = True, 'OK'
    except RuntimeError as e:
        ok, msg = False, str(e)[-300:]
    finally:
        stop.set()
        t.join(timeout=2)

    return ok, peak['mb'], msg


def main():
    up()
    env = environment()
    results = {'environment': env, 'dim': DIM, 'bisection': [], 'mwm_sweep': []}

    # 1단계: 행 수 bisection (maintenance_work_mem=1GB, 기본값)
    for n in (30_000, 40_000, 45_000, 48_000, 51_000):
        generate(n)
        ok, peak_mb, msg = try_plain_build()
        row = {'n': n, 'maintenance_work_mem': '1GB', 'ok': ok, 'peak_container_mem_mb': round(peak_mb, 1), 'msg': msg if not ok else None}
        results['bisection'].append(row)
        print(row)
        save(RESULTS / 'run.json', results)
        if not ok:
            # 컨테이너가 죽었으면 다시 올려야 다음 행 수를 테스트할 수 있다
            down()
            up()

    # 2단계: 51,000행에서 maintenance_work_mem을 올리면 완주하는지 (컨테이너 총 메모리는 고정)
    for mwm in ('1GB', '2GB', '3GB'):
        generate(51_000)
        ok, peak_mb, msg = try_plain_build(maintenance_work_mem=mwm)
        row = {'n': 51_000, 'maintenance_work_mem': mwm, 'ok': ok, 'peak_container_mem_mb': round(peak_mb, 1), 'msg': msg if not ok else None}
        results['mwm_sweep'].append(row)
        print(row)
        save(RESULTS / 'run.json', results)
        if not ok:
            down()
            up()

    down()
    print('done ->', RESULTS / 'run.json')


if __name__ == '__main__':
    main()
