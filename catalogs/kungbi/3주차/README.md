# 3주차 — 같은 MVCC, 다른 버전 관리

> PostgreSQL의 VACUUM과 MySQL InnoDB의 Undo/Purge는 같은 문제를 어떻게 다르게 푸는가?

- 작성: [신웅비 (@kungbi)](https://github.com/kungbi)
- 기준 문서: PostgreSQL 18 · MySQL 8.4

## 자료

| 자료 | 내용 |
| --- | --- |
| [심화 조사 문서](mvcc-postgresql-innodb.md) | MVCC 공통 원리부터 PostgreSQL heap/VACUUM과 InnoDB Undo/Purge까지 |
| [HTML 발표자료](presentation/mvcc-postgresql-innodb.html) | 브라우저에서 바로 실행하는 발표 덱 |
| [발표자료 원본](presentation/slides.md) | Marp Markdown 원본 |
| [발표자 노트](presentation/speaker-notes.md) | 22장 슬라이드별 설명 |
| [전체 미리보기](presentation/preview-contact-sheet.png) | 모든 슬라이드를 한 화면에서 확인 |
| [출처 원장](presentation/citations.json) | 공식 문서 14개의 제목·URL·확인일 |

## 한 줄 결론

MVCC의 목적은 같지만 **과거 행 버전을 보존하는 위치와 회수하는 방식**이 다르다. PostgreSQL은 heap의 tuple version을 VACUUM으로 회수하고, InnoDB는 현재 record에서 Undo Log를 따라 과거 버전을 복원한 뒤 Purge로 정리한다.

## 발표 질문

1. Snapshot은 데이터 복사본인가, 가시성 판정 기준인가?
2. 같은 `100 → 200` UPDATE가 두 엔진의 저장소에는 어떻게 남는가?
3. PostgreSQL은 왜 VACUUM 없이는 정상 운영할 수 없는가?
4. InnoDB의 Undo와 Purge는 VACUUM과 어디까지 같고 어디서 다른가?
5. 오래 열린 트랜잭션은 두 엔진의 정리를 어떻게 막는가?

## 범위

### 포함

- MVCC, row version, snapshot, visibility
- PostgreSQL `xmin`·`xmax`, heap tuple, HOT
- dead tuple, VACUUM, visibility map, freeze, VACUUM FULL
- InnoDB `DB_TRX_ID`·`DB_ROLL_PTR`, Undo Log, consistent read, Purge
- PostgreSQL과 InnoDB의 snapshot 수명 차이

### 제외

- 모든 격리 이상 현상과 Serializable 구현
- WAL·redo log·binlog·복제·백업 비교
- gap lock·next-key lock 상세
- 엔진 간 성능 우열이나 벤치마크

## 열기

```bash
open catalogs/kungbi/3주차/presentation/mvcc-postgresql-innodb.html
```

방향키로 이동하고 `F`로 전체화면, `P`로 발표자 보기를 연다.
