#!/usr/bin/env python3
"""Publish local experiment results, or validate the committed web summary."""
import json
from pathlib import Path
import sys

WEB = Path(__file__).resolve().parents[1]
EXPERIMENTS = WEB.parent / 'week03/pg_cron/experiments'
target = WEB/'src/data/cron-experiments.json'

def validate(data):
    cases = ('one-job', 'four-jobs-cap2', 'four-jobs-cap4')
    assert all(sum(row['case'] == case for row in data['capacity']) >= 10 for case in cases)
    assert len(data['queue']) >= 10
    assert len(data['diagnostics']) >= 10
    assert data['failure_example']['status'] == 'failed'
    assert {'postgres', 'package', 'cpu_count'} <= data['environment'].keys()

if '--check' in sys.argv:
    validate(json.loads(target.read_text()))
    print('pg_cron 웹 실험 요약의 반복 수와 필수 필드가 유효합니다')
    raise SystemExit(0)

capacity_paths = sorted(
    (EXPERIMENTS/'03-capacity-and-serialization/results').glob('[0-9]*-*.json'),
    key=lambda path: (int(path.stem.split('-', 1)[0]), path.stem.split('-', 1)[1]),
)
queue_paths = sorted(
    (path for path in (EXPERIMENTS/'04-queue-and-rollback/results').glob('*.json') if path.stem.isdigit()),
    key=lambda path: int(path.stem),
)
diagnostic_paths = sorted(
    (EXPERIMENTS/'03-capacity-and-serialization/results').glob('diagnostic-*.json'),
    key=lambda path: int(path.stem.split('-', 1)[1]),
)
if not capacity_paths or not queue_paths or not diagnostic_paths:
    raise SystemExit('먼저 실험 03 bench.py·diagnose.py와 실험 04 bench.py를 실행하세요.')

capacity = [json.loads(path.read_text()) for path in capacity_paths]
queue = [json.loads(path.read_text()) for path in queue_paths]
diagnostics = [json.loads(path.read_text()) for path in diagnostic_paths]
failure_example = next(row for item in queue for row in item['cron_history'] if row['status'] == 'failed')
data = {
    'environment': capacity[0]['environment'],
    'capacity': [item['summary'] for item in capacity],
    'queue': [item['summary'] for item in queue],
    'diagnostics': [{
        'repetition': index,
        'committed': [len(snapshot['committed']) for snapshot in item['snapshots']],
        'startup_timeouts': sum(row.get('return_message') == 'job startup timeout' for row in item['snapshots'][-1]['history']),
        'client_backend_snapshots': sum(any(row.get('backend_type') == 'client backend' for row in snapshot['activity']) for snapshot in item['snapshots']),
    } for index, item in enumerate(diagnostics, start=1)],
    'failure_example': failure_example,
}
validate(data)
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print('로컬 반복 결과를 web/src/data/cron-experiments.json에 게시했습니다')
