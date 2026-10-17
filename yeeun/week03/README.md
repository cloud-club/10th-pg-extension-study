# 3주차 — `pg_cron`

| | |
| --- | --- |
| 회차 | week03 · 자동화·파티셔닝 |
| 정리 | 김예은 |
| 연결 | week02 `pg_stat_statements`(진단) → week03 반복 작업 **자동화** |

---

## 왜 이 확장을 보나

PostgreSQL에는 “매일 새벽 3시에 이 SQL을 실행해라” 같은 **범용 스케줄러가 코어에 없다.**

선택지는 OS cron / 앱 스케줄러 / 클라우드 스케줄러 / **`pg_cron`** 이다.  
`pg_cron`은 **DB 안에서** cron 문법으로 Job을 등록·실행하는 Extension이다.

2주차와의 연결:

```text
pg_stat_statements  →  무슨 SQL이 무거운지 본다 (진단)
pg_cron             →  짧은 maintenance SQL을 정해진 시간에 돌린다 (자동화)
```

둘 다 **`shared_preload_libraries` + (재시작)** 이 필요하다는 점도 같다.  
차이는 statements는 통계 수집, cron은 **Background Worker 스케줄러**라는 점이다.

---

## 용어 짧게

| 말 | 뜻 |
| --- | --- |
| **cron** | 시간 기반 Job 스케줄 문법·개념 (분 시 일 월 요일) |
| **`pg_cron`** | 그 스케줄을 PostgreSQL 안에서 돌리는 Extension |
| **`shared_preload_libraries`** | 서버 기동 시 라이브러리 로드 (스케줄러 Worker 등록용) |
| **Background Worker** | 클라이언트 연결과 별개로 DB 서버 안에서 도는 프로세스 |
| **`cron.job`** | 등록된 스케줄(메타데이터) |
| **`cron.job_run_details`** | Job 실행 이력 |

---

## 어디에 뭐가 있나

| 문서 | 역할 |
| --- | --- |
| **[HANDS-ON.md](HANDS-ON.md)** | 같이 따라 하는 실습 |
| [catalogs/pg_cron.md](catalogs/pg_cron.md) | 카탈로그 초안 |
| [notes/pg_cron-guide.md](notes/pg_cron-guide.md) | cron → pg_cron 구조 전체 정리 |
| [lab/](lab/) | Docker 실습 |

---

## 빠르게 돌리기

```bash
cd yeeun/week03/lab
./run.sh
```

| 명령 | 의미 |
| --- | --- |
| `./run.sh 02` | Job 등록·초 단위 스케줄 |
| `./run.sh 03` | 실행 이력 확인·정리 |
| `./run.sh down` | 처음부터 다시 |

---

## 발표할 때 (실습 위주)

1. week02 진단 다음 단계 = 반복 maintenance 자동화  
2. preload + Background Worker가 왜 필요한지 (한 줄)  
3. `cron.schedule` → `cron.job` → 실행 → `job_run_details`  
4. OS cron과 역할이 다름 (Shell/API는 앱·OS 쪽이 낫다)
