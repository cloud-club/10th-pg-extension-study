"""hll 원본 검증 후 실측 Markdown을 생성한다. 성능·기능·모형을 섞지 않는다."""
import argparse
import json
import math
import statistics
from pathlib import Path
WEB=Path(__file__).resolve().parents[1]
RAW=WEB/'labs/hll/results/run.json'
DOC=WEB/'content/hll/results.md'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--check',action='store_true');args=p.parse_args()
d=json.loads(RAW.read_text())
assert d['environment']['hll']=='2.21'
assert d['small']['rows']==5 and d['small']['distinct']==d['small']['estimate']==3
assert d['empty']=={'empty':0,'aggregate_no_rows_is_null':True}
assert d['duplicate_invariant'] and d['weekly']['merge_matches_direct']
assert d['weekly']['events']==210000 and d['weekly']['exact']==25000 and d['weekly']['sum_daily_exact']==70000
assert 'register count does not match' in d['incompatible_union_error']
assert [x['log2m'] for x in d['precision']]==[8,11,14]
for row in d['precision']:
 assert len(row['trials'])==20 and row['exact']==50000
 errors=[(t['estimate']-row['exact'])/row['exact'] for t in row['trials']]
 assert math.isclose(row['rmse_pct'],math.sqrt(statistics.mean(x*x for x in errors))*100)
 assert all(t['binary_bytes']==3+(2**row['log2m'])*5//8 for t in row['trials'])
for c in d['benchmarks'].values():
 assert c['n']==len(c['samples_ms'])==10
 assert c['median_ms']==statistics.median(c['samples_ms'])
 assert all(x>=0 for x in c['samples_ms'])
lines=['# 실제 결과 · 기능·공간·오차·실행 시간','','## 환경과 지표',f"PostgreSQL 18.6 · hll {d['environment']['hll']} · {d['environment']['package']} · {d['environment']['measured_at']}.",f"work_mem={d['environment']['work_mem']}, 병렬 worker={d['environment']['parallel_workers']}. 전용 Docker 이미지 ID: `{d['environment']['image']}`.",'원본은 web/labs/hll/results/run.json입니다. 이론 모델·손계산 예제·서비스 지연을 실측과 섞지 않습니다.','','## Lab 01 · 기능과 저장 표현','중복 입력 불변, NULL 제외, 빈 스케치=0, 입력 없는 aggregate=NULL을 검증했습니다. 서로 다른 log2m의 병합은 오류로 거부됐습니다.','', '| 입력 고유 개수 | type | 추정값 | binary bytes | pg_column_size |','| --- | --- | --- | --- | --- |']
types={1:'EMPTY',2:'EXPLICIT',3:'SPARSE',4:'FULL'}
for t in d['transitions']:lines.append(f"| {t['n']:,} | {types[t['type']]} | {t['estimate']:.3f} | {t['binary_bytes']:,} | {t['column_bytes']:,} |")
w=d['weekly'];error=(w['merged']-w['exact'])/w['exact']*100
lines+=['','## Lab 02 · 일별 병합', '| 지표 | 관측값 |','| --- | --- |',f"| 방문 기록 | {w['events']:,} |",f"| 일별 정확한 고유 수의 합 | {w['sum_daily_exact']:,} |",f"| 주간 정확한 고유 수 | {w['exact']:,} |",f"| 일별 추정값의 합 | {w['sum_daily_estimates']:.3f} |",f"| 병합한 주간 추정 | {w['merged']:.3f} |",f"| 주간 상대 오차 | {error:.3f}% |",'| 병합 스케치 = 원본 직접 스케치 | 검증 통과 |',f"| 일별 binary bytes 합 | {w['daily_binary_bytes']:,} |",'','병합 일관성은 정답과 무오차라는 보장이 아닙니다. 이 입력·설정의 주간 오차를 그대로 공개합니다.','','## Lab 03 · 20개 입력 집합의 오차','각 시행은 문자열 네임스페이스를 바꾸고 hash seed=0으로 고정했습니다. log2m별로 50,000개의 ID 집합 20개, FULL 표현입니다. 평균 부호 오차는 편향의 단서, RMSE와 최대 오차는 표본의 관측값입니다.','', '| log2m | 레지스터 | binary bytes | 이론 RSE % | 평균 부호 오차 % | 표본 RMSE % | 표본 최대 절대 오차 % |','| --- | --- | --- | --- | --- | --- | --- |']
for q in d['precision']:lines.append(f"| {q['log2m']} | {q['m']:,} | {q['trials'][0]['binary_bytes']:,} | {q['theoretical_rse_pct']:.3f} | {q['mean_signed_error_pct']:.3f} | {q['rmse_pct']:.3f} | {q['max_abs_error_pct']:.3f} |")
for q in d['precision']:
 lines+=['',f"### log2m={q['log2m']}의 원시 추정값",'| 시행 번호 | 추정값 | 상대 오차 % |','| --- | --- | --- |']
 for t in q['trials']:lines.append(f"| {t['trial']} | {t['estimate']:.3f} | {(t['estimate']-50000)/50000*100:.3f} |")
lines+=['','## 별도 점검 · 입력 타입과 hash seed','다음은 모두 원본 고유 개수 50,000, log2m=11입니다. 파라미터·입력 계약이 다른 점검이며 위 네임스페이스 오차 표본과 섞지 않습니다. 큰 과소 추정은 누락하지 않고 보관합니다.','', '| 입력 함수 | hash seed | 고유 해시 출력 | 사용한 버킷 수 / 2048 | 최하위 비트 0인 입력 수 | 추정값 |','| --- | --- | --- | --- | --- | --- |']
for q in d['hash_seed_checks']:lines.append(f"| hll_hash_{q['kind']} | {q['seed']} | {q['distinct_hash_texts']:,} | {q['occupied_buckets']:,} | {q['low_bit_zero_count']:,} | {q['estimate']:.3f} |")
lines+=['','고유 해시는 많아도 선택된 버킷이 고르게 사용되지 않는 관측이 있습니다. 입력·seed·해시 비트 분포와 실제 구현을 추가 조사해야 하며 근본 원인을 확정한 버그 보고로 취급하지 않습니다. [해시 계약](compatibility.md)에서 범위를 읽습니다.','','## Lab 04 · 서버 시간과 초기 생성','조건당 예열 2회·본 측정 10회, 회차별 순환 순서, EXPLAIN 서버 Execution Time입니다.','', '| 방식 | 읽는 입력 | 중앙값 ms | 범위 ms |','| --- | --- | --- | --- |']
labels={'exact_raw':('정확한 COUNT DISTINCT','원본 210,000행'),'hll_raw':('원본 HLL 생성','원본 210,000행'),'hll_daily_union':('일별 스케치 병합','스케치 7행')}
for k,c in d['benchmarks'].items():
 label,rows=labels[k];lines.append(f"| {label} | {rows} | {c['median_ms']:.3f} | {c['min_ms']:.3f}–{c['max_ms']:.3f} |")
lines+=['',f"일별 스케치 초기 생성 서버 시간은 {d['daily_build']['Execution Time']:.3f}ms로 단일 관측입니다. 일별 표의 전체 저장 공간은 {d['daily_relation_bytes']:,} bytes입니다. 초기 생성 비용이 없는 재사용 성능으로 오해하지 않습니다.",'']
for k,c in d['benchmarks'].items():lines.append(labels[k][0]+'의 원시 10회(ms): `'+', '.join(f'{x:.3f}' for x in c['samples_ms'])+'`.')
lines+=['','## 다시 확인할 경계','예열된 합성 데이터의 단일 세션 결과입니다. peak RSS·서비스 p99·동시 갱신·병렬 성능을 검증하지 않았습니다. binary 크기·표 크기를 SQL 메모리나 wire bytes로 부르지 않습니다.','[Lab 01](lab-basics.md)부터 재현하거나 [운영 심화](operations.md)를 읽습니다.']
output='\n'.join(lines)+'\n'
if args.check:
 if DOC.read_text()!=output:raise SystemExit('hll 결과 원문 동기화 필요')
else:DOC.write_text(output)
print('hll 기능·병합·오차 60시행·시간 30표본 '+('검증 통과' if args.check else '실측 동기화'))
