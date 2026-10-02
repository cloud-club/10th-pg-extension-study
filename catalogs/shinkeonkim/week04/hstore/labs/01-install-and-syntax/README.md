# Lab 01 · 설치와 기본 문법

```bash
./run.sh       # 자동 실행
./run.sh up    # 컨테이너만 시작
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- `pg_available_extensions`·`pg_available_extension_versions`: 설치 가능 여부, trusted, relocatable
- 리터럴: 공백·따옴표·정렬 순서(키 길이 → 바이트)·중복 키·NULL 값·빈 문자열
- 연산자 `->` `?` `?&` `?|` `@>` `<@` `||` `-`, 함수 `akeys` `each` `slice` `hstore()` `populate_record`
- 첨자 `attrs['k']`(읽기·쓰기)와 NULL 첨자의 동작
- `hstore_to_json(b)`, `hstore_to_jsonb_loose`, jsonb → hstore

자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

웹 자료: `#/hstore/install-syntax` — 이 실습의 출력이 그대로 실려 있다.

다음 실습: [Lab 02 · 저장 구조와 TOAST](../02-storage-and-toast/)
