# Lab 12 - (i) 새 인덱스 액세스 메서드를 추가하는 Extension

```bash
./run.sh          # 약 30초 (50만 행 생성 + 인덱스 7개)
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.


**Extension 이 할 수 있는 가장 깊은 확장**입니다. "PostgreSQL 이 데이터를 찾는 방식" 자체를 새로 만듭니다.

| 스크립트 | 다루는 것 |
|---|---|
| `01-what-is-an-am.sql` | `pg_am` 과 handler 함수 · 왜 반드시 C 여야 하나 |
| `02-bloom.sql` | 다중 컬럼 등치 검색 · 블룸 필터 원리 |
| `03-when-to-use.sql` | 한계 · 다른 AM extension 들 · **테이블 AM** |

## `pg_am` 에 항목이 생긴다

```
  이름   | handler_함수
---------+---------------
 btree   | bthandler
 gist    | gisthandler
 gin     | ginhandler
 bloom   | blhandler      ← extension 이 추가
```

handler 는 "인덱스를 어떻게 만들고, 스캔하고, 비용을 추정할지"를 담은 구조체(`IndexAmRoutine`)를 돌려주는 C 함수입니다. **SQL 로는 절대 만들 수 없습니다.**

> lab06 의 `pg_trgm` 은 **기존 AM 에 연산자 클래스만** 더한 것이고, `bloom` 은 **AM 자체를** 새로 만든 것입니다. 확장의 깊이가 다릅니다.

## bloom 이 푸는 문제

컬럼이 6개인데 **어떤 조합으로 검색이 올지 모를 때**. B-tree 복합 인덱스 `(a,b,c)` 는 `a` 부터 써야 하고, 조합마다 인덱스를 만들 수는 없습니다.

```
--- 인덱스 하나로 모든 조합을 커버 ---
 Bitmap Index Scan on idx_events_bloom
   Index Cond: ((c3 = 5) AND (c5 = 10))
```

```
            방식             |  크기
-----------------------------+---------
 bloom 1개 (6컬럼 전부 커버) | 7856 kB
 B-tree 6개 (컬럼당 1개)     | 20 MB
```

**원리:** 값들을 해시해 고정 길이 비트맵에 기록합니다. 거짓 양성은 있지만 거짓 음성은 없어서, Bitmap Heap Scan 의 `Recheck Cond` 로 확인합니다.

## 한계 (`03-when-to-use.sql`)

| | 상황 |
|---|---|
| 👍 | 컬럼 5개 이상 + 조합 예측 불가 + 각 컬럼 선택도 낮음 |
| 👎 | **범위 검색(`>`, `BETWEEN`)** - 해시 기반이라 순서 개념이 없음 |
| 👎 | 정렬(`ORDER BY`)에 인덱스 사용 |
| 👎 | 단일 컬럼 등치 - B-tree 가 압도적 |
| 👎 | `UNIQUE` 제약 - 지원 안 함 |

> 스크립트는 테이블을 **일부러 넓게(150바이트 패딩) 50만 행** 만듭니다. 좁은 테이블에서는 Seq Scan 이 워낙 싸서 플래너가 bloom 을 고르지 않습니다. "인덱스가 안 잡히는데요?" 의 흔한 원인이기도 합니다.

## 같은 부류

`bloom`(contrib) · **`pgvector`**(IVFFlat/HNSW) · `rum` · `pgroonga` · `zombodb`

<sub>`pg_bigm` 은 여기 끼지 않습니다. 2글자 색인을 하지만 새 AM 이 아니라 **기존 GIN 에 연산자 클래스(`gin_bigm_ops`)를 더하는** lab06 부류입니다.</sub>

그리고 **테이블 AM**(`amtype='t'`)도 있습니다 - 행을 파일에 저장하는 방식 자체를 바꿉니다. 기본은 `heap` 하나뿐이고, OrioleDB · Citus columnar 등이 여기에 해당합니다.

> ⚠️ AM 을 추가하는 extension 은 PostgreSQL 내부 API 에 가장 민감합니다. 메이저 업그레이드 시 **가장 먼저 호환성을 확인할 대상**입니다.
