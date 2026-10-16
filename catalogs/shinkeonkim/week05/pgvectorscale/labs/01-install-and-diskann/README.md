# Lab 01 · 설치와 DiskANN

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- `pg_available_extension_versions`: **vector·vectorscale 모두 trusted가 아니다**(슈퍼유저 필요), `vectorscale`은 `requires={vector}`
- DiskANN 인덱스 빌드 NOTICE로 기본 파라미터(`num_neighbors`, `search_list_size`, `max_alpha`, `storage_layout`) 확인
- `diskann.*` GUC(`query_search_list_size`, `query_rescore` 등)와 `pg_opclass` 지원 연산자 클래스 - 단, 실행해보면 일부 GUC의 `short_desc`가 `\x13`처럼 깨진 텍스트로 나온다(pgvectorscale 0.9.1, 등록 과정의 사소한 버그로 보인다 - 기능에는 영향 없음)
- **라벨 기반 필터링**(`vector_smallint_label_ops`) - pgvector의 HNSW/IVFFlat에는 없는, DiskANN만의 2차 컬럼 인덱스 기능을 실제로 실행해본다. HNSW + `iterative_scan`과의 정확도·비용 비교는 [실험 07](../../../experiments/07-filtered-search-cost/)에 있다

실측 벤치마크(빌드 시간·크기·SBQ 압축 효과)는 [실험 02](../../../experiments/02-build-cost-and-size/)·[실험 03](../../../experiments/03-sbq-compression/)·[실험 04](../../../experiments/04-plain-build-memory-threshold/)에 있다 - 실험 03에서 압축을 끈(`plain`) 빌드가 서버를 죽인 적이 한 번 있었지만, 실험 04가 같은 조건을 9번 재현해도 다시 죽지 않아 "구조적으로 실패한다"는 해석은 철회됐다.

비슈퍼유저가 실제로 거절당하는 장면은 [HANDS-ON.md](HANDS-ON.md)에서 수동으로 재현한다.

이전 실습: [pgvector lab 02](../../../pgvector/labs/02-hnsw-vs-ivfflat/)
