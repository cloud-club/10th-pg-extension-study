/*-------------------------------------------------------------------------
 * myext.c - PostgreSQL C Extension 최소 예제
 *
 * 이 파일의 함수 5개는 "쓸모 있는 기능"이 아니라, C extension 이 지켜야 하는
 * 계약을 하나씩 눈으로 확인하는 장치다. 함수마다 아래 주석에
 * "무엇을 보나 / 어떻게 확인하나" 를 적어두었다.
 *
 *   (1) myext_add             - V1 호출 규약 · 오버플로는 작성자 책임
 *   (2) myext_hello           - 가변 길이(varlena) · palloc · 백엔드 pid
 *   (3) myext_double_or_zero  - STRICT 를 안 붙이면 NULL 이 C 까지 온다
 *   (4) myext_shout           - _PG_init 이 등록하는 GUC
 *   (5) myext_count_rows      - SPI (C 안에서 SQL 실행)
 *
 * 파일 전체에 걸친 것: PG_MODULE_MAGIC(ABI 검사) · PG_FUNCTION_INFO_V1 ·
 * _PG_init(로드 시점 훅)
 *-------------------------------------------------------------------------
 */
#include "postgres.h"      /* 반드시 첫 번째 include */

#include "fmgr.h"          /* Function Manager 매크로 */
#include "utils/builtins.h"/* cstring_to_text, text_to_cstring */
#include "utils/guc.h"     /* DefineCustomIntVariable */
#include "executor/spi.h"  /* SPI_connect 등 */
#include "miscadmin.h"

/*
 * ABI 매직 블록. .so 를 로드할 때 서버가 이 심볼을 찾아
 * PostgreSQL 메이저 버전 / 컴파일 옵션이 일치하는지 검사한다.
 * 빠뜨리면: ERROR: incompatible library "...": missing magic block
 */
PG_MODULE_MAGIC;

/* ---------------------------------------------------------------------
 * (1) myext_add(int, int) - 더하기
 *
 *   무엇을 보나 : V1 호출 규약의 최소형. Datum 으로 받아 Datum 으로 돌려준다.
 *   확인        : SELECT myext_add(2147483647, 1);
 *                 -> 에러가 아니라 -2147483648. 내장 + 는 "integer out of
 *                    range" 로 막아주지만, 여기서는 아무도 안 막아준다.
 *                    서버 안에서 도는 코드의 안전은 작성자 책임이라는 뜻.
 *                    실무라면 pg_add_s32_overflow() 로 직접 검사한다.
 * ------------------------------------------------------------------ */
PG_FUNCTION_INFO_V1(myext_add);

Datum
myext_add(PG_FUNCTION_ARGS)
{
    int32 a = PG_GETARG_INT32(0);
    int32 b = PG_GETARG_INT32(1);

    PG_RETURN_INT32(a + b);
}

/* ---------------------------------------------------------------------
 * (2) myext_hello(text) - 인사말 + 실행한 백엔드의 pid
 *
 *   무엇을 보나 : 가변 길이(varlena) 타입 다루기. text 는 널 종료 문자열이
 *                 아니라 길이가 앞에 붙은 구조라 변환이 필요하다.
 *                 그리고 palloc 메모리는 pfree 없이도 쿼리 끝에 사라진다.
 *   확인        : SELECT myext_hello('스터디');
 *                 -> 세션을 바꿔 다시 부르면 pid 가 다르다.
 *                    "C 코드는 내 백엔드 프로세스 안에서 돈다"가 눈에 보인다.
 * ------------------------------------------------------------------ */
PG_FUNCTION_INFO_V1(myext_hello);

Datum
myext_hello(PG_FUNCTION_ARGS)
{
    text *name = PG_GETARG_TEXT_PP(0);
    char *str  = text_to_cstring(name);   /* palloc 으로 할당됨 */
    char  buf[256];

    snprintf(buf, sizeof(buf), "Hello from C, %s! (pid=%d)", str, MyProcPid);

    /* palloc 된 메모리는 트랜잭션 끝에 자동 해제 - pfree 는 선택 사항 */
    PG_RETURN_TEXT_P(cstring_to_text(buf));
}

/* ---------------------------------------------------------------------
 * (3) myext_double_or_zero(int) - 두 배, NULL 이면 0
 *
 *   무엇을 보나 : STRICT 의 의미. 붙이면 PostgreSQL 이 NULL 을 걸러 C 함수를
 *                 아예 호출하지 않고, 안 붙이면 NULL 이 여기까지 넘어온다.
 *   확인        : SELECT myext_double_or_zero(NULL);  -> 0   (호출됨)
 *                 SELECT myext_add(1, NULL);          -> NULL (호출 안 됨)
 * ------------------------------------------------------------------ */
