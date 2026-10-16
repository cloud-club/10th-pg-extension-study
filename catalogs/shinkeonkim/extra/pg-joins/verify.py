"""결과 건수와 관측하려는 계획 노드를 확인한다."""
import re
from pathlib import Path
text = (Path(__file__).parent/'results/plan.txt').read_text()
cases = dict(re.findall(r'CASE ([\w-]+)\n(.*?)(?=CASE |\Z)',text,re.S))
for case,node in [('nested-loop','Nested Loop'),('hash','Hash Join'),('merge','Merge Join'),('bitmap','BitmapOr')]:
    assert node in cases[case], (case,node)
    expected=1990 if case=='bitmap' else 1000
    assert re.search(r'verified_rows\s*\n-+\s*\n\s*'+str(expected)+r'\s*\n',cases[case]), (case,'count')
low=int(re.search(r'Batches: (\d+)',cases['hash-low-memory'])[1])
high=int(re.search(r'Batches: (\d+)',cases['hash-high-memory'])[1])
assert low>1 and high==1,(low,high)
assert 'temp read=' in cases['hash-low-memory']
print(f'JOIN 3개·결과 건수·BitmapOr·해시 배치 검증 통과: {low} → {high}')
