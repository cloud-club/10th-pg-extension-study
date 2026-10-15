# 2주차 — `pg_stat_statements`

| | |
| --- | --- |
| 회차 | week02 · 운영·성능 진단 |
| 정리 | 김예은 |

---

## 왜 이 확장을 보나

DB가 느리다는 말만 들리면, 보통 이런 갈림길에 섭니다.

| 수단 | 하는 일 | 한계 |
| --- | --- | --- |
| **Slow Query Log** | “N초 넘게 걸린 SQL만” 로그에 남김 | **한 방이 느린 것**은 잘 보임. 짧지만 엄청 자주 도는 SQL은 놓치기 쉬움 |
| **`EXPLAIN ANALYZE`** | 찍은 SQL의 실행 계획을 자세히 봄 | **이미 고른 SQL**에는 강함. “뭘 먼저 찍을지”는 안 알려 줌 |
| **`pg_stat_activity`** | 지금 실행 중인 세션/쿼리 | **지금**만 보임. 끝난 쿼리의 누적은 없음 |

`pg_stat_statements` 는 실행이 끝난 SQL까지 **패턴별로 누적**해 두고,

> 전체 DB 시간을 가장 많이 쓴 쿼리 패턴이 뭐지?

에 먼저 답하게 해 줍니다.

이 주차에서는 Extension 구조·`CREATE EXTENSION`·preload·Managed DB 제약까지 같이 보고,  
그 위에서 **정규화**와 **mean vs total** 을 직접 재봅니다.

---

## 용어 짧게

| 말 | 뜻 |
| --- | --- |
| **정규화** | 상수(`'소설'`, `'과학'`)를 `$1`처럼 지워서, **같은 모양의 SQL을 하나로 묶는 것** |
| **`calls`** | 그 패턴이 **몇 번** 실행됐는지 |
| **`mean_exec_time`** | 한 번 실행할 때 **평균** 시간 (“한 방이 얼마나 느리냐”) |
| **`total_exec_time`** | 지금까지 그 패턴이 쓴 시간 **합** (“전체로 얼마나 잡아먹었냐”) ≈ mean × calls |
| **Slow Query** | 임계값(예: 1초) **넘는** 실행만 로그에 남기는 방식. 이 Extension을 **대체**하는 게 아니라, “한 방만 보는” 대표 대비 대상 |

---

## 어디에 뭐가 있나

| 문서 | 역할 |
| --- | --- |
| **[HANDS-ON.md](HANDS-ON.md)** | 다 같이 따라 하는 실습 (여기부터) |
| [catalogs/pg_stat_statements.md](catalogs/pg_stat_statements.md) | 카탈로그 초안 (Before/After · Trade-off · Managed · 실측) |
| [notes/extension-overview.md](notes/extension-overview.md) | Extension 생태계·문제→후보 매핑 조사 노트 |
| [lab/](lab/) | Docker 환경 · 자동 실행 스크립트 |

---

## 빠르게 돌리기

로컬에 Docker Desktop을 켠 뒤:

```bash
cd yeeun/week02/lab
./run.sh          # 전체 자동 실측 (01→02→03)
# 또는
./run.sh up && ./run.sh psql   # 손으로 치며 진행 → HANDS-ON.md
```

| 명령 | 의미 |
| --- | --- |
| `./run.sh 02` | 정규화만 |
| `./run.sh 03` | mean vs total만 |
| `./run.sh down` | 컨테이너 삭제 후 **처음부터 다시** |

---

## 발표할 때 말할 것 (5~10분)

1. Slow Query / EXPLAIN / activity의 한계 → 왜 누적 통계 Extension이 필요한지  
2. `CREATE EXTENSION` = DB 등록, 이 Extension은 **preload + 재시작**도 필요  
3. 실습: 장르만 달라도 `genre = $1`로 합쳐지고 `calls`가 늘어남 (**정규화**)  
4. 실습: mean 1등 ≠ total 1등 → 튜닝 우선순위는 보통 **total**  
5. 역할 분리: 이 Extension으로 “뭘 볼지” → `EXPLAIN`으로 “왜 느린지”