PG_FUNCTION_INFO_V1(myext_double_or_zero);

Datum
myext_double_or_zero(PG_FUNCTION_ARGS)
{
    if (PG_ARGISNULL(0))
        PG_RETURN_INT32(0);            /* NULL 이면 0 */

    PG_RETURN_INT32(PG_GETARG_INT32(0) * 2);
}

/* ---------------------------------------------------------------------
 * (4) myext_shout(text) - 설정값(myext.repeat_count)만큼 반복
 *
 *   무엇을 보나 : extension 이 자기 설정 파라미터(GUC)를 갖는 방법.
 *                 값은 아래 _PG_init() 에서 등록한 static 변수에 들어 있다.
 *   확인        : SET myext.repeat_count = 5;  후 다시 호출
 *                 SET myext.repeat_count = 999; -> min/max(1..100) 로 거부
 *                 SET LOCAL 로 바꾸면 COMMIT 과 함께 되돌아간다
 * ------------------------------------------------------------------ */
static int myext_repeat_count = 3;

PG_FUNCTION_INFO_V1(myext_shout);

Datum
myext_shout(PG_FUNCTION_ARGS)
{
    text          *arg = PG_GETARG_TEXT_PP(0);
    char          *str = text_to_cstring(arg);
    StringInfoData buf;
    int            i;

    initStringInfo(&buf);
    for (i = 0; i < myext_repeat_count; i++)
    {
        if (i > 0)
            appendStringInfoString(&buf, " ");
        appendStringInfoString(&buf, str);
        appendStringInfoChar(&buf, '!');
    }

    PG_RETURN_TEXT_P(cstring_to_text(buf.data));
}

/* ---------------------------------------------------------------------
 * (5) myext_count_rows(text) - 테이블 행 수 세기
 *
 *   무엇을 보나 : SPI. C 함수 안에서 다시 SQL 을 실행하는 통로다.
 *                 (PL/Python 의 plpy.execute 도 결국 이것이다)
 *   확인        : SELECT myext_count_rows('sample_rows');  -> count(*) 와 동일
 *                 SELECT myext_count_rows('no_such_table');
 *                 -> 백엔드가 죽는 게 아니라 평범한 SQL 에러가 난다
 * ------------------------------------------------------------------ */
PG_FUNCTION_INFO_V1(myext_count_rows);

Datum
myext_count_rows(PG_FUNCTION_ARGS)
{
    text  *relname = PG_GETARG_TEXT_PP(0);
    char  *rel     = text_to_cstring(relname);
    char   query[512];
    int64  result  = 0;
    int    ret;

    snprintf(query, sizeof(query),
             "SELECT count(*) FROM %s", quote_identifier(rel));

    if ((ret = SPI_connect()) != SPI_OK_CONNECT)
        elog(ERROR, "SPI_connect failed: %d", ret);

    ret = SPI_execute(query, true /* read_only */, 0);
    if (ret != SPI_OK_SELECT)
    {
        SPI_finish();
        elog(ERROR, "SPI_execute failed: %d", ret);
    }

    if (SPI_processed > 0)
    {
        bool  isnull;
        Datum d = SPI_getbinval(SPI_tuptable->vals[0],
                                SPI_tuptable->tupdesc, 1, &isnull);
        if (!isnull)
            result = DatumGetInt64(d);
    }

    SPI_finish();
    PG_RETURN_INT64(result);
}

/* ---------------------------------------------------------------------
 * _PG_init - 이 .so 가 프로세스에 처음 로드될 때 딱 한 번 호출된다.
 *
 * on-demand 로딩이면 "이 모듈의 함수가 처음 호출되는 순간",
 * shared_preload_libraries 면 "서버 시작 시" 호출된다.
 * ------------------------------------------------------------------ */
void
_PG_init(void)
{
    DefineCustomIntVariable("myext.repeat_count",
                            "myext_shout() 가 문자열을 반복할 횟수",
                            NULL,
                            &myext_repeat_count,
                            3,        /* 기본값 */
                            1, 100,   /* min, max */
                            PGC_USERSET,  /* 아무 세션에서나 SET 가능 */
                            0,
                            NULL, NULL, NULL);

    MarkGUCPrefixReserved("myext");

    elog(LOG, "myext: _PG_init() 호출됨 - 라이브러리가 로드되었다");
}
