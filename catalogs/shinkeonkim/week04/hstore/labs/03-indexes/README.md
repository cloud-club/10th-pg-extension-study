# Lab 03 · 인덱스

```bash
./run.sh       # 자동 실행 (데이터 생성 포함, 수십 초)
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- 카탈로그로 조회한 지원 연산자 표 (GIN·GiST: `@>` `?` `?&` `?|`, btree·hash: `=`)
- GIN이 `@>` `?` `?&` `?|`에 쓰이는지, `->` 비교에는 쓰이지 않는지
- `Rows Removed by Index Recheck` — GIN이 후보를 넣고 힙에서 걸러 내는 행 (decoy 500)
- 식 인덱스 `((attrs -> 'brand'))`
- GiST siglen 16/128의 크기, GIN·btree 식 인덱스와의 크기 비교

자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

웹 자료: `#/hstore/indexes` · 반복 실험: [`../experiments/03-index-and-query/`](../experiments/03-index-and-query/)

이전 실습: [Lab 02](../02-storage-and-toast/) · 다음 실습: [Lab 04 · 동시성](../04-concurrency/)
