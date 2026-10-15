#!/usr/bin/env python3
"""pgvector·pgvectorscale 실험 7종의 결과(week05/experiments/*/results)를 웹 요약으로 게시한다.

    python3 scripts/sync-pgvector-results.py           # 로컬 결과를 읽어 src/data/pgvector-experiments.json 갱신
    python3 scripts/sync-pgvector-results.py --check   # 게시된 요약의 필수 필드와 반복 수 검사

값은 bench.py 가 남긴 JSON 을 그대로 옮긴다. 손으로 고친 값·추정값은 넣지 않는다.
실험 03 의 `plain` 항목처럼 측정 자체가 실패한 칸은 null 로 남는다 — 지우지 않는다.
"""
import json
from pathlib import Path
import sys

WEB = Path(__file__).resolve().parents[1]
EXPERIMENTS = WEB.parent / 'week05/experiments'
TARGET = WEB / 'src/data/pgvector-experiments.json'

DIRS = {
    'recall': '01-recall-vs-tuning',
    'build': '02-build-cost-and-size',
    'sbq': '03-sbq-compression',
    'plain_repro': '04-plain-build-memory-threshold',
    'halfvec': '05-halfvec-vs-sbq',
    'scale': '06-recall-at-scale',
    'filter': '07-filtered-search-cost',
}


def read(directory, name):
    path = EXPERIMENTS / directory / 'results' / name
    if not path.exists():
        raise SystemExit(f'{directory}/results/{name} 가 없다. 해당 실험의 bench.py 를 먼저 실행하세요.')
    return json.loads(path.read_text())


def environment(run):
    env = run['environment']
    return {
        'postgres': env['postgres'].split(' (')[0],
        'vector_version': env['vector_version'],
        'vectorscale_version': env['vectorscale_version'],
        'shared_buffers': env.get('shared_buffers'),
        'maintenance_work_mem': env.get('maintenance_work_mem'),
        'cpu_count': env.get('cpu_count', '3'),
    }


def recall():
    # 실험 01 은 같은 조건을 두 번 돌렸다: run1.json(1차) · run.json(2차)
    runs = [read(DIRS['recall'], 'run1.json'), read(DIRS['recall'], 'run.json')]
    configs = []
    for a, b in zip(runs[0]['configs'], runs[1]['configs']):
        assert a['config'] == b['config'], (a['config'], b['config'])
        configs.append({
            'config': a['config'], 'index': a['index'], 'param': a['param'], 'value': a['value'],
            'recall': [a['recall_at_10'], b['recall_at_10']],
            'buffers_per_query': [a['buffers_per_query'], b['buffers_per_query']],
            'ms_per_query': [a['per_query_ms'], b['per_query_ms']],
            'build_ms': [a['build_ms'], b['build_ms']],
            'index_mb': [a['index_mb'], b['index_mb']],
        })
    return {'runs': 2, 'n_vectors': runs[0]['n_vectors'] + 1000, 'dim': runs[0]['dim'],
            'n_queries': runs[0]['n_queries'], 'k': runs[0]['k'], 'configs': configs}


def build():
    run = read(DIRS['build'], 'run.json')
    return {'runs': 1, 'dim': run['dim'], 'rows': run['rows']}


def sbq():
    run = read(DIRS['sbq'], 'run.json')
    return {'runs': 1, 'n_vectors': run['n_vectors'] + 1000, 'search_list_size': run['search_list_size'],
            'configs': run['configs']}


def plain_repro():
    run = read(DIRS['plain_repro'], 'run.json')
    attempts = len(run['bisection']) + len(run['mwm_sweep']) + 1
    crashes = sum(not r['ok'] for r in run['bisection'] + run['mwm_sweep'])
    crashes += int(run['exp03_sequence_replication']['crash_reproduced'])
    return {'attempts': attempts, 'crashes': crashes, 'bisection': run['bisection'],
            'mwm_sweep': run['mwm_sweep'], 'sequence_replication': run['exp03_sequence_replication']}


