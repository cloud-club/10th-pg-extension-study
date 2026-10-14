# file_fdw

> PostgreSQL 서버의 파일이나 프로그램 출력을 외부 테이블로 읽는다.

| 항목 | 내용 |
| --- | --- |
| 카테고리 | 외부 파일 |
| 문서 기준 | PostgreSQL 18 · 2026-10-13 확인 · PostgreSQL 18.6에서 조회 검증 |
| 라이선스 | PostgreSQL License |
| 문서 | [공식 문서](https://www.postgresql.org/docs/18/file-fdw.html) |
| 정리한 사람 | shinkeonkim |
| 회차 | week07 · postgres_fdw 관련 비교 |

## 1. Before / After와 용도

CSV를 영구 로컬 표로 COPY하기 전에 서버의 외부 파일을 SQL로 읽으려는 경우 비교한다. 원격 PostgreSQL 접속과는 용도가 다르다.

## 2. 설치 & 데모

```sql
CREATE EXTENSION file_fdw;
CREATE SERVER csv_files FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN TABLE public.import_books (id integer, title text)
SERVER csv_files OPTIONS (filename '/lab/books.csv', format 'csv', header 'true');
SELECT * FROM public.import_books LIMIT 3;
```

공유 Lab 환경은 books.csv를 local 컨테이너의 /lab/books.csv에 읽기 전용 마운트한다. CSV 세 행의 조회를 검증했다. 수동 생성부터 진행하려면 웹 Lab 05의 경로·파일 권한 설명을 따른다.

## 3. 트레이드오프

읽기 전용이다. 파일은 클라이언트 PC가 아니라 PostgreSQL 서버에 있어야 한다. 서버 파일·프로그램 접근 권한이 필요하고 관리형 서비스에서는 파일 접근이 제한될 수 있다. 활성화 자체에 shared_preload_libraries는 필요 없다.

## 4. 관리형 DB

서비스·버전별 허용 확장과 권한을 확인한다. 이번 자료에서는 관리형 서비스 지원과 접속·파일 접근을 아직 검증하지 않았다.

## 학습 자료

웹 `#/postgres-fdw/related-file-fdw` · `#/postgres-fdw/related` · `#/postgres-fdw/lab-connections` · [postgres_fdw 카탈로그](postgres_fdw.md)
