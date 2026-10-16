# 같이 해보기 — `pg_repack`

| | |
| --- | --- |
| 시간 | 15~20분 |
| 필요 | Docker Desktop |
| 경로 | `yeeun/week04/lab` · 포트 **15504** |
| 목표 | DELETE → VACUUM → FULL → `pg_repack` **크기 변화** 비교 |

```bash
cd yeeun/week04/lab
./run.sh up
./run.sh 01   # extension + 10만 rows
./run.sh 02   # DELETE 8만 → VACUUM
./run.sh 03   # VACUUM FULL
./run.sh 04   # bloat 재현 (DELETE+VACUUM만)
docker exec -e PGPASSWORD=postgres yeeun-week04-repack \
  pg_repack -h 127.0.0.1 -U postgres -d study -t public.repack_demo
./run.sh 05   # repack 후 크기
./run.sh down
```

---

## 실측 결과 (Docker · 2026-09-30)

| 항목 | 값 |
| --- | --- |
| 환경 | PostgreSQL **16.15** (Docker, aarch64) |
| Extension | `pg_repack` **1.5.3** |
| 데이터 | `repeat('A',1000)` × 100,000 → DELETE 80,000 |

### total 크기

```text
INSERT / DELETE / VACUUM     ████████████████████████  114 MB
VACUUM FULL                  █████                     23 MB
pg_repack                    █████                     23 MB
```

| 단계 | table | indexes | **total** | live | 비고 |
| --- | --- | --- | ---: | ---: | --- |
| INSERT | 112 MB | 2208 kB | **114 MB** | 100,000 | 초기 |
| DELETE 8만 | 112 MB | 2208 kB | **114 MB** | 20,000 | Row↓ · 파일 동일 |
| `VACUUM` | 112 MB | 2208 kB | **114 MB** | 20,000 | 재사용만 |
| `VACUUM FULL` | 22 MB | 456 kB | **23 MB** | 20,000 | Rewrite |
| repack 직전 | 112 MB | 2208 kB | **114 MB** | 20,000 | bloat 재현 |
| `pg_repack` | 22 MB | 456 kB | **23 MB** | 20,000 | Online |

---

## 이 실습으로 알게 된 내용

| # | 내용 |
| --- | --- |
| 1 | **지웠다 ≠ 파일이 작아졌다** — live 10만→2만인데 Disk는 114 MB 유지 |
| 2 | **VACUUM은 “다시 쓸 자리”를 비움** — 이번 측정에서 total 변화 없음 |
| 3 | **파일을 줄이려면 Rewrite** — FULL / `pg_repack` 모두 ~23 MB |
| 4 | **효과는 비슷, 운영 방식은 다름** — FULL=강한 Lock · repack=Online(짧은 Exclusive) |
| 5 | **Routine Maintenance는 Autovacuum** — repack은 심한 Bloat용 도구 |
| 6 | **Extension + CLI** — `CREATE EXTENSION` 후 `pg_repack -t ...` 실행 |
| 7 | **Full Repack에는 PK 필요** — demo table에 `BIGSERIAL PRIMARY KEY` |

```text
DELETE ──▶ 파일 그대로
VACUUM ──▶ 파일 그대로 (FREE)
FULL / pg_repack ──▶ 파일 축소 (~114 → ~23 MB)
```

CLI 로그에 `INFO: repacking table "public.repack_demo"` 가 보이면 성공.
