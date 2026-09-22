# catalogs - PostgreSQL Extension 카탈로그

**이 스터디의 핵심 산출물입니다.** 익스텐션 한 개 = 문서 한 장.

8주 뒤에 남는 것은 "우리가 8주 동안 공부했다"가 아니라, **팀 누구든 열어보고 판단할 수 있는 레퍼런스**입니다.

[`TEMPLATE.md`](TEMPLATE.md) 를 복사해 `catalogs/<extension-name>.md` 로 만들고, 아래 목록에 한 줄 추가한 뒤 PR 을 올립니다 - 발표 직후, 본인이 직접. 파일명은 익스텐션 이름 그대로 (`pgvector.md`, `pg_stat_statements.md`).

## 목록

| 익스텐션 | 한 줄 요약 | 카테고리 | 매니지드 지원 | 정리 |
| --- | --- | --- | --- | --- |
| [pg_stat_statements](shinkeonkim/etc/pg_stat_statements/README.md) | 실행된 SQL 을 정규화해 서버 전역 누적 통계로 추적 | 성능 진단 | RDS ○ / Aurora ○ / Supabase ○ / Neon ○ / Cloud SQL ○ / Azure ○ | shinkeonkim (etc) |
| [pg_cron](shinkeonkim/pg_cron.md) | DB 안에서 cron 문법으로 주기적인 SQL 을 예약 실행 | 자동화 (스케줄러) | RDS ○ / Supabase ○ / Neon ○ / Cloud SQL ○ / Azure ○ / Heroku ✕ | shinkeonkim (week03) |
| [pg_bigm](shinkeonkim/pg_bigm.md) | LIKE 검색을 2-gram GIN 인덱스로 가속 - 짧은 한글 키워드에 강함 | 검색 · 텍스트 | RDS ○ / Aurora ○ / Cloud SQL ○ (PG17+) / Azure·Supabase·Neon 확인 필요 | shinkeonkim (week02) |
| [pg_trgm](shinkeonkim/pg_trgm.md) | 3-gram 으로 LIKE · 정규식 · 유사도 · KNN 검색을 가속하는 contrib | 검색 · 텍스트 | RDS ○ / Aurora ○ / Supabase ○ / Neon ○ / Cloud SQL ○ / Azure ○ (contrib + trusted) | shinkeonkim (week02) |

<sub>매니지드 지원 열은 `RDS ○ / Supabase ○ / Neon ✕` 처럼 짧게 적습니다.</sub>

<sub>`pg_bigm` 과 `pg_trgm` 은 같은 문제(부분 문자열 검색)를 다른 방식으로 푸는 확장이라 [`shinkeonkim/week02/bigm-vs-trgm/`](shinkeonkim/week02/bigm-vs-trgm/) 에 비교를 따로 정리했습니다.</sub>
