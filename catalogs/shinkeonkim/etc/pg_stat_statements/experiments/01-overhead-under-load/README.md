# 실험 01 — 부하 상태에서 pg_stat_statements 오버헤드 측정

## 질문

`docs/04-production-playbook.md` 는 커뮤니티에서 자주 인용되는 "대체로 1~5%" 라는 오버헤드 수치를 근거 없이(1차 측정 없이) 적어뒀다. 실제로 이 lab 환경에서 pg_stat_statements 를 켜면 처리량(TPS)이 얼마나 떨어지는가? `track=all`, `track_planning=on`, `track_io_timing=on` 을 하나씩 더 켤 때마다 오버헤드가 누적되는가?

## 방법

- `pgbench` 기본 워크로드(TPC-B 유사), `pgbench -i -s 10`: accounts 1,000,000행. `-c 4 -j 2 -T 15`: 동시 연결 4, 클라이언트 스레드 2, 15초 측정.
- 4가지 설정마다 컨테이너와 데이터 디렉터리를 새로 만든다. 초기 상태를 맞추지만 호스트 캐시·발열·고정 실행 순서의 영향까지 통제하지는 못한다:
  1. `baseline` - `pg_stat_statements` preload 및 CREATE EXTENSION 안 함 (공유 라이브러리는 이미지에 존재)
  2. `track_top` - preload, `track=top`(기본값), `track_planning=off`
  3. `track_all` - preload, `track=all`
  4. `full` - preload, `track=all` + `track_planning=on` + `track_io_timing=on`
- 각 설정마다: 초기화 → 5초 워밍업(측정 제외) → **15초 측정을 3회 반복**. pgbench 클라이언트는 컨테이너 **안에서** 유닉스 소켓이 아닌 `127.0.0.1` TCP 로 접속해 실행했다(호스트 포트포워딩 왕복을 측정에 섞지 않기 위해).
- 재현: `./bench.sh` (전체, ~4분) 또는 `./bench.sh quick` (설정당 1회, 참고용).

**환경**: Docker Desktop on macOS (Apple Silicon arm64), 컨테이너에 할당된 `nproc` = 12, 메모리 ~47GB 여유. 다른 프로세스와 CPU/메모리를 공유하는 노트북/개발 머신이며, 격리된 베어메탈이 아니다.

## 결과

3회 측정의 평균 ± 표준편차, `baseline` 대비 처리량 손실 비율:

| 설정 | n | 평균 TPS | 표준편차 | baseline 대비 |
| --- | --- | --- | --- | --- |
| baseline | 3 | 6437.3 | 39.1 | - |
| track_top (기본값) | 3 | 6204.0 | 112.7 | **-3.6%** |
| track_all | 3 | 6051.8 | 175.8 | **-6.0%** |
| full (all+planning+io_timing) | 3 | 6044.0 | 303.3 | **-6.1%** |

원본 측정값(회차별):
```
baseline    6404.97  6480.66  6426.14
track_top   6223.75  6305.45  6082.69
track_all   5853.15  6187.50  6114.70
full        6354.06  5747.95  6029.87
```

## 분석과 한계

- 과거 3회 평균에서 track_top은 baseline 대비 TPS가 3.6%, track_all은 6.0%, full은 6.1% 낮았다. **TPS 손실률이며 CPU 오버헤드 측정값은 아니다.**
- 기본 pgbench 스크립트는 중첩 SQL을 유발하지 않는다. 따라서 top/all 차이를 "중첩 SQL 수집 비용"으로 설명할 수 없다. 짧은 순차 측정의 잡음·캐시·호스트 부하도 후보 원인이다.
- planning·I/O 시간 측정의 추가 비용은 이 표만으로 분리할 수 없다. 표준편차 증가를 확장 기능의 인과 효과로 단정하지 않는다. 계획 시간이 길수록 상대적 계측 비용이 커진다는 근거도 없다.
- 기존 별도 실행 기록의 평균은 baseline 6403.8, top 6300.5, all 6287.6, full 6280.9 TPS였다. 원 측정과 크기가 다르므로 일반적인 1~5% 범위나 단조 감소를 보장하지 않는다.
- 공유 macOS/Docker 환경에서 설정별 15초×3회, 고정 순서로 측정했다. 신뢰구간·순서 교차·여러 부하의 비교가 없어 통계적으로 유의한 차이인지 판단하지 않았다.
- scale 10 데이터가 전부 shared_buffers에 들어간다거나 디스크 I/O가 없다고 확인하지 않았다. 버퍼 크기와 WAL·체크포인트·OS 캐시를 별도로 측정해야 한다.
- 과거 원시 수치는 위 결과 표에 보존한다. 현재 이미지의 실행 점검과 과거 성능 측정을 구분한다.

## 재현

```bash
./bench.sh          # 전체 스윕 (4 설정 x 3회, ~4분)
./bench.sh quick    # 설정당 1회만 (참고용, 신뢰도 낮음)
```
