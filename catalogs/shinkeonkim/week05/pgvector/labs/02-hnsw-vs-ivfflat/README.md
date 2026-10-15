# Lab 02 · HNSW vs IVFFlat — 빌드 순서와 튜닝 손잡이

```bash
./run.sh       # 자동 실행
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- **IVFFlat은 빈 테이블에 먼저 만들면 안 된다** - k-means 중심을 빌드 시점 데이터로 학습하기 때문(pgvector 공식 문서가 직접 경고). 단, **인덱스 크기로는 이 문제가 드러나지 않는다** - 직접 실행하면 두 경우 크기가 같게 나온다. 빈 테이블에 만들면 `NOTICE: ivfflat index created with little data`가 뜬다. recall은 같은 5,000행·8차원·`lists=10`·`probes=1`에서 질의 100개 기준 0.655 vs 0.712로 방향은 경고대로 낮았지만 차이는 작았다(웹 자료 캡처 스크립트 `web/scripts/capture-pgvector-demo.py`에서 측정).
- HNSW는 그래프 구조라 이 제약이 없다 - 점진적 삽입이 가능하다.
- `ivfflat.probes` · `hnsw.ef_search`를 바꿔가며 `EXPLAIN (ANALYZE, BUFFERS)`로 버퍼 변화를 직접 본다.

정확한 recall@10 측정은 [실험 01](../../../experiments/01-recall-vs-tuning/)에 있다 - 이 lab은 "왜 이런 손잡이가 있는가"를 눈으로 확인하는 용도다.

이전 실습: [Lab 01 · 설치와 거리 연산자](../01-install-and-distance-ops/)
다음: [pgvectorscale lab 01 · 설치와 DiskANN](../../../pgvectorscale/labs/01-install-and-diskann/)
