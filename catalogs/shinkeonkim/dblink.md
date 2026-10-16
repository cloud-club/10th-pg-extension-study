# dblink

> 문자열 SQL로 다른 PostgreSQL DB에 명시적으로 요청한다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | DB 연동 |
| 문서 기준 | PostgreSQL 18 · 2026-10-13 확인 · PostgreSQL 18.6에서 조회 검증 |
| 라이선스 | PostgreSQL License |
| 문서 | [공식 문서](https://www.postgresql.org/docs/18/dblink.html) |
| 정리한 사람 | shinkeonkim |
| 회차 | week07 · postgres_fdw 관련 비교 |

## 1. Before / After와 용도

일반 표처럼 JOIN하는 planner 통합이 필요한 경우 postgres_fdw부터 비교한다. dblink는 원격 명령을 직접 관리하려는 경우 검토한다.

## 2. 설치 & 데모

```sql
CREATE EXTENSION dblink;
SELECT * FROM dblink(
  'host=remote dbname=school user=fdw_reader password=study_only',
  'SELECT id, title FROM public.books WHERE id <= 3 ORDER BY id'
) AS result(id integer, title text);
```

웹 Lab 01에서 공유 원격 DB·읽기 계정을 준비한 뒤 로컬 DB에서 실행한다. 비밀번호는 실습 전용이다.

## 3. 트레이드오프

SQL 문자열과 반환 타입을 호출자가 관리한다. 원격 트랜잭션의 시작·종료도 명시적으로 관리해야 하며 로컬 롤백이 원격 쓰기의 롤백을 보장한다고 가정하지 않는다. 활성화 자체에 shared_preload_libraries는 필요 없다.

## 4. 관리형 DB

서비스·버전별 허용 확장과 권한을 확인한다. 이번 자료에서는 관리형 서비스 지원과 접속·파일 접근을 아직 검증하지 않았다.

## 학습 자료

웹 `#/postgres-fdw/related-dblink` · `#/postgres-fdw/related` · `#/postgres-fdw/lab-connections` · [postgres_fdw 카탈로그](postgres_fdw.md)
