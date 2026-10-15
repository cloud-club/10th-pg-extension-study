import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'shared'))
from common import sql, explain, nodes, save, environment, Session, docker
RESULT = Path(__file__).resolve().parent / 'results' / 'run.json'
sql("UPDATE public.tx_probe SET value='before' WHERE id=1", 'remote')
with Session() as reader:
    first = reader.query("BEGIN; SELECT value FROM remote_school.tx_probe WHERE id=1")
    sql("UPDATE public.tx_probe SET value='after' WHERE id=1", 'remote')
    second = reader.query("SELECT value FROM remote_school.tx_probe WHERE id=1")
    third = reader.query("COMMIT; SELECT value FROM remote_school.tx_probe WHERE id=1")
assert (first,second,third) == ('before','before','after'), (first,second,third)
sql("BEGIN; UPDATE writable_school.tx_probe SET value='rolled_back' WHERE id=1; ROLLBACK")
assert sql('SELECT value FROM public.tx_probe WHERE id=1','remote') == 'after'
with Session('remote') as locker:
    locker.query("BEGIN; UPDATE public.tx_probe SET value='held' WHERE id=1")
    try:
        sql("SET statement_timeout='1200ms'; UPDATE writable_school.tx_probe SET value='blocked' WHERE id=1", timeout=10)
        raise AssertionError('expected timeout under remote row lock')
    except RuntimeError as error:
        assert 'statement timeout' in str(error), error
        timeout_error = str(error)
    locker.query('ROLLBACK')
assert sql('SELECT value FROM public.tx_probe WHERE id=1','remote') == 'after'
sql("UPDATE public.tx_probe SET value='before' WHERE id=1",'remote')
save(RESULT, {'environment':environment(), 'snapshot':{'first':first,'within_transaction':second,'after_commit':third},
              'rollback_restored':True,'lock_timeout_error':timeout_error,
              'limits':'정상 롤백·스냅샷·잠금 취소 확인. 분산 커밋 장애 원자성의 증명 아님.'})
print('Lab 04: 스냅샷 유지, 정상 롤백, 원격 행 잠금 timeout 확인')
