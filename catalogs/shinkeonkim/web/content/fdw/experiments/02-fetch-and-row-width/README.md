# 실험 02 · fetch_size와 행 폭은 같은 10,000행 SELECT의 시간에 어떤 영향을 주는가?

## 왜 필요한가

기초 설명에서 나온 성능 가정을 실제 환경에서 검토한다. 기능·정답을 먼저 확인하고 실행 시간의 범위를 명확히 한다.

## 가설

큰 fetch_size는 왕복 수를 줄일 것이다. 좁은 행보다 넓은 행의 변환·전송 비용이 클 수 있다.

## 설계와 측정 범위

좁은 id/title과 넓은 id/title/payload, fetch_size 100·1000·10000의 6조건을 비교한다. 각 계획의 Actual Rows가 10000인지 확인한다. 횟수는 Lab 03 로그 결과와 연결하며 실제 wire bytes·RSS를 측정한 것은 아니다.

조건당 예열 2회 후 본 측정 10회. 결과에는 원시 samples_ms와 중앙값·최소·최대, PostgreSQL 버전·확장 버전·이미지 정보를 저장한다. p95/p99로 서비스 꼬리 지연을 주장하기에는 요청 수와 범위가 제한적이므로 이 실험에서는 보고하지 않는다.

## 실행

저장소 루트에서:

```bash
catalogs/shinkeonkim/week07/postgres_fdw/labs/shared/run.sh up
python3 catalogs/shinkeonkim/week07/postgres_fdw/experiments/02-fetch-and-row-width/bench.py
```

다른 Lab·실험과 동시에 실행하지 않는다. server 옵션을 변경하므로 공유 환경을 순차 사용한다. 결과는 `results/run.json`이다. 전체 요약은 [실험 목록](../README.md)과 웹의 실험 페이지에서 읽는다.

## 해석할 때 남길 한계

동일 호스트 Docker·합성 데이터·EXPLAIN 계측 조건이다. 앱 응답 전체·WAN·실제 네트워크 바이트·메모리 한계·분산 장애를 측정하지 않는다. 1회 우승보다 반복 범위·정답·실행 위치를 보고 가설을 판단한다.
