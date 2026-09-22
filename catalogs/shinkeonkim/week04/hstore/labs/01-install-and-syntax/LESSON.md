# hstore lab 01 — 설치와 문법

Docker Engine과 Compose v2가 실행 중이어야 한다.
처음 빌드에는 네트워크가 필요하며 이후는 캐시를 사용한다.

1. 설치 전 `pg_available_extensions`로 hstore가 서버에 있는지 확인하고 `CREATE EXTENSION`으로 설치한다. trusted·relocatable 값과 설치된 객체 종류를 본다.
2. 리터럴 규칙을 확인한다: 공백 무시, 따옴표, 키 길이 → 바이트 순 정렬, 중복 키 하나만 남음, NULL 값과 "NULL" 문자열의 차이, 값은 전부 text.
3. 상품 예제 테이블로 `->` `?` `?&` `?|` `@>` `<@` `||` `-` 와 `akeys` `each` `slice` `hstore()` `populate_record`를 실행한다.
4. hstore 1.8 첨자로 읽고 쓰고, `||`·`-`로 갱신하며, json/jsonb 변환(strict / loose)과 jsonb → hstore 변환에서 타입이 사라지는 것을 본다.

해석: 값이 text라는 사실이 모든 문법의 바탕이다. 숫자로 쓰려면 캐스팅이 필요하고, 그 캐스팅을 빠뜨리면 조용히 다른 결과(문자열 정렬)가 나온다.

실습 설정: PostgreSQL 16.15 (이미지 다이제스트 고정), hstore 1.8.
명령: ./run.sh (자동 실행), ./run.sh up (기동만), ./run.sh explain (이 안내).
SQL은 ./run.sh sql로 다시 실행한다. 수동 실습은 HANDS-ON.md와 ./run.sh psql을 쓴다.
종료 후 DB와 테이블은 관찰을 위해 남는다. ./run.sh down으로 전용 컨테이너와 볼륨을 지운다.
처음부터 재현하려면 ./run.sh down 후 ./run.sh를 실행한다. 실패 시 docker compose logs로 확인한다.
