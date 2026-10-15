"""저장소의 Week 07 Markdown을 정적 React 페이지로 동기화한다."""
import argparse
import json
import re
from pathlib import Path
WEB = Path(__file__).resolve().parents[1]
SOURCE = WEB / 'content/fdw'
DEST = WEB / 'src/pages/fdw/reading'
CHAPTERS = [
 ('industry-cases.md','IndustryCases','industry-cases','공개 기업 사례'),
 ('blog-review.md','BlogReview','blog-review','사례 검토와 검증'),
 ('join-comparison.md','JoinComparison','join-comparison','비교 Lab'),
 ('related/dblink.md','RelatedDblink','related-dblink','관련 확장 심화'),
 ('related/file-fdw.md','RelatedFile','related-file-fdw','관련 확장 심화'),
 ('related/remote-search.md','RelatedSearch','related-remote-search','관련 확장 심화'),
 ('related/observability.md','RelatedObserve','related-observability','관련 확장 심화'),
 ('related/cache-cron.md','RelatedCron','related-cache-cron','관련 확장 심화'),

 ('docs/basic/01-databases-and-remote-data.md','Databases','databases','기본 학습'),
 ('docs/basic/02-fdw-and-four-objects.md','Objects','objects','기본 학습'),
 ('docs/basic/03-connect-and-permissions.md','Connect','install','기본 학습'),
 ('docs/basic/04-select-and-joins.md','Queries','select-joins','기본 학습'),
 ('docs/basic/05-explain-and-pushdown.md','Explain','plans','기본 학습'),
 ('docs/basic/06-network-and-fetch.md','NetworkBasics','network-basics','기본 학습'),
 ('docs/basic/07-connections-and-load.md','Connections','load','기본 학습'),
 ('docs/basic/08-transactions-and-failures.md','Transactions','transactions','기본 학습'),
 ('docs/basic/09-related-and-architecture.md','Related','related','기본 학습'),
 ('docs/basic/10-glossary-and-review.md','Review','glossary','기본 학습'),
 ('docs/advanced/01-planner-and-shippability.md','Planner','planner','심화'),
 ('docs/advanced/02-cost-statistics-and-joins.md','Costs','costs','심화'),
 ('docs/advanced/03-cursors-network-and-memory.md','Cursors','cursors','심화'),
 ('docs/advanced/04-capacity-and-observability.md','Observability','observability','심화'),
 ('docs/advanced/05-writes-locks-and-retries.md','Writes','writes','심화'),
 ('docs/advanced/06-source-and-production-design.md','Source','source','심화'),
 ('labs/README.md','Labs','labs','실습'),
 ('labs/01-connect-and-metadata/HANDS-ON.md','LabConnect','lab-connect','실습'),
 ('labs/02-pushdown-and-search/HANDS-ON.md','LabPushdown','lab-pushdown','실습'),
 ('labs/03-fetch-and-network/HANDS-ON.md','LabFetch','lab-fetch','실습'),
 ('labs/04-transactions-and-locks/HANDS-ON.md','LabTransactions','lab-transactions','실습'),
 ('labs/05-connections-and-related/HANDS-ON.md','LabConnections','lab-connections','실습'),
]
ROUTES = {(SOURCE / file).resolve(): '/postgres-fdw/' + slug for file,_,slug,_ in CHAPTERS}
for file,_,slug,_ in CHAPTERS:
 if file.endswith('/HANDS-ON.md'):
  ROUTES[(SOURCE / file).with_name('README.md').resolve()]='/postgres-fdw/'+slug
  ROUTES[(SOURCE / file).with_name('LESSON.md').resolve()]='/postgres-fdw/'+slug
ROUTES[(SOURCE/'experiments/README.md').resolve()]='/postgres-fdw/experiments'
for name in ('01-pushdown-and-transfer','02-fetch-and-row-width','03-planning-and-connections'):
 ROUTES[(SOURCE/'experiments'/name/'README.md').resolve()]='/postgres-fdw/experiments'
CURRENT = SOURCE

def literal(value): return json.dumps(value, ensure_ascii=False)

def inline(value):
 parts=[]
 for piece in re.split(r'(`[^`]+`|\*\*.+?\*\*|\[[^\]]+\]\([^)]+\))',value):
  if not piece: continue
  if piece.startswith('`'): parts.append('<code>{'+literal(piece[1:-1])+'}</code>')
  elif piece.startswith('**'): parts.append('<strong>'+inline(piece[2:-2])+'</strong>')
  elif re.fullmatch(r'\[[^\]]+\]\([^)]+\)',piece):
   label,url=re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)',piece).groups()
   if url.startswith('https://'):
    parts.append('<a href={'+literal(url)+'}>'+inline(label)+'</a>')
   elif url.startswith(('/postgres-fdw/', '/pg-joins/', '/hll/')):
    parts.append('<Ref to={'+literal(url)+'}>'+inline(label)+'</Ref>')
   else:
    target=(CURRENT.parent/url).resolve()
    route=ROUTES.get(target)
    if not route: raise ValueError(f'웹 경로가 없는 문서 링크: {CURRENT}: {url}')
    parts.append('<Ref to={'+literal(route)+'}>'+inline(label)+'</Ref>')
  else: parts.append('{'+literal(piece)+'}')
 return ''.join(parts)

