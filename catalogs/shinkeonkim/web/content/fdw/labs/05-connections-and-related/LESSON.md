# Lab 05 · 세션별 연결·관측·관련 확장

전제: 기본 07·09. 세션·idle·연결 유지와 dblink·file_fdw의 역할을 구분한다.

1. 로컬 세션 네 개와 원격 연결 네 개를 직접 연결한다.
2. keep_connections=false에서 트랜잭션 후 해제를 확인한다.
3. dblink와 file_fdw의 실제 결과를 읽는다.
4. 양쪽 pg_stat_statements의 관측 범위를 구분한다.

해석: FDW는 전역 연결 풀이 아니다. 접속형·파일형 외부 데이터와 관측 도구의 역할은 다르다.

실행: `./run.sh` 자동 실행, `./run.sh up` 준비만, `./run.sh psql` 로컬, `./run.sh remote` 원격, `./run.sh explain` 웹 주소 안내. 각 실행은 결과를 `results/run.json`에 저장한다.
