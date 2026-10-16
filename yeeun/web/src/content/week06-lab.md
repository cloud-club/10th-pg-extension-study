# 같이 해보기 — `btree_gist`

| | |
| --- | --- |
| 시간 | 20분(동작) + 대량 벤치 ~45분 |
| 필요 | Docker Desktop · 여유 Disk ~20GB+ |
| 경로 | `yeeun/week06/lab` · 포트 **15506** |
| 목표 | EXCLUDE 예약 충돌 + **1억 행** INSERT 비용 확인 |

```bash
cd yeeun/week06/lab
./run.sh          # 01→04
./run.sh 01       # 동작만
./run.sh 04       # 벤치만 (오래 걸림 · Docker 유지)
./run.sh down
```

---

## 이 실습에서 보는 것

| 단계 | 파일 | 내용 |
| --- | --- | --- |
| 01 | `sql/01-setup.sql` | `btree_gist` · reservation EXCLUDE |
| 02 | `sql/02-inserts.sql` | 성공 / 겹침 거부 / 다른 방 OK |
| 03 | `sql/03-update.sql` | UPDATE 거부 |
| 04 | `sql/04-bench.sql` | 10만·100만·**1억** INSERT |

데모 Constraint:

```sql
EXCLUDE USING gist (
    room_id WITH =,
    during WITH &&
)
```

데이터: 회의실 **1000**개 · 방마다 겹치지 않는 1시간 슬롯 · Bulk `INSERT … SELECT` · 100만 청크마다 `COMMIT`.

---

## 실측 결과 (Docker · 2026-10-14)

| 항목 | 값 |
| --- | --- |
| 환경 | PostgreSQL **16.15** (Docker, aarch64) |
| Extension | `btree_gist` **1.7** |
| 포트 | `15506` |

### 동작 확인 (01–03)

| 케이스 | 결과 |
| --- | --- |
| room1 · 10–11 | INSERT 성공 |
| room1 · 11–12 (인접) | 성공 |
| room1 · 10:30–11:30 | `exclusion_violation` (`23P01`) |
| room2 · 같은 시간 | 성공 |
| 겹치게 UPDATE | `exclusion_violation` |

### INSERT 성능 · plain vs EXCLUDE

| 방식 | 규모 | 시간 | rows/s |
| --- | ---: | ---: | ---: |
| plain (EXCLUDE 없음) | 100,000 | **0.256초** | ~390k |
| EXCLUDE + GiST | 100,000 | **1.64초** | ~61k |
| EXCLUDE + GiST | 1,000,000 | **27.3초** | ~37k |

100k 기준 EXCLUDE ≈ plain 대비 **약 6×** 느림.  
1M EXCLUDE 테이블 total 크기: **166 MB**  
충돌 INSERT 거부(@1M): **0.85 ms**

### 1억 행 · EXCLUDE + GiST (완주)

| 항목 | 값 |
| --- | --- |
| 적재 시간 | **2,736초 (~45.6분)** |
| 평균 rate | **~36,550 rows/s** |
| heap | 6,510 MB |
| indexes (GiST EXCLUDE 등) | **10 GB** |
| **total** | **17 GB** |
| 충돌 INSERT 거부(@1억) | **1.4 ms** |
| 겹침 조회 (`&&` @1억) | **Execution Time ~1.3 ms** (Bitmap Index Scan on EXCLUDE GiST) |

마일스톤:

| 적재량 | 누적 시간 | 평균 rows/s |
| ---: | ---: | ---: |
| 1,000만 | ~340초 (5.7분) | ~29k |
| 5,000만 | ~1,373초 (23분) | ~36k |
| **1억** | **~2,736초 (45.6분)** | **~37k** |

### 한 줄 정리

```text
동작: 같은 room + 겹치는 during → exclusion_violation
쓰기: EXCLUDE 켠 Bulk 1억 ≈ 46분 · 인덱스만 10GB
읽기: 1억에서도 겹침 조회·충돌 거부는 ms 단위
```

대량 적재 경로에 EXCLUDE를 걸면 **쓰기·디스크** 비용이 크고,  
적재가 끝난 뒤의 **충돌 검사·범위 조회**는 GiST 덕분에 상대적으로 싸다.
