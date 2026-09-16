# Lab 02 - GIN vs GiST

```bash
./run.sh          # 약 1분
```

> **두 가지 방법으로 볼 수 있습니다.**
>
> | | 명령 | 언제 |
> |---|---|---|
> | **자동** | `./run.sh` | 전체 흐름을 빠르게 훑어볼 때 |
> | **직접** | [`HANDS-ON.md`](HANDS-ON.md) | psql 에 접속해 **한 줄씩 쳐보며** 확인할 때 |
> 처음이라면 `./run.sh` 로 한 번 흘려보고, `HANDS-ON.md` 로 다시 짚어보는 순서를 권합니다.

`pg_bigm` 은 GIN 만 지원한다. `pg_trgm` 은 GiST 도 되는데 **그게 언제 이득이고 언제 손해인지**를 실행 시간이 아니라 **버퍼 수**로 확정한다.

조사 문서는 [`../../docs/`](../../docs)에, 종합 카탈로그 문서는 [`../../README.md`](../../README.md)에 있다.

## 왜 시간이 아니라 버퍼를 보나

이 스터디의 [`pg_bigm/experiments/02`](../../../pg_bigm/experiments/02-query-latency-at-scale) 는 실행 시간을 쟀다가 3회차에서 결과가 재현되지 않아 분석을 수정해야 했다. 컨테이너에서 CPU 를 공유하면 벽시계 시간은 쉽게 흔들린다.

반면 `EXPLAIN (ANALYZE, BUFFERS)` 의 **`Bitmap Index Scan` 이 돌려준 `actual rows`** 와 **`Buffers: shared hit`** 는 같은 데이터·같은 쿼리면 실행마다 거의 변하지 않는다. **"인덱스가 후보를 얼마나 좁혔나"** 라는 질문에는 이쪽이 정확한 답이다.

## 직접 확인한 것 (5만 행, 정답 1행)

| 인덱스 | 크기 | 인덱스 스캔 버퍼 |
| --- | ---: | ---: |
| `gin_trgm_ops` | 3,984 kB | **3** |
| `gist_trgm_ops` (siglen 기본 12) | 11 MB | **1,254** |
| `gist_trgm_ops(siglen=64)` | 11 MB | **3** |

- **부분 문자열 검색만 놓고 보면 GiST 는 GIN 의 상대가 안 된다** - 기본 siglen 에서 버퍼가 400배 차이났다.
- **그런데 `siglen=64` 로 올리면 이 데이터에서는 GIN 과 같아졌다.** 기본 96비트 시그니처가 이미 포화(`ALLISTRUE`)되어 필터 역할을 못 하고 있었다는 뜻이다. **인덱스 크기는 그대로인데 버퍼만 400배 줄었다** - "GiST 가 느리다"가 아니라 "기본 siglen 이 이 데이터에 안 맞았다"가 정확한 진단이었다.

  > **⚠️ 이 lab 의 데이터는 문장 8개를 5만 번 반복한 것이라 어휘가 극단적으로 좁다.** 실제 한국어 말뭉치(NSMC 20만 행)로 다시 재면 `siglen=64` 로는 **한참 부족하다** — 버퍼가 GIN 13 vs GiST 3,003~3,012 로 여전히 **약 231배**다. 256까지 올려야 412~432(약 32배)까지 좁혀진다. **"64면 충분하다"고 일반화하면 안 된다**: [`../../experiments/01-gin-vs-gist-build-and-probe/`](../../experiments/01-gin-vs-gist-build-and-probe) 참고.
- **GiST의 주요 활용 중 하나는 KNN이다.** `ORDER BY body <-> '검색어' LIMIT 3` 이 GIN 에서는 `Sort` 로, GiST 에서는 `Index Scan ... Order By` 로 나온다.

## 다음 단계

- 이전 lab: [`../01-install-and-trigram-anatomy/`](../01-install-and-trigram-anatomy)
- 다음 lab: [`../03-similarity-and-knn/`](../03-similarity-and-knn)
- 정량 실험: [`../../experiments/01-gin-vs-gist-build-and-probe/`](../../experiments/01-gin-vs-gist-build-and-probe)
