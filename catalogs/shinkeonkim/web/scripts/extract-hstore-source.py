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
    'gist_compress': ('contrib/hstore/hstore_gist.c', 146, 176, 'ghstore_compress: 키·값을 crc32 해시해 siglen바이트 비트 서명에 찍는다'),
    'gist_union': ('contrib/hstore/hstore_gist.c', 295, 332, 'unionkey · ghstore_union: 자식 서명들을 비트 OR로 합친다'),
    'gist_penalty': ('contrib/hstore/hstore_gist.c', 335, 347, 'ghstore_penalty: 두 서명의 해밍 거리(다른 비트 수)가 삽입 비용이다'),
    'gist_consistent': ('contrib/hstore/hstore_gist.c', 506, 522, 'ghstore_consistent: 이 함수가 다루는 모든 전략은 손실이라 recheck = true가 고정이다'),
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
