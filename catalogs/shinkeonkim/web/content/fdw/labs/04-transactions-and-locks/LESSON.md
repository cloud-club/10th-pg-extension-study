# Lab 04 · 스냅샷·롤백·원격 잠금

전제: 기본 08. 자동 커밋·BEGIN·COMMIT·ROLLBACK을 이해한다.

1. 두 세션의 명령 순서를 제어해 원격 스냅샷을 확인한다.
2. 로컬 ROLLBACK이 정상 경로에서 원격 쓰기를 취소하는지 확인한다.
3. 원격 행 잠금 유지 중 로컬 UPDATE가 timeout으로 취소되는지 확인한다.
4. 취소 후 원격 값이 바뀌지 않은지 확인한다.

해석: 로컬 READ COMMITTED와 원격 REPEATABLE READ를 구분한다. 이 결과는 분산 장애 원자성을 검증하지 않는다.

실행: `./run.sh` 자동 실행, `./run.sh up` 준비만, `./run.sh psql` 로컬, `./run.sh remote` 원격, `./run.sh explain` 웹 주소 안내. 각 실행은 결과를 `results/run.json`에 저장한다.
