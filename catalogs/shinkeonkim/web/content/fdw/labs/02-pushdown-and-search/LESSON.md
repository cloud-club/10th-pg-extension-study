# Lab 02 · pushdown·JOIN·원격 검색

전제: 기본 04~05. SELECT·WHERE·JOIN·GROUP BY·EXPLAIN을 읽는다.

1. 원격 id 필터와 로컬 VOLATILE 필터를 같은 정답으로 대조한다.
2. GROUP BY와 같은 server JOIN의 원격 SQL을 읽는다.
3. 로컬 표와의 JOIN을 비교한다.
4. pg_trgm extensions 설정 전후 계획과 ID 집합을 비교한다.

해석: 전송 가능성·계획 선택·원격 인덱스 사용은 서로 다른 근거가 필요하다.

실행: `./run.sh` 자동 실행, `./run.sh up` 준비만, `./run.sh psql` 로컬, `./run.sh remote` 원격, `./run.sh explain` 웹 주소 안내. 각 실행은 결과를 `results/run.json`에 저장한다.