def blocks(lines):
 out=[];i=0
 while i<len(lines):
  line=lines[i].strip()
  if not line or line=='---': i+=1;continue
  if line.startswith('!['):
   match=re.fullmatch(r'!\[([^\]]+)\]\((/hll/plots/[a-z0-9-]+\.svg)\)',line)
   if not match: raise ValueError('지원하지 않는 그림 경로: '+line)
   alt,src=match.groups()
   out.append('<figure className="rounded-xl border bg-card p-3"><div className="overflow-x-auto"><img loading="lazy" className="w-full min-w-[640px] rounded bg-white" src={'+literal(src)+'} alt={'+literal(alt)+'} /></div><figcaption className="mt-3 text-sm text-muted-foreground">{'+literal(alt)+'}</figcaption></figure>')
   i+=1;continue
  if line.startswith('```'):
   language=line[3:] or 'text';code=[];i+=1
   while i<len(lines) and not lines[i].startswith('```'): code.append(lines[i]);i+=1
   if i==len(lines): raise ValueError('닫히지 않은 코드 블록')
   if language=='mermaid': out.append('<Diagram chart={'+literal('\n'.join(code))+'} />')
   else: out.append('<CodeBlock language='+literal(language)+'>{'+literal('\n'.join(code))+'}</CodeBlock>')
   i+=1;continue
  if line.startswith('|'):
   table=[]
   while i<len(lines) and lines[i].strip().startswith('|'):
    table.append([c.strip() for c in lines[i].strip().strip('|').split('|')]);i+=1
   if len(table)<2 or not all(re.fullmatch(r':?-+:?',c) for c in table[1]):raise ValueError('표 구분행 확인')
   def row(cells,tag):return '<tr>'+''.join('<'+tag+'>'+inline(c)+'</'+tag+'>' for c in cells)+'</tr>'
   out.append('<table><thead>'+row(table[0],'th')+'</thead><tbody>'+''.join(row(c,'td') for c in table[2:])+'</tbody></table>');continue
  if line.startswith('#'):
   out.append('<h3>'+inline(re.sub(r'^#+\s+','',line))+'</h3>');i+=1;continue
  if re.match(r'(- |\d+\. )',line):
   ordered=not line.startswith('- ');items=[]
   while i<len(lines) and re.match(r'\s*(- |\d+\. )',lines[i]):
    items.append('<li>'+inline(re.sub(r'^\s*(- |\d+\. )','',lines[i]))+'</li>');i+=1
   tag='ol' if ordered else 'ul';out.append('<'+tag+'>'+''.join(items)+'</'+tag+'>');continue
  paragraph=[]
  while i<len(lines) and lines[i].strip() and not re.match(r'^(#{1,6} |```|!\[|---$|\| |\d+\. |- )',lines[i]):
   paragraph.append(lines[i].strip());i+=1
  out.append('<p>'+inline(' '.join(paragraph))+'</p>')
 return '\n'.join(out)

def generate(file,name,group):
 global CURRENT
 CURRENT=SOURCE/file
 lines=CURRENT.read_text().splitlines();title=lines.pop(0).removeprefix('# ')
 sections=[];heading='학습 안내';content=[];fence=False
 for line in lines:
  if line.startswith('```'):fence=not fence
  if not fence and line.startswith('## '):
   if any(c.strip() for c in content):sections.append((heading,content))
   heading=line[3:];content=[]
  else:content.append(line)
 if content:sections.append((heading,content))
 body='\n'.join('<Section id="section-'+str(i+1)+'" title={'+literal(h)+'}>\n'+blocks(c)+'\n</Section>' for i,(h,c) in enumerate(sections))
 body+='\n<SourceNote path={'+literal('catalogs/shinkeonkim/web/content/fdw/'+file)+'}>学習原文'.replace('学習原文','학습 원문')+'</SourceNote>'
 imports=["import { PageHeader, Section } from '@/components/layout/PageHeader'"]
 for component,path in [('CodeBlock','common/Code'),('Ref','common/Ref'),('Diagram','viz/Diagram'),('SourceNote','common/SourceNote')]:
  if '<'+component in body:imports.append("import { "+component+" } from '@/components/"+path+"'")
 return '// Generated by scripts/sync-fdw-guide.py from '+file+'\n'+'\n'.join(imports)+'\n\nexport default function '+name+'() {\n return <>\n<PageHeader eyebrow={'+literal('Week 07 · '+group)+'} title={'+literal(title)+'} />\n'+body+'\n </>\n}\n'

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
 if not args.check:DEST.mkdir(parents=True,exist_ok=True)
 for file,name,_,group in CHAPTERS:
  output=generate(file,name,group);path=DEST/(name+'.tsx')
  if args.check:
   if not path.exists() or path.read_text()!=output:raise SystemExit(f'동기화 불일치: {path}')
  else:path.write_text(output)
 print(f'Week 07 문서 {len(CHAPTERS)}개 '+('동기화 검증 통과' if args.check else '웹 페이지 생성'))
if __name__=='__main__':main()
