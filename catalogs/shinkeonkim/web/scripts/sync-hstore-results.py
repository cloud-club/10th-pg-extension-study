#!/usr/bin/env python3
"""hstore 실험 5종의 회차별 결과(week04/hstore/experiments/*/results)를 웹 요약으로 게시한다.

    python3 scripts/sync-hstore-results.py           # 로컬 결과를 읽어 src/data/hstore-experiments.json 갱신
    python3 scripts/sync-hstore-results.py --check   # 게시된 요약의 반복 수와 필수 필드 검사

요약에는 중앙값·최소·최대와 회차 수만 넣는다. 추정값이나 기대값은 넣지 않는다.
"""
import json
from pathlib import Path
import statistics
import sys

WEB = Path(__file__).resolve().parents[1]
EXPERIMENTS = WEB.parent / 'week04/hstore/experiments'
TARGET = WEB / 'src/data/hstore-experiments.json'

MIN_RUNS = {'storage': 3, 'update': 5, 'index': 5, 'concurrency': 10, 'redis': 5}


def spread(values):
    values = [v for v in values if v is not None]
    return {'median': statistics.median(values), 'min': min(values), 'max': max(values)}


def load(directory):
    paths = sorted((EXPERIMENTS / directory / 'results').glob('[0-9]*.json'), key=lambda p: int(p.stem))
    if not paths:
        raise SystemExit(f'{directory}/results 가 없다. 해당 실험의 bench.py를 먼저 실행하세요.')
    return [json.loads(p.read_text()) for p in paths]


def summarize_storage(runs):
    first = runs[0]['cells']
    cells = []
    for i, cell in enumerate(first):
        # 크기 지표는 결정적이어야 한다: 모든 회차가 같은 값이어야 게시한다
        for run in runs[1:]:
            other = run['cells'][i]
            for kind in ('hs', 'jb'):
                for field in ('avg_column_bytes', 'heap_bytes', 'toast_bytes', 'total_bytes'):
                    assert other[kind][field] == cell[kind][field], (i, kind, field)
        cells.append(cell)
    return {'runs': len(runs), 'deterministic': True, 'cells': cells}


def summarize_update(runs):
    out = {'runs': len(runs), 'rows': runs[0]['rows'], 'cases': {}}
    for k in runs[0]['cases']:
        item = {}
        for case, first in runs[0]['cases'][k].items():
            if case == 'hstore_avg_column_bytes':
                item[case] = first
            elif case == 'read_ms_1000_rows':
                item[case] = {name: spread([r['cases'][k][case][name] for r in runs]) for name in first}
            else:
                item[case] = {
                    'wal_bytes_per_update': spread([r['cases'][k][case]['wal_bytes_per_update'] for r in runs]),
                    'heap_growth_bytes': spread([r['cases'][k][case]['heap_growth_bytes'] for r in runs]),
                    'toast_growth_bytes': spread([r['cases'][k][case]['toast_growth_bytes'] for r in runs]),
                    'hot_ratio': spread([r['cases'][k][case]['hot_ratio'] for r in runs]),
                    'seconds_per_1000_updates': spread([r['cases'][k][case]['seconds_per_1000_updates'] for r in runs]),
                }
        out['cases'][k] = item
    return out


def summarize_index(runs):
    first = runs[0]
    out = {'runs': len(runs), 'rows': first['rows'], 'insert_rows': first['insert_rows'],
           'base': first['base'], 'queries': first['queries'], 'configs': {}}
    for name, cfg in first['configs'].items():
        item = {
            'index_bytes': spread([r['configs'][name]['index_bytes'] for r in runs]),
            'build_seconds': spread([r['configs'][name]['build_seconds'] for r in runs]),
            'insert_seconds': spread([r['configs'][name]['insert_seconds'] for r in runs]),
            'insert_wal_bytes': spread([r['configs'][name]['insert_wal_bytes'] for r in runs]),
            'queries': {},
        }
        for q, first_q in cfg['queries'].items():
            plans = {' > '.join(r['configs'][name]['queries'][q]['plan']) for r in runs}
            item['queries'][q] = {
                'rows': first_q['rows'],
                'ms': spread([r['configs'][name]['queries'][q]['ms'] for r in runs]),
                'recheck_removed': spread([r['configs'][name]['queries'][q]['recheck_removed'] for r in runs]),
                'plans': sorted(plans),
            }
        out['configs'][name] = item
    return out


