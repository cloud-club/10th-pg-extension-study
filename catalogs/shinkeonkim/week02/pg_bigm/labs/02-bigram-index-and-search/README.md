# Lab 02 - 2-gram 인덱스로 LIKE 검색 가속하기

```bash
./run.sh          # 약 30초
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

이 lab 은 `pg_bigm` 의 핵심 기능 - 2-gram 분해, GIN 인덱스, 한글 검색, 그리고 Recheck 이 왜 필요한지를 다룬다.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## 이 lab 에서 확인하는 것

| | |
|---|---|
| `show_bigm()` | 텍스트가 2글자씩 겹쳐 쪼개지는 걸 직접 확인 (한글 포함) |
| `CREATE INDEX ... USING gin (col gin_bigm_ops)` | 별도 문법 없이 기존 `LIKE` 쿼리가 인덱스를 탄다 |
| Recheck | "trial" 검색에 "trivial" 이 후보로 걸렸다가 걸러지는 과정을 `EXPLAIN ANALYZE` 로 직접 본다 |
| `likequery()` | 사용자 입력을 안전하게 LIKE 패턴으로 이스케이프 |

## 직접 겪은 함정

- **`pg_bigm.enable_recheck` 를 끄면 오답이 그대로 결과에 남는다** - "It was a trivial mistake" 가 "trial" 검색 결과에 섞여 나오는 걸 직접 확인한다. 기본값(on)을 유지해야 하는 이유.
- **한글은 기본 설정 그대로 잘 된다.** 다만 "`pg_trgm` 은 `KEEPONLYALNUM` 때문에 한글을 걸러낸다"는 흔한 설명은 **틀렸다** - `show_trgm('가나다라')` 는 조각 5개를 정상 생성한다(직접 확인). 단어 경계 없는 짧은 패턴에서 pg_trgm의 후보 축소가 어려운 이유는 **2글자 검색어에서 트라이그램을 못 만든다**는 것이고, 구두점(`192.168.0.1`)이 쪼개지는 것은 한글과 무관한 별개 문제다. 정리: [`../../../bigm-vs-trgm/docs/01-ngram-index-internals.md`](../../../bigm-vs-trgm/docs/01-ngram-index-internals.md)

## 다음 lab

- 이전: [`../01-preload-and-guc-registration/`](../01-preload-and-guc-registration)
- 다음: [`../03-similarity-and-functions/`](../03-similarity-and-functions) - 유사도 검색과 `pg_trgm` 과의 차이
