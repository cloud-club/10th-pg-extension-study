# hstore 반복 실험

각 실험은 `python3 bench.py`로 실행한다. 새 컨테이너와 새 볼륨에서 회차마다 처음부터 시작하고, 끝나면 정리한다. 질문, 방법, 결과, 해석, 한계는 각 실험 README에 있다.

| 실험 | 측정 항목 | 결과 요약 |
| --- | --- | --- |
| [01 · 저장 크기](01-storage-footprint/) | hstore·jsonb·EAV의 크기와 압축 | 키 20개 이하는 hstore = jsonb(바이트까지 같음). 키 500개·낮은 엔트로피에서 hstore 10,027B vs jsonb 1,943B. 원인은 HEntry의 끝 위치 배열(합성 대조로 확인) |
| [02 · 갱신 비용](02-update-write-amplification/) | 키 하나 UPDATE의 WAL·TOAST·HOT | 키 500개에서 UPDATE 1건 15.8KB(EAV 176B). GIN이 있으면 113.6KB. 키 하나 읽기는 압축이 없는 hstore가 jsonb보다 빠름(K=500) |
| [03 · 인덱스](03-index-and-query/) | 크기·조회·삽입 | GIN 71.9MB, GiST(16) 10.4MB, btree 식 1.4MB. 희귀 값 포함 13.5 → 0.9ms(GIN). GiST(16)는 순차 스캔보다 느림 |
| [04 · 동시성](04-concurrency-lost-update/) | 유실 갱신 | 읽고-쓰기는 400건 중 키 51~76개만 남음. `attrs \|\| …`·`FOR UPDATE`는 10회 모두 유실 0 |
| [05 · Redis 비교](05-redis-comparison/) | 같은 일의 처리량 | 쓰기: 영속화 없음·느슨(everysec)에서 Redis가 약 2배, 엄격(always ↔ sync=on)에서는 hstore가 약 3배. 읽기는 비슷. 같은 데이터 크기 25.6MB vs 26.8MB |

실험 04는 10회, 01은 3회(결정적), 02·03·05는 5회다. 여러 실험이 같은 Compose 프로젝트(`runtime/`)를 공유하므로 **동시에 실행하지 않는다.** CPU를 다투는 다른 작업(Docker 실습 등)이 있으면 결과가 흔들리므로 함께 돌리지 않는다.

## 실행

```sh
cd catalogs/shinkeonkim/week04/hstore/experiments
python3 01-storage-footprint/bench.py
python3 02-update-write-amplification/bench.py
python3 03-index-and-query/bench.py
python3 04-concurrency-lost-update/bench.py
python3 05-redis-comparison/bench.py
cd ../../../web && python3 scripts/sync-hstore-results.py   # 웹 요약 게시
```

`REPETITIONS=1`처럼 환경 변수로 반복 수를 줄일 수 있으나, 웹에 게시하려면 최소 반복 수(01: 3, 02: 5, 03: 5, 04: 10, 05: 5)가 필요하다.

## 공통 런타임

[`runtime/`](runtime/)의 Compose 프로젝트(PostgreSQL 16.15, `shared_buffers=256MB`, `max_wal_size=8GB`, 실험 05는 Redis 7.4)와 `harness.py`(표준 라이브러리만 사용)를 공유한다. 이미지 다이제스트를 고정했고, hstore·pageinspect·pgbench는 이미지에 이미 들어 있다.
