# Lab 01 · 연결과 메타데이터

기본 01~03. 서버·DB·역할·스키마·테이블을 구분한다.

```bash
./run.sh
./run.sh up
./run.sh psql
./run.sh remote
```

[학습 목표와 해석](LESSON.md) · [수동 실습](HANDS-ON.md)

자동 SQL은 `sql/`, 검증은 `verify.py`, 실제 결과는 `results/run.json`에 있다. 시간 숫자보다 기능·정답·처리 위치의 검증을 먼저 읽는다. 자동 실행은 공유 환경을 준비한 후 SQL과 assert 검증을 수행한다.

공유 환경은 전용 Compose 프로젝트 `shinkeonkim-week07-fdw-labs`의 두 DB다. 호스트 포트를 공개하지 않으며 PostgreSQL 18.6을 사용한다. 다른 Lab과 동시에 server 옵션을 바꾸는 실험은 하지 않는다. 최초 이미지 다운로드에는 네트워크가 필요하다. Python 3와 Docker Compose v2가 필요하며 추가 Python 패키지는 없다.

`./run.sh down`으로 **모든 Lab의 공유 실습 컨테이너·볼륨**을 정리한다. 재현은 처음부터 다시 가능하다.

[다음 Lab](../02-pushdown-and-search/README.md)
