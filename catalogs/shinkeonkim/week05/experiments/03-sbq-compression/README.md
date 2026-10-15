# 실험 03 — DiskANN의 SBQ 압축(memory_optimized) vs 비압축(plain)

2026-10-04, PostgreSQL 16.15 / pgvectorscale 0.9.1, Docker(공유 CPU 3개, RAM 3.8GiB). [bench.py](bench.py)

> **정정(실험 04에서 확인, 2026-10-04 같은 날)**: 아래 "`plain`은 메모리를 감당 못해 죽는다"는 결론을 **철회한다.** 같은 조건(51,000행·128차원·`maintenance_work_mem=1GB`, 심지어 같은 빌드 순서)을 [실험 04](../04-plain-build-memory-threshold/)에서 9번 재현했지만 단 한 번도 다시 죽지 않았다 - 이 크래시는 재현 가능한 현상이 아니라 **그 순간의 단발성 사건**이었던 것으로 보인다. 이 문서는 "무엇이 실제로 일어났는가"의 기록으로 그대로 남기고, 해석은 실험 04를 따른다.

## 왜 이 실험이 필요했는가

실험 02는 DiskANN 인덱스가 테이블 대비 항상 0.79배로 작다는 것을 확인했지만, **그 실험은 항상 압축이 켜진 기본값(`memory_optimized`)만 쟀다** - "압축을 켰을 때와 껐을 때"를 직접 대조한 적이 없어서, 그 작은 크기가 정말 SBQ 압축 때문인지(압축을 끄면 커지는지) 확인되지 않은 채로 남아 있었다. 또한 `pgvectorscale.md`의 트레이드오프 절은 "압축은 보통 recall을 희생해 크기를 줄인다"는 **양자화 일반론을 추정으로** 적어뒀을 뿐, 이 확장에서 실제로 그런지는 검증하지 않았다. `storage_layout` 옵션으로 같은 데이터에서 압축 유무를 직접 바꿀 수 있다는 것을 확인했으므로(사전 테스트), 그 가정을 직접 대조하기로 했다.

## 가설

**H1.** `storage_layout=plain`(압축 끔)은 `memory_optimized`(기본값, 압축 켬) 대비 인덱스가 **더 크고**, 같은 `query_search_list_size`에서 recall이 **더 높거나 비슷**하며 버퍼 비용은 **더 낮거나 비슷**할 것이다(압축이 없으니 정보 손실이 없어 recall 쪽은 유리하고, 그 대가로 크기가 커질 것이라는 전형적인 양자화 트레이드오프 예상).

## 방법

- 실험 01과 같은 데이터(배경 50,000 + 질의 50개당 근접점 20개, 128차원) 위에 `storage_layout`만 바꿔 DiskANN 인덱스를 다시 만든다.
- `diskann.query_search_list_size = 100`(기본값)으로 고정하고 recall@10·버퍼·시간을 비교한다.

## 결과 — `plain` 빌드가 서버를 죽였다

| storage_layout | 빌드 시간 | 인덱스 크기 | recall@10 | 버퍼/질의 | 중앙값 ms/50질의 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `memory_optimized`(기본값, SbqCompression) | 49.8초 | 23.5MB | 1.000 | 6,697.5 | 105.1 |
| `plain` | **서버 프로세스가 죽었다** | - | - | - | - |

`plain`으로 `CREATE INDEX`를 실행하자 빌드 NOTICE(`storage_layout=Plain.`)까지는 정상 출력됐지만, 그 직후 `FATAL: terminating connection due to administrator command` / `server closed the connection unexpectedly`로 연결이 끊겼다. (이 크래시에 대한 해석은 맨 위 정정을 따른다 - 이하 "가설 검증"·"해석"·"한계"에서는 반복하지 않는다.)

## 가설 검증

**H1 - 검증 불가(inconclusive).** `plain` 쪽 측정값이 없어 "크기·recall·버퍼가 어떻게 다른가"라는 원래 질문에는 채택도 기각도 할 수 없다. 이 실험 당시에는 가설이 암묵적으로 전제했던 것(**"압축을 꺼도 빌드는 완주한다"**)이 깨진 것 자체를 결과로 적었지만, 맨 위 정정에서 밝혔듯 그 전제는 이 조건에서 일반적으로 성립한다 - 남는 사실은 "그날 그 순간, 그 한 번은 죽었다"뿐이다.

## 해석

- `memory_optimized`(기본값)는 51,000행에서 recall@10 = 1.000(실험 01의 2회 반복과 일치), 인덱스 23.5MB - 실험 02에서 측정한 50,000행 근방 수치와도 일관된다.
- 이름 불일치를 하나 발견했다: `WITH (storage_layout = ...)` 옵션 값은 `plain` / `memory_optimized`인데, 빌드 로그(NOTICE)는 `Plain.` / `SbqCompression.`으로 **다른 이름**을 쓴다. 코드를 모르고 로그만 보면 옵션 이름을 추측하기 어렵다 - 실제로 처음에는 로그의 `SbqCompression`을 그대로 옵션 값으로 썼다가 `ERROR: Invalid storage type. Must be either 'plain' or 'memory_optimized'`를 만났다.

## 한계

- `plain` 쪽 측정값(크기·recall·버퍼)이 여전히 없다. [실험 04](../04-plain-build-memory-threshold/)가 "완주하는가"는 재확인했지만(9번 다 성공), 이 실험이 원래 보려던 수치까지 재지는 않았다 - 다음 과제로 남는다.
- `memory_optimized` 결과 1행만으로는 반복성을 확인할 수 없다 - 재현성은 실험 01(같은 조건)의 2회 반복 결과로 간접 확인한다(그쪽도 recall@10 = 1.000으로 일치했다).

재현: `python3 bench.py`(메모리가 더 넉넉한 환경에서 `plain` 완주 여부를 확인해볼 수 있다). 원본 JSON은 [results/run.json](results/run.json) - `plain` 설정이 빠진 채로 저장되어 있다(스크립트가 크래시 지점에서 멈춰 `save()`를 못 불렀기 때문에, 이 README 작성 후 `memory_optimized` 결과만 수동으로 받아 적었다).
