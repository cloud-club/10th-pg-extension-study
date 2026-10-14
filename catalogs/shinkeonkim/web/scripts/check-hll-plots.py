"""확인된 원본·생성 스크립트와 Lab 그림 파일의 일치 여부를 검사한다."""
import hashlib
import json
from pathlib import Path
WEB=Path(__file__).resolve().parents[1]
LAB=WEB/'labs/hll'
OUT=WEB/'public/hll/plots'
manifest=json.loads((OUT/'manifest.json').read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
assert manifest['generator_sha256']==sha(LAB/'plot-results.py'),'그림 생성 스크립트 변경: 재생성 필요'
for name,digest in manifest['inputs'].items():assert sha(LAB/'results'/name)==digest,f'{name} 변경: 그림 재생성 필요'
assert len(manifest['figures'])==9
for name,figure in manifest['figures'].items():
 for ext,digest in figure['files'].items():assert sha(OUT/(name+'.'+ext))==digest,f'{name}.{ext} 불일치'
for slug,count in [('lab-basics',2),('lab-union',2),('lab-precision',3),('lab-performance',2)]:
 text=(WEB/'content/hll'/(slug+'.md')).read_text()
 assert text.count('](/hll/plots/')==count,slug
raw=json.loads((LAB/'results/run.json').read_text())
assert f"{raw['daily_build']['Execution Time']:.2f}ms" in (WEB/'content/hll/lab-performance.md').read_text(),'초기 생성 해설의 수치도 갱신 필요'
print('hll Lab 4개: 실측·모델 그림 9개(SVG·PNG) 원본/생성물 검증 통과')
