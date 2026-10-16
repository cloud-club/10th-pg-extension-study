"""JOIN 비교 Lab의 원본 검증과 Markdown 결과 표 동기화."""
import argparse
import json
import re
import statistics
from pathlib import Path
WEB=Path(__file__).resolve().parents[1]
RAW=WEB.parent/'week07/postgres_fdw/experiments/05-join-strategies/results/run.json'
DOC=WEB/'content/fdw/join-comparison.md'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
d=json.loads(RAW.read_text());assert d['same_rows'] and d['result_rows']==1000
assert d['environment']['source_rows']==100000
names={'direct':'직접 JOIN','key-array':'키 배열','remote-reduced':'원격 전처리','local-staging':'로컬 staging'}
lines=['| 방식 | 준비 중앙값 ms | 조회 중앙값 ms | 조회 범위 ms | 준비 + 1회 모델 ms | 준비 + 10회 모델 ms | 원격 출력 행 × loops |','| --- | --- | --- | --- | --- | --- | --- |']
for name,label in names.items():
 c=d['cases'][name];read=c['read'];assert read['n']==len(read['samples_ms'])==10
 assert read['median_ms']==statistics.median(read['samples_ms'])
 prep=c['preparation'];pv=0
 if prep:
  assert prep['n']==len(prep['samples_ms'])==5
  pv=prep['median_ms'];assert pv==statistics.median(prep['samples_ms'])
 assert abs(c['modeled_one_read_ms']-pv-read['median_ms'])<1e-6
 assert abs(c['modeled_ten_reads_ms']-pv-sum(read['samples_ms']))<1e-6
 foreign=', '.join(f"{int(s['rows']):,} × {s['loops']}" for s in c['foreign_scans']) or '0 (로컬 조회)'
 lines.append(f"| {label} | {pv:.2f} | {read['median_ms']:.2f} | {read['min_ms']:.2f}–{read['max_ms']:.2f} | {c['modeled_one_read_ms']:.2f} | {c['modeled_ten_reads_ms']:.2f} | {foreign} |")
assert not d['cases']['local-staging']['foreign_scans']
for name in ('key-array','remote-reduced'):assert d['cases'][name]['foreign_scans'][0]['rows']==1000
lines+=['',f"측정 시각: {d['environment']['measured_at']} · PostgreSQL 18.6 · 같은 호스트 Docker 내부 네트워크.",'',f"추가 저장 공간(인덱스 포함): 원격 축소 표 {d['sizes']['remote_reduced_bytes']:,} bytes, 로컬 staging {d['sizes']['local_staging_bytes']:,} bytes.",'',f"모든 측정의 id·title 동일성을 확인했습니다. 결과 SHA-256: `{d['result_sha256']}`."]
s=DOC.read_text();output=re.sub(r'(## 실제 결과\n).*?(\n## 결과 해석)',lambda m:m[1]+'\n'+'\n'.join(lines)+'\n'+m[2],s,flags=re.S)
if args.check:
 assert output==s,'JOIN 결과 Markdown 동기화 필요'
else:DOC.write_text(output)
print('JOIN 비교: 동일 결과·준비 5회·읽기 10회·모델·표 동기화 '+('검증 통과' if args.check else '완료'))
