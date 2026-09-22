# PostgreSQL 확장 학습 자료

## 카탈로그

| 주차 | 문서 | 내용 |
| --- | --- | --- |
| week02 | [pg_bigm](pg_bigm.md) | 2-gram GIN 인덱스를 이용한 LIKE 검색 |
| week02 | [pg_trgm](pg_trgm.md) | 부분 문자열·유사도 검색과 GiST KNN |
| week03 | [pg_cron](pg_cron.md) | SQL 예약 실행, 동시성, 운영 시 주의사항 |
| week04 | [hstore](hstore.md) | 문자열 키-값 묶음 컬럼: 저장 방식, jsonb·Redis와의 차이, 동시성 |
| etc | [pg_stat_statements](etc/pg_stat_statements/README.md) | 실행된 SQL의 정규화·누적 통계 (week04 준비 자료에서 이동) |

## 실습과 실험

| 주차 | 자료 | 내용 |
| --- | --- | --- |
| week02 | [pg_bigm](week02/pg_bigm/README.md) · [pg_trgm](week02/pg_trgm/README.md) | 소스 분석, Docker 실습, 성능 실험 |
| week02 | [두 확장 비교](week02/bigm-vs-trgm/README.md) | 검색어 길이·패턴·선택도·인덱스 비용 비교 |
| week02 | [실험 서버](week02/lab-server/README.md) | 브라우저에서 검색 조건을 바꿔 실행하는 실험 |
| week03 | [pg_cron](week03/pg_cron/README.md) | 실행 구조, Docker 실습, 동시성·큐·롤백 실험 |
| week04 | [hstore](week04/hstore/README.md) | 저장 구조 해독, Docker 실습 4개, 실험 5종(저장·갱신·인덱스·동시성·Redis 비교) |
| etc | [pg_stat_statements](etc/pg_stat_statements/README.md) | 정규화·메트릭·운영 가이드와 Docker 실습 5개, 실험 2개 |

Docker 실습은 각 `labs/*` 디렉터리에서 `./run.sh`로 실행한다. 수동 절차는 해당 디렉터리의 `HANDS-ON.md`에 있다.

## 웹 자료

웹은 Week 02의 텍스트 검색, Week 03의 SQL 예약 실행, Week 04의 hstore 자료를 제공한다. hstore는 저장 구조·jsonb 비교·동시성·Redis 비교를 애니메이션과 실측 차트로 보여준다(`#/hstore/about`).

```bash
cd catalogs/shinkeonkim/web
bun install --frozen-lockfile
bun run dev
```

자세한 실행 방법은 [웹 README](web/README.md)에 있다.
