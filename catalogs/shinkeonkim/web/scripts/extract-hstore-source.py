#!/usr/bin/env python3
"""postgres/postgres REL_16_15 의 contrib/hstore 에서 페이지에 싣는 발췌를 뽑아 src/data/hstore-source.json 으로 저장한다.

    git clone --depth 1 --branch REL_16_15 --filter=blob:none --sparse https://github.com/postgres/postgres.git pgsrc
    git -C pgsrc sparse-checkout set --no-cone /contrib/hstore/
    python3 scripts/extract-hstore-source.py pgsrc

발췌는 행 범위로 지정하고, 각 파일의 git blob 해시를 함께 남겨 어느 판을 읽었는지 확인할 수 있게 한다.
"""
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parents[1] / 'src/data/hstore-source.json'
TAG = 'REL_16_15'
COMMIT = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()

EXCERPTS = {
    'entry': ('contrib/hstore/hstore.h', 18, 30, 'HEntry: 키와 값마다 하나, 문자열 영역 안의 "끝 위치"'),
    'header': ('contrib/hstore/hstore.h', 44, 76, 'HStore 헤더와 CALCDATASIZE·ARRPTR·STRPTR'),
    'compare': ('contrib/hstore/hstore_io.c', 325, 350, 'comparePairs: 길이 먼저, 같으면 memcmp'),
    'findkey': ('contrib/hstore/hstore_op.c', 36, 71, 'hstoreFindKey: 정렬된 키 위의 이진 탐색'),
    'concat': ('contrib/hstore/hstore_op.c', 515, 552, 'hstore_concat: 정렬된 두 배열의 병합'),
    'gin_extract': ('contrib/hstore/hstore_gin.c', 44, 78, 'gin_extract_hstore: K/V/N 항목'),
    'gin_consistent': ('contrib/hstore/hstore_gin.c', 151, 181, 'gin_consistent_hstore: @> 는 recheck = true'),
    'subs_handler': ('contrib/hstore/hstore_subs.c', 286, 297, 'hstore_subscript_handler'),
}

out = {'tag': TAG, 'commit': COMMIT, 'files': {}, 'excerpts': {}}
for key, (path, a, b, note) in EXCERPTS.items():
    lines = (root / path).read_text().splitlines()
    out['excerpts'][key] = {'file': path, 'start': a, 'end': b, 'note': note,
                            'code': '\n'.join(lines[a - 1:b]),
                            'url': f'https://github.com/postgres/postgres/blob/{TAG}/{path}#L{a}-L{b}'}
    out['files'].setdefault(path, subprocess.check_output(
        ['git', '-C', str(root), 'hash-object', path], text=True).strip())
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(f'{len(EXCERPTS)}개 발췌 · {len(out["files"])}개 파일 · {TAG} ({COMMIT[:7]})')
