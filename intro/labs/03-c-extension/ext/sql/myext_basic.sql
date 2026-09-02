-- PGXS 회귀 테스트: make installcheck 가 이 파일을 실행하고
-- 결과를 expected/myext_basic.out 과 diff 한다.
CREATE EXTENSION myext;
SELECT myext_add(2, 3);
SELECT myext_double_or_zero(21);
SELECT myext_double_or_zero(NULL);
SET myext.repeat_count = 2;
SELECT myext_shout('pg');
DROP EXTENSION myext;
