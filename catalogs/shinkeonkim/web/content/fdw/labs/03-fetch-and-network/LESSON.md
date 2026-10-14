# Lab 03 · FETCH 횟수와 네트워크 모델

전제: 기본 06. 반환 행·RTT·fetch_size와 설정 우선순위를 구분한다.

1. 같은 10,000행 쿼리에 fetch_size 100·1000을 적용한다.
2. 원격 로그에서 실제 FETCH 명령 수를 센다.
3. 종료 확인용 FETCH를 가정 모델과 연결한다.
4. 로그 비용 때문에 횟수 검증과 성능 측정을 분리한다.

해석: 최종 출력이 같은 계획이어도 내부 통신 묶음 수는 달라진다. 내부 Docker 결과를 WAN 속도로 일반화하지 않는다.

실행: `./run.sh` 자동 실행, `./run.sh up` 준비만, `./run.sh psql` 로컬, `./run.sh remote` 원격, `./run.sh explain` 웹 주소 안내. 각 실행은 결과를 `results/run.json`에 저장한다.
