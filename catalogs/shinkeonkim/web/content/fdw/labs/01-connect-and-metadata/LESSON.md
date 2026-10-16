# Lab 01 · 연결과 메타데이터

전제: 기본 01~03. 서버·DB·역할·스키마·테이블을 구분한다.

1. 확장 버전과 foreign server 옵션을 읽는다.
2. remote_school의 relkind=f와 10행 SELECT를 확인한다.
3. 읽기 계정의 UPDATE가 거절되는 오류를 검증한다.

해석: 등록된 정의, 실제 접속, 원격 SELECT, 원격 쓰기 권한은 각각 별도 단계다. 오류를 단계별로 구분한다.

실행: `./run.sh` 자동 실행, `./run.sh up` 준비만, `./run.sh psql` 로컬, `./run.sh remote` 원격, `./run.sh explain` 웹 주소 안내. 각 실행은 결과를 `results/run.json`에 저장한다.
