# dblink · 직접 보내는 SQL과 직접 관리하는 수명

## 처음 이해하기: 표를 연결하는 것과 메시지를 보내는 것
postgres_fdw는 원격 표를 우리 DB의 foreign table로 등록해 SQL에 섞습니다. dblink는 “이 SQL을 저 DB에서 실행하고 이 모양의 결과를 돌려달라”는 메시지를 직접 보냅니다. 같은 결과를 얻어도 호출자가 맡는 책임이 다릅니다.

| 질문 | postgres_fdw | dblink |
| --- | --- | --- |
| 원격 SQL은 누가 구성하는가? | planner와 FDW | 호출자가 문자열 작성 |
| 반환 타입은 어디서 정하는가? | foreign table 정의 | 호출의 열·타입 선언 |
| 로컬 조건은 원격으로 가는가? | 전송 가능성과 계획에 따라 | 문자열 안에 넣은 조건이 핵심 |
| 세션·트랜잭션 수명은? | 로컬 트랜잭션에 대응 | 명시적 원격 명령 관리 |

## 기본 예제와 타입 계약
```sql
SELECT * FROM dblink(
 'host=remote dbname=school user=fdw_reader password=study_only',
 'SELECT id,title FROM public.books WHERE id<=3 ORDER BY id'
) AS r(id integer,title text);
```
학교 책 목록 세 행을 읽는 기존 전용 Lab 예제입니다. 비밀번호는 학습용이며 실제 접속 정보는 권한을 제한한 mapping·비밀 관리 방식으로 관리합니다. 반환 열 개수와 문자열의 타입 변환 가능성을 확인해야 합니다. 별칭의 이름이 같다는 이유만으로 원격 타입과 정확히 일치한다고 보장되지 않습니다. [dblink 호출 계약](https://www.postgresql.org/docs/18/contrib-dblink-function.html)

## 심화: 바깥 WHERE는 원격 SQL의 일부가 아니다
```sql
SELECT * FROM dblink(
 'host=remote dbname=school user=fdw_reader password=study_only',
 'SELECT id,title FROM public.books'
) AS r(id integer,title text)
WHERE id<=3;
```
이 코드의 원격 문자열에는 필터가 없습니다. 바깥 WHERE를 작성했다고 원격에 id<=3이 자동 삽입된다고 가정하지 않습니다. 필요한 필터·JOIN·집계를 문자열 안에 작성하고 원격 계획을 조사합니다. 사용자 값을 문자열에 단순 연결하지 말고 format의 %L·%I 등 값과 식별자를 구분하는 방법을 사용합니다. [format 공식 문서](https://www.postgresql.org/docs/18/functions-string.html)

## named connection과 cursor
```sql
SELECT dblink_connect('books_session',
 'host=remote dbname=school user=fdw_reader password=study_only');
SELECT dblink_open('books_session','books_cursor',
 'SELECT id,title FROM public.books WHERE id<=3 ORDER BY id');
SELECT * FROM dblink_fetch('books_session','books_cursor',2)
 AS r(id integer,title text);
SELECT * FROM dblink_fetch('books_session','books_cursor',2)
 AS r(id integer,title text);
SELECT dblink_close('books_session','books_cursor');
SELECT dblink_disconnect('books_session');
```
이 추가 수동 예제는 두 행과 한 행으로 나누어 읽습니다. dblink_open은 필요한 경우 원격 트랜잭션을 열며 자신이 연 트랜잭션의 종료를 cursor 정리와 연계합니다. 기존에 명시적 BEGIN이 있으면 호출자가 그 종료까지 관리합니다. [cursor와 트랜잭션](https://www.postgresql.org/docs/18/contrib-dblink-open.html), [연결 설정](https://www.postgresql.org/docs/18/contrib-dblink-connect.html)
오류 경로에도 rollback·cursor·connection 정리가 필요합니다. 로컬 ROLLBACK만으로 이미 완료된 원격 변경을 되돌린다고 가정하지 않습니다. async API도 분산 원자성을 추가하는 기능은 아닙니다.

## 성능과 부하를 어떻게 비교할까?
동일 정답으로 원격 SQL·결과 건수·행 폭·연결 생성 횟수·cursor 왕복을 비교합니다. 대량 결과에서 일반 호출과 cursor 호출의 반환·보관 방식도 조사합니다. postgres_fdw의 fetch_size를 dblink의 옵션처럼 적용하지 않습니다. 여기서는 dblink_fetch의 fetch 건수를 호출자가 지정합니다.

## Lab과 사례 연결
기존 [Lab 05](../labs/05-connections-and-related/HANDS-ON.md)는 일회성 dblink 조회를 실행·검증했습니다. 위 named cursor와 실패 경로는 추가 수동 학습 예제이며 자동 검증 완료 결과로 표시하지 않습니다. [국내 기업 사례](../industry-cases.md)의 매드업 예제를 볼 때 server 객체를 정의한 부분과 실제 dblink 실행을 나누어 읽습니다.
복습: 바깥 WHERE가 id<=3이어도 원격에서 전체 행을 요청할 수 있는 이유를 설명해 봅니다. 다음은 [file_fdw](file-fdw.md)입니다.