def summarize_concurrency(runs):
    first = runs[0]
    out = {'runs': len(runs), 'clients': first['clients'], 'per_client': first['per_client'],
           'key_add': {}, 'counter': {}, 'contention': {}}
    for name in first['key_add']:
        rows = [r['key_add'][name] for r in runs]
        out['key_add'][name] = {
            'attempted': rows[0]['attempted'],
            'succeeded': spread([r['succeeded'] for r in rows]),
            'failed': spread([r['failed'] for r in rows]),
            'keys_present': spread([r['keys_present'] for r in rows]),
            'lost_updates': spread([r['lost_updates'] for r in rows]),
            'runs_with_loss': sum(r['lost_updates'] > 0 for r in rows),
            'tps': spread([r['tps'] for r in rows]),
        }
    for name in first['counter']:
        rows = [r['counter'][name] for r in runs]
        out['counter'][name] = {
            'attempted': rows[0]['attempted'],
            'succeeded': spread([r['succeeded'] for r in rows]),
            'failed': spread([r['failed'] for r in rows]),
            'final_value': spread([r['final_value'] for r in rows]),
            'lost_increments': spread([r['lost_increments'] for r in rows]),
            'runs_with_loss': sum(r['lost_increments'] > 0 for r in rows),
            'tps': spread([r['tps'] for r in rows]),
        }
    for name in first['contention']:
        rows = [r['contention'][name] for r in runs]
        out['contention'][name] = {'tps': spread([r['tps'] for r in rows]),
                                   'latency_ms': spread([r['latency_ms'] for r in rows])}
    return out


def summarize_redis(runs):
    first = runs[0]
    out = {'runs': len(runs), 'objects': first['objects'], 'fields': first['fields'], 'configs': {}}
    for cfg, data in first['configs'].items():
        item = {'environment': data['environment'], 'postgres': {}, 'redis': {}, 'memory': {}}
        for side in ('postgres', 'redis'):
            for op in data[side]:
                item[side][op] = {
                    'ops_per_sec': spread([r['configs'][cfg][side][op]['ops_per_sec'] for r in runs]),
                    'avg_ms': spread([r['configs'][cfg][side][op]['avg_ms'] for r in runs]),
                }
        for field in data['memory']:
            item['memory'][field] = spread([r['configs'][cfg]['memory'][field] for r in runs])
        out['configs'][cfg] = item
    return out


def validate(data):
    for key, minimum in MIN_RUNS.items():
        assert data[key]['runs'] >= minimum, f'{key}: 반복 {data[key]["runs"]}회 < 최소 {minimum}회'
    assert {'postgres', 'hstore_version', 'cpu_count'} <= data['environment'].keys()
    assert data['environment']['hstore_version'] == '1.8'
    conc = data['concurrency']
    for name in ('atomic_concat', 'rmw_for_update'):
        assert conc['key_add'][name]['lost_updates']['max'] == 0, name
    assert conc['key_add']['rmw_autocommit']['runs_with_loss'] > 0
    for name in ('counter_atomic', 'counter_for_update', 'counter_atomic_repeatable_read'):
        assert conc['counter'][name]['lost_increments']['max'] == 0, name
    assert set(data['redis']['configs']) == {'none', 'relaxed', 'strict'}


if '--check' in sys.argv:
    validate(json.loads(TARGET.read_text()))
    print('hstore 웹 실험 요약의 반복 수와 필수 필드가 유효합니다')
    raise SystemExit(0)

storage, update, index, concurrency, redis = (load(d) for d in (
    '01-storage-footprint', '02-update-write-amplification', '03-index-and-query',
    '04-concurrency-lost-update', '05-redis-comparison'))
data = {
    'environment': {**concurrency[0]['environment'],
                    'redis': redis[0]['configs']['none']['environment'].get('redis'),
                    'note': 'Docker Desktop(macOS) 위의 Linux VM, 공유 CPU 3개. 절대 수치는 이 환경에서만 의미가 있다.'},
    'storage': summarize_storage(storage),
    'update': summarize_update(update),
    'index': summarize_index(index),
    'concurrency': summarize_concurrency(concurrency),
    'redis': summarize_redis(redis),
}
validate(data)
TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print(f'게시: {TARGET.relative_to(WEB.parent)}  '
      f'(storage {data["storage"]["runs"]} · update {data["update"]["runs"]} · index {data["index"]["runs"]} · '
      f'concurrency {data["concurrency"]["runs"]} · redis {data["redis"]["runs"]}회)')
