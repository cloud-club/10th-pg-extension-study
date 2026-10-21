# 4주차 — 같은 UPDATE, 다른 인덱스 비용

> PostgreSQL의 heap/TID와 MySQL InnoDB의 clustered/secondary index는 행을 어떻게 찾고, UPDATE 때 무엇을 고칠까?

- 작성: [신웅비 (@kungbi)](https://github.com/kungbi)
- 범위: PostgreSQL 18의 일반 heap 테이블·B-tree, MySQL 8.4의 InnoDB
- 연결: [3주차 MVCC·VACUUM·Undo/Purge](../3주차/)에서 행 버전 관리를 살펴본 뒤, 인덱스 조회 경로와 유지 비용으로 이어간다.
- 주차: 개인 학습 기록의 4주차다. 스터디 전체 4회차의 추천 카테고리를 변경하지 않는다.

## 자료

| 자료 | 내용 |
| --- | --- |
| [HTML 위키형 발표자료](presentation/index.html) | 공통 목차·이전/다음 이동을 갖춘 4페이지 자료 |
| [발표 원고](presentation/slides.md) | 화면에 보여줄 내용과 발표 멘트를 구분한 Markdown 원고 |
| [인덱스 구조 비교 조사 문서](indexes-postgresql-innodb.md) | 저장 구조·조회·UPDATE·정비 도구를 넓게 비교한 배경 문서 |

발표는 HTML 위키형 자료를 기준으로 진행한다. Markdown 원고는 설명용 참고 자료이며 HTML을 자동 생성하는 빌드 입력은 아니다. 배경 문서의 covering index·정비 도구 비교는 발표의 중심 범위와 구분한다.

## 페이지 구성

1. [인덱스 조회 경로](presentation/index.html) — 논리적 행·행 버전·인덱스 항목, PK/보조 키 검색, TID
2. [PostgreSQL과 MVCC](presentation/postgresql.html) — snapshot, tuple의 `xmin`/`xmax`, non-HOT 후보, HOT chain·fillfactor·pruning
3. [InnoDB와 Undo](presentation/innodb.html) — clustered record, Read View, Undo 재구성, 보조 키 UPDATE·Purge
4. [구조와 접근 최적화](presentation/optimizations.html) — B-tree deduplication, 순차 정수·UUIDv4, Bitmap Heap Scan·MRR

## 핵심 구분

- PostgreSQL 인덱스는 TID로 heap tuple version을 찾는다. TID는 또 다른 인덱스가 아니라 위치 정보다.
- InnoDB의 clustered PK index 리프에는 행 레코드가 있고, 보조 인덱스는 PK로 행을 찾는다.
- HOT은 새 tuple version을 만들면서, 조건이 맞으면 새 인덱스 항목을 생략한다.
- Bitmap Heap Scan·MRR은 접근 순서 최적화이며 MVCC 버전 관리 방식 자체를 바꾸지 않는다.
- 탐색 단계 수만으로 실제 디스크 I/O나 엔진 간 성능 우열을 단정하지 않는다.

## 자료의 성격과 출처

공식 문서를 바탕으로 구조와 동작을 설명하는 학습 자료다. SQL과 도식은 설명용 예시이며 실행 결과나 실측 성능을 뜻하지 않는다. UUID 비교 표는 각 외부 글의 실험 결과를 인용한 것으로, 이 저장소에서 같은 환경을 구성해 재실행한 벤치마크가 아니다. 엔진·행 수·키 폭·측정 지표가 다른 실험은 직접적인 성능 순위로 비교하지 않는다.

각 페이지의 근거 링크와 [마지막 페이지의 참고 자료](presentation/optimizations.html#sources)에서 공식 문서·구현 코드·외부 실험의 출처를 확인할 수 있다.

## 열기

저장소 루트에서:

```bash
open catalogs/kungbi/4주차/presentation/index.html
```

HTML과 CSS·JavaScript·SVG를 같은 디렉터리에 두면 별도 설치나 빌드 없이 열린다. GitHub의 파일 보기에서는 HTML이 렌더링되지 않으므로, 저장소를 내려받아 브라우저에서 연다.

[주차별 목록으로 돌아가기](../README.md)
