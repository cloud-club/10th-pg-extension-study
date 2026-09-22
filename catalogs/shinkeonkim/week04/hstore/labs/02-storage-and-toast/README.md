# Lab 02 · 저장 구조와 TOAST

```bash
./run.sh       # 자동 실행
./run.sh psql  # 수동 실습용 접속
```

## 확인 항목

- `heap_page_items`로 얻은 튜플에서 hstore 바이트 잘라 내기
- 헤더 해독: 1바이트 짧은 헤더 길이, `size_`의 쌍 개수와 새 형식 플래그
- HEntry 해독: ISFIRST·ISNULL 비트와 문자열 영역 안의 끝 위치, 길이는 앞 항목과의 차이
- 정렬(길이 → 바이트), 중복 제거, NULL 값의 문자열 영역 미사용
- 크기 공식과 `pg_column_size`, NULL 값과 빈 문자열의 크기(같다)
- 키 200개짜리 값의 TOAST·압축, hstore vs jsonb, 끝 위치 배열 vs 길이 배열의 압축 대조
- 키 하나 UPDATE 후 TOAST 증가량 (값 전체 재기록)

자동 실행 단계와 판정 기준은 [LESSON.md](LESSON.md), 수동 절차는 [HANDS-ON.md](HANDS-ON.md)에 있다.

웹 자료: `#/hstore/storage`, `#/hstore/updates`

이전 실습: [Lab 01](../01-install-and-syntax/) · 다음 실습: [Lab 03 · 인덱스](../03-indexes/)