def halfvec():
    run = read(DIRS['halfvec'], 'run.json')
    return {'runs': 1, 'n_vectors': run['n_vectors'] + 1000, 'table_mb': run['table_mb'], 'configs': run['configs']}


def scale():
    run = read(DIRS['scale'], 'run.json')
    return {'runs': 1, 'n_vectors': run['n_vectors'] + 1000, 'dim': run['dim'], 'configs': run['configs']}


def filtering():
    run = read(DIRS['filter'], 'run.json')
    keep = ('dim', 'n_labels', 'rows_per_label', 'k', 'n_queries', 'target_label', 'datasets')
    # 첫 판(서로 다른 벡터 10개 데이터)의 원본도 함께 싣는다 - 정정 기록용
    first = read(DIRS['filter'], 'run-duplicate-bug.json')
    return {'runs': 1, **{k: run[k] for k in keep},
            'first_edition': {c['config']: c['rows_returned_for_qid1'] for c in first['configs']}}


def publish():
    first = read(DIRS['recall'], 'run.json')
    data = {
        'note': ('week05/experiments/*/bench.py 결과를 scripts/sync-pgvector-results.py 가 옮긴 것. '
                 'Docker Desktop(macOS) Linux VM · 공유 CPU 3개 · RAM 3.8GiB.'),
        'environment': environment(first),
        'recall': recall(), 'build': build(), 'sbq': sbq(), 'plain_repro': plain_repro(),
        'halfvec': halfvec(), 'scale': scale(), 'filter': filtering(),
    }
    TARGET.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n')
    print(f'→ {TARGET.relative_to(WEB)} 갱신')


def check():
    data = json.loads(TARGET.read_text())
    assert data['recall']['runs'] == 2 and len(data['recall']['configs']) == 11, '실험 01 구성'
    assert [r['n'] for r in data['build']['rows']] == [20000, 100000, 300000], '실험 02 행 수'
    assert data['sbq']['configs'][1]['build_ms'] is None, '실험 03 plain 은 실패 기록으로 남아야 한다'
    assert data['plain_repro']['attempts'] == 9 and data['plain_repro']['crashes'] == 0, '실험 04 재현 결과'
    assert len(data['halfvec']['configs']) == 3, '실험 05 구성'
    assert len(data['scale']['configs']) == 6 and data['scale']['n_vectors'] == 301000, '실험 06 구성'
    ds = data['filter']['datasets']
    assert ds['correct']['distinct_vectors'] == ds['correct']['rows'] == 50000, '실험 07 본 측정은 중복 없는 데이터'
    assert ds['duplicate_bug']['distinct_vectors'] == 10, '실험 07 첫 판 재현 데이터'
    assert len(ds['correct']['configs']) == 4 and len(ds['duplicate_bug']['configs']) == 4, '실험 07 구성'
    for c in data['recall']['configs']:
        assert all(0 <= r <= 1 for r in c['recall']), c['config']

    # IVFFlat·HNSW 페이지의 측정(capture-pgvector-index-demo.py) — 설정마다 RUNS 번 빌드했는지
    ix = json.loads((WEB / 'src/data/pgvector-index-demo.json').read_text())
    runs = ix['runs']
    assert runs >= 2, '인덱스 데모는 설정마다 2번 이상 빌드한다'
    assert ix['dataset']['distinct_vectors'] == ix['dataset']['rows'], '인덱스 데모 데이터에 중복 벡터'
    for key, cols in (('ivfflat', ('lists', 'probes')), ('hnsw', ('m', 'ef_construction', 'ef_search'))):
        counts = {}
        for r in ix[key]:
            k = tuple(r[c] for c in cols)
            counts[k] = counts.get(k, 0) + 1
            assert 0 <= r['recall'] <= 1, (key, k)
        assert all(n == runs for n in counts.values()), f'{key}: 설정마다 {runs}회가 아니다'
    for key in ('shift', 'vacuum'):
        assert len(ix[key]['results']) > 0, key
    print('pgvector 실험 요약 검사 통과')


if __name__ == '__main__':
    check() if '--check' in sys.argv else (publish(), check())
