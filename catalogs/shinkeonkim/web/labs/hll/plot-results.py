"""원본 결과에서 Lab 설명용 SVG·PNG를 생성한다. DB를 변경하지 않는다."""
import hashlib
import json
import math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FuncFormatter
from matplotlib.patches import Rectangle
ROOT=Path(__file__).resolve().parent
WEB=ROOT.parents[1]
OUT=WEB/'public/hll/plots';OUT.mkdir(parents=True,exist_ok=True)
font_candidates=[Path('/System/Library/Fonts/AppleSDGothicNeo.ttc'),Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')]
for path in font_candidates:
 if path.exists():
  font_manager.fontManager.addfont(str(path))
  plt.rcParams['font.family']=font_manager.FontProperties(fname=str(path)).get_name();break
else:raise SystemExit('한국어 폰트가 필요합니다: Apple SD Gothic Neo 또는 Noto Sans CJK')
plt.rcParams.update({'font.size':12,'axes.titlesize':15,'axes.labelsize':12,'axes.unicode_minus':False,'svg.hashsalt':'hll-labs-v1','figure.facecolor':'white','axes.spines.top':False,'axes.spines.right':False})
d=json.loads((ROOT/'results/run.json').read_text())
s=json.loads((ROOT/'results/storage.json').read_text())
days=json.loads((ROOT/'results/daily-ranges.json').read_text())
assert len(days)==7 and all(row['exact_users']==10000 for row in days)
assert min(row['first_id'] for row in days)==1 and max(row['last_id'] for row in days)==25000
BLUE='#2563eb';PURPLE='#7c3aed';TEAL='#0f766e';RED='#b91c1c';GREY='#64748b'
manifest={'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'matplotlib':matplotlib.__version__,'inputs':{},'figures':{}}
for name in ['run.json','storage.json','daily-ranges.json']:
 manifest['inputs'][name]=hashlib.sha256((ROOT/'results'/name).read_bytes()).hexdigest()
def save(fig,name,title):
 fig.savefig(OUT/(name+'.svg'),bbox_inches='tight',metadata={'Date':None})
 fig.savefig(OUT/(name+'.png'),bbox_inches='tight',dpi=170,metadata={'Software':'hll plot-results.py'})
 plt.close(fig)
 manifest['figures'][name]={'title':title,'files':{ext:hashlib.sha256((OUT/(name+'.'+ext)).read_bytes()).hexdigest() for ext in ['svg','png']}}
def fmt(ax):
 ax.yaxis.set_major_formatter(FuncFormatter(lambda x,_:f'{x:,.0f}'))
 ax.grid(axis='y',alpha=.18);ax.set_axisbelow(True)
# 01: default explicit list versus explicitly forced FULL, both measured.
fig,(a,b)=plt.subplots(2,1,figsize=(8,7),gridspec_kw={'height_ratios':[1,1.5]},layout='constrained')
a.axis('off');a.set_title('기본 설정: ID 17·17·28·39 → 고유 해시 3개 보관',loc='left')
for j,(key,h) in enumerate([(17,s['inputs'][0]['hash']),(28,s['inputs'][2]['hash']),(39,s['inputs'][3]['hash'])]):
 x=.02+j*.325;a.add_patch(Rectangle((x,.28),.30,.43,facecolor='#eff6ff',edgecolor=BLUE,lw=1.3));a.text(x+.15,.51,f'ID {key}의 해시\n{h[:9]}…',ha='center',va='center',fontsize=12)
a.text(.02,.07,'EXPLICIT: 원본 방문 시각·페이지는 저장하지 않음. ID 17의 중복 해시는 한 개.',fontsize=11)
b.bar(range(16),s['registers'],color=[PURPLE if n else '#e2e8f0' for n in s['registers']]);b.set_xticks(range(16));b.set_ylim(0,3);b.set_yticks([0,1,2,3]);b.set_xlabel('레지스터 번호');b.set_ylabel('저장된 rank (사람 수 아님)');b.set_title('FULL 강제 설정: 16개 칸 중 7번·14번에 rank 2만 남음',loc='left')
for idx in [7,14]:b.text(idx,2.08,'2',ha='center',color=PURPLE,weight='bold')
b.text(.02,.89,'17 → 7번/rank 2, 28 → 14번/rank 2, 39 → 7번/rank 1 (유지)',transform=b.transAxes,fontsize=10)
fmt(b);save(fig,'lab01-stored-values','실제 저장: 작은 해시 목록과 강제 FULL 레지스터 비교')
fig,ax=plt.subplots(figsize=(8,4.8),layout='constrained')
tr=[x for x in d['transitions'] if x['n']>0];ax.plot([x['n'] for x in tr],[x['binary_bytes'] for x in tr],color=GREY,lw=1.2)
types={2:('EXPLICIT',BLUE),3:('SPARSE',TEAL),4:('FULL',PURPLE)}
for t,(label,c) in types.items():
 rows=[x for x in tr if x['type']==t];ax.scatter([x['n'] for x in rows],[x['binary_bytes'] for x in rows],s=70,color=c,label=label,zorder=3)
ax.set_xscale('log');ax.set_xticks([1,10,160,1000,10000],labels=['1','10','160','1,000','10,000']);ax.set_ylabel('hll_send 직렬화 크기 (bytes)');ax.set_xlabel('입력 고유 개수 (로그 축)');ax.set_title('160 → 161: 저장 방식 변경으로 크기가 줄어듦',loc='left')
ax.annotate('160개: 1,283 B\n161개: 317 B',xy=(161,317),xytext=(260,620),arrowprops={'arrowstyle':'->','color':TEAL},color=TEAL)
ax.legend(loc='lower right');fmt(ax);save(fig,'lab01-storage-size','고유 개수별 표현과 직렬화 크기')
# 02: measured per-day ID ranges and exact/estimate comparisons.
fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
for i,row in enumerate(days):
 ax.broken_barh([(row['first_id'],row['last_id']-row['first_id']+1)],(i-.3,.6),facecolors=BLUE,alpha=.70)
 ax.text(row['last_id']+250,i,f"{row['first_id']:,}–{row['last_id']:,}",va='center',fontsize=10)
ax.set_yticks(range(7),labels=[x['day'] for x in days]);ax.invert_yaxis();ax.set_xlim(0,32000);ax.set_xlabel('사용자 ID 범위');ax.set_title('매일 10,000명 중 다음 날에도 다시 등장하는 ID가 있음',loc='left');ax.xaxis.set_major_formatter(FuncFormatter(lambda x,_:f'{x:,.0f}'));ax.grid(axis='x',alpha=.2)
save(fig,'lab02-overlap','원본 SQL로 확인한 날짜별 사용자 ID 범위')
w=d['weekly'];vals=[w['sum_daily_exact'],w['sum_daily_estimates'],w['exact'],w['merged']]
fig,ax=plt.subplots(figsize=(8,5),layout='constrained');bars=ax.bar(['일별 정확값\n단순 합','일별 추정값\n단순 합','주간 정확값\nCOUNT DISTINCT','스케치 병합\n주간 추정'],vals,color=[GREY,GREY,BLUE,PURPLE]);ax.axhline(w['exact'],color=BLUE,ls='--',lw=1,label='정확한 주간 고유 수')
for bar,val in zip(bars,vals):ax.text(bar.get_x()+bar.get_width()/2,val+1500,f'{val:,.0f}',ha='center')
ax.set_ylim(0,85000);ax.set_ylabel('사용자 수');ax.set_title('숫자를 더하는 것과 합집합을 추정하는 것은 다름',loc='left');fmt(ax);save(fig,'lab02-union','일별 숫자 합과 실제 주간 값·병합 추정 비교')
# 03: show every trial and signed errors, rather than only a mean.
fig,ax=plt.subplots(figsize=(8,5),layout='constrained')
for j,row in enumerate(d['precision']):
 errors=[(t['estimate']-50000)/50000*100 for t in row['trials']]
 ax.boxplot([errors],positions=[j],widths=.45,showfliers=False,medianprops={'color':PURPLE,'linewidth':2},boxprops={'color':GREY},whiskerprops={'color':GREY},capprops={'color':GREY})
 jitter=[(i%5-2)*.045 for i in range(20)];ax.scatter([j+x for x in jitter],errors,s=28,alpha=.75,color=[BLUE,TEAL,PURPLE][j],zorder=3)
ax.axhline(0,color=GREY,lw=1);ax.set_xticks(range(3),labels=['log2m=8\n256칸','log2m=11\n2,048칸','log2m=14\n16,384칸']);ax.set_ylabel('상대 오차 (%) · 0 위는 과대, 아래는 과소');ax.set_title('점 하나는 다른 ID 집합 50,000개의 관측',loc='left');ax.grid(axis='y',alpha=.2)
save(fig,'lab03-error-distribution','정밀도별 실제 오차 20시행 분포')
fig,(a,b)=plt.subplots(1,2,figsize=(9,4.8),layout='constrained');ps=[str(q['log2m']) for q in d['precision']]
a.bar(ps,[q['trials'][0]['binary_bytes'] for q in d['precision']],color=BLUE);a.set_ylabel('FULL 직렬화 크기 (bytes)');a.set_xlabel('log2m');a.set_title('늘어나는 저장 공간');fmt(a)
x=range(3);b.plot(x,[q['theoretical_rse_pct'] for q in d['precision']],marker='o',color=GREY,label='이론 RSE (보장 상한 아님)');b.plot(x,[q['rmse_pct'] for q in d['precision']],marker='o',color=PURPLE,label='표본 RMSE');b.set_xticks(list(x),labels=ps);b.set_xlabel('log2m');b.set_ylabel('상대 오차 지표 (%)');b.set_title('공간과 오차를 함께 비교');b.legend(fontsize=9);b.grid(axis='y',alpha=.2)
save(fig,'lab03-space-error','FULL 공간과 이론·표본 오차의 비교')
fig,(a,b)=plt.subplots(1,2,figsize=(9,5),layout='constrained');checks=d['hash_seed_checks'];names=[f"{q['kind']}\nseed {q['seed']}" for q in checks];colors=[BLUE,RED,BLUE,RED]
a.bar(names,[q['occupied_buckets'] for q in checks],color=colors);a.axhline(2048,color=GREY,ls='--');a.set_ylim(0,2450);a.set_ylabel('사용된 버킷 (전체 2,048개)');a.set_title('고유 해시가 많아도 버킷은 치우칠 수 있음')
b.bar(names,[q['estimate'] for q in checks],color=colors);b.axhline(50000,color=GREY,ls='--',label='정답 50,000');b.set_ylim(0,60000);b.set_ylabel('추정 고유 개수');b.set_title('별도 입력·seed 점검의 실제 결과');b.legend();fmt(b)
save(fig,'lab03-hash-check','별도 hash seed 점검: 버킷 사용과 큰 과소 추정')
# 04: individual samples, logarithmic axis explicitly labeled.
fig,ax=plt.subplots(figsize=(8,5),layout='constrained');labels=['정확한 원본 집계','원본 HLL 생성','일별 스케치 병합']
for i,(name,case) in enumerate(d['benchmarks'].items()):
 ys=case['samples_ms'];ax.scatter([i+(j-4.5)*.02 for j in range(10)],ys,color=[BLUE,PURPLE,TEAL][i],alpha=.75,s=35)
 ax.hlines(case['median_ms'],i-.3,i+.3,color='black',lw=2)
 ax.text(i+.32,case['median_ms'],f"중앙값\n{case['median_ms']:.3f} ms",fontsize=10,va='center')
ax.set_xticks(range(3),labels=labels);ax.set_xlim(-.6,2.9);ax.set_yscale('log');ax.set_ylabel('EXPLAIN 서버 실행 시간 (ms, 로그 축)');ax.set_title('예열 2회 후 실제 10회: 점은 측정, 검은 선은 중앙값',loc='left');ax.grid(axis='y',which='both',alpha=.18)
save(fig,'lab04-read-times','정확 집계·원본 HLL·스케치 재사용의 서버 시간')
fig,ax=plt.subplots(figsize=(8,5),layout='constrained');n=[1,10,100];build=d['daily_build']['Execution Time'];exact=d['benchmarks']['exact_raw']['median_ms'];raw=d['benchmarks']['hll_raw']['median_ms'];union=d['benchmarks']['hll_daily_union']['median_ms']
for label,values,color in [('매번 정확 원본 집계',[exact*k for k in n],BLUE),('매번 원본 HLL 생성',[raw*k for k in n],PURPLE),('일별 스케치 생성 1회 + N번 병합',[build+union*k for k in n],TEAL)]:ax.plot(n,values,marker='o',color=color,label=label)
ax.set_xscale('log');ax.set_yscale('log');ax.set_xticks(n,labels=['1','10','100']);ax.set_xlabel('조회 횟수 N (로그 축)');ax.set_ylabel('서버 시간 합산 모델 (ms, 로그 축)');ax.set_title('재사용 이점에는 초기 생성 비용이 포함됨',loc='left');ax.legend(fontsize=10);ax.grid(which='both',alpha=.18)
save(fig,'lab04-amortization','실측값으로 계산한 초기 생성 포함 합산 모델')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'{len(manifest["figures"])}개 그림을 SVG·PNG로 생성했습니다.')
