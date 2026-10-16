# 실험 05 — hstore 행 vs Redis 해시: 같은 일을 시켰을 때

2026-09-21, PostgreSQL 16.15 / hstore 1.8, Redis 7.4.11. Docker(공유 CPU 3개). [bench.py](bench.py)

## 검증할 것

Redis 해시와 비슷하게 쓰이는 hstore 행에서 필드 쓰기·읽기·카운터 증가가 얼마나 빠른가? 내구성 수준을 맞추면 어떻게 달라지는가? 같은 데이터가 차지하는 크기는?

## 방법

- 객체 5만 개 × 필드 20개(값 12자리). PostgreSQL은 `kv(id int PRIMARY KEY, attrs hstore)`, Redis는 `h:<12자리 번호>` 해시 5만 개.
- 연산 3가지, 무작위 객체를 골라 실행: **쓰기**(`HSET` ↔ `attrs || hstore('f05', …)`), **읽기**(`HGET` ↔ `attrs -> 'f05'`), **카운터**(`HINCRBY` ↔ `attrs || hstore('cnt', …+1)`). 클라이언트 1개와 8개.
- 클라이언트는 각 서버의 컨테이너 안에서 실행한다: `pgbench -M prepared`(TCP 루프백), `redis-benchmark`(요청 20만 건). 두 서버는 한 번에 하나씩만 부하를 받는다.
- **내구성 수준이 비슷한 것끼리 세 쌍**:

| 쌍 | Redis | PostgreSQL |
| --- | --- | --- |
| none | 영속화 없음(RDB·AOF 끔) | UNLOGGED 테이블(WAL 없음) |
| relaxed | AOF, `appendfsync everysec` | `synchronous_commit = off` |
| strict | AOF, `appendfsync always` | `synchronous_commit = on`(기본) |

- 쌍마다 새 컨테이너·새 볼륨, 5회 반복. 메모리: Redis `used_memory` 증가분, PostgreSQL `pg_total_relation_size`(테이블 + PK 인덱스).

## 결과 (초당 연산, 중앙값 · 최소~최대)

쓰기(필드 하나):

| 쌍 | 클라이언트 | Redis | hstore | Redis ÷ hstore |
| --- | ---: | ---: | ---: | ---: |
| none | 1 | 31,397 (28,157~42,699) | 18,749 (17,511~20,452) | 1.7 |
| none | 8 | 256,410 (223,464~257,732) | 106,012 (82,643~155,716) | 2.4 |
| relaxed | 1 | 31,358 (27,473~32,144) | 19,013 (17,926~21,755) | 1.6 |
| relaxed | 8 | 273,598 (257,732~278,940) | 133,667 (109,860~141,123) | 2.0 |
| strict | 1 | 3,126 (2,286~3,216) | 9,485 (9,435~9,666) | 0.33 |
| strict | 8 | 12,346 (10,225~13,707) | 38,999 (35,610~41,279) | 0.32 |

읽기(필드 하나, 클라이언트 8): none Redis 229,621 / hstore 191,991(1.2배), relaxed 250,941 / 168,498(1.5배), strict 238,949 / 194,627(1.2배). 클라이언트 1에서는 none에서 hstore가 39,107, Redis가 33,411로 hstore가 더 빨랐다(범위가 겹친다).

카운터(HINCRBY 대응, 클라이언트 8): none Redis 256,739 / hstore 133,867(1.9배), relaxed 137,741 / 117,710(1.2배, Redis 편차가 109,170~264,201로 큼), strict 12,335 / 40,145(0.31).

메모리(같은 데이터): Redis `used_memory` 증가 25.6 MB, PostgreSQL 테이블 + PK 26.8 MB(hstore 값 평균 478 B).

## 해석

- **영속화가 없거나 느슨하면 Redis가 쓰기에서 약 2배 빨랐다.** 명령 하나가 지나는 경로(단일 스레드·메모리 vs 프로세스·행 잠금·새 튜플·WAL)의 차이가 유력한 원인이지만 이 실험이 원인을 나눠 재지는 않았다.
- **읽기는 두 시스템이 같은 자릿수**다(0.9~1.5배). 클라이언트 1개에서는 hstore가 앞서기도 했다.
- **엄격한 내구성(매 쓰기 fsync)에서는 순서가 뒤집혔다.** Redis AOF always가 hstore(sync=on)의 약 1/3. 뒤집힌 원인은 가르지 않았다. Docker Desktop VM의 가상 디스크 fsync 지연이 반영된 값이라 실제 SSD에서의 순위로 일반화하지 않는다.
- **같은 데이터의 크기는 비슷**하다(25.6 MB vs 26.8 MB). 다만 Redis는 RAM, PostgreSQL은 디스크이며 캐시된 부분만 메모리를 쓴다.
- 회차 간 편차가 크다(예: none 쓰기 8클라이언트에서 hstore 82,643~155,716). 그래서 표에 범위를 함께 적는다.

## 한계

- 같은 VM CPU 3개를 서버와 클라이언트가 나눠 쓴다. 절대 수치는 이 환경에서만 의미가 있다.
- 네트워크 왕복이 없다(루프백). 객체 5만 개에 무작위 분산한 부하이며 같은 키에 몰리는 부하는 실험 04.
- 크래시 복구·복제·Redis Cluster는 다루지 않았다. Redis 8 계열의 메모리 최적화(compact hash)는 테스트하지 않았다.
- fsync 정책은 설정만 맞췄고 실제 전원 차단으로 내구성을 검증하지 않았다.

## 재현

```sh
python3 catalogs/shinkeonkim/week04/hstore/experiments/05-redis-comparison/bench.py
```

한 회차에 약 8분이 걸리며(세 쌍 × 컨테이너 기동·적재·측정) `results/`에 JSON을 만든다. 다른 실험과 같은 Compose 프로젝트를 쓰므로 동시에 실행하지 않는다.
