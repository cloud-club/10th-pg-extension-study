"""가이드의 문단·예시·순서를 유지하며 정적 React 페이지로 옮긴다."""
import argparse
import json
import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
SOURCE = WEB.parents[2] / 'private/pgvector-pgvectorscale-guide'
DEST = WEB / 'src/pages/pgvector/reading'
CHAPTERS = [
    ('01-vector-search-and-ann.md', 'Ann', 'ann'),
    ('02-pgvector-overview.md', 'Overview', 'overview'),
    ('03-ivfflat.md', 'Ivfflat', 'ivfflat'),
    ('04-hnsw.md', 'Hnsw', 'hnsw'),
    ('05-storage-memory-and-io.md', 'Storage', 'storage'),
    ('06-streaming-diskann.md', 'Diskann', 'diskann'),
    ('07-sbq.md', 'Sbq', 'sbq'),
    ('08-filtered-search.md', 'Filtering', 'filtering'),
    ('09-comparison-and-selection.md', 'Comparison', 'when-to-use'),
    ('10-glossary-and-review.md', 'Glossary', 'glossary'),
]
ROUTES = {file: '/pgvector/' + slug for file, _, slug in CHAPTERS}

IMPLEMENTATIONS = {
    ('Ivfflat', '3. K-means training'): 'IvfflatImplementation',
    ('Hnsw', 'Step 5. 좋은 이웃 선택'): 'HnswImplementation',
    ('Diskann', '5. RobustPrune'): 'DiskannImplementation',
}

# 원문 문단은 유지하고, 관련 절의 끝에 웹 전용 시각화를 보강한다.
VISUALS = {
    ('Ivfflat', '6. `probes`'): (
        'pgv-ivfflat-graph',
        '중심이 가까운 동네와 가장 가까운 벡터가 있는 동네는 다를 수 있습니다. '
        'probes를 늘려 경계 너머의 후보까지 비교하는 과정입니다.'),
    ('Hnsw', '9. 실제 탐색'): (
        'pgv-hnsw-graph',
        '같은 글자는 같은 벡터입니다. 위층에서 H로 이동한 뒤 같은 H를 출발점으로 '
        '아래층을 탐색합니다. 분홍 테두리는 현재 위치, 파랑은 방문한 노드입니다.'),
    ('Diskann', '7. Query 시 graph search'): (
        'pgv-diskann-graph',
        'A → C → J → G로 이동하며 후보 목록을 갱신합니다. B는 다음 탐색을 위한 '
        '후보로 남습니다. 표의 거리는 본문의 예시값이며 그림의 길이를 잰 값이 아닙니다.'),
    ('Diskann', '10. Streaming 방식'): (
        'pgv-diskann-stream',
        'book 조건에 맞는 후보 5·6·8이 모일 때까지 다음 후보를 받습니다. '
        'ANN 후보가 전역 정답 순서로 나온다는 보장은 아닙니다.'),
}


def literal(value):
    return json.dumps(value, ensure_ascii=False)


def inline(value):
    pattern = r'(`[^`]+`|\*\*.+?\*\*|\[[^\]]+\]\([^)]+\)|https?://[^\s]+)'
    parts = []
    for piece in re.split(pattern, value):
        if not piece:
            continue
        if piece.startswith('`'):
            parts.append('<code>{' + literal(piece[1:-1]) + '}</code>')
        elif piece.startswith('**'):
            parts.append('<strong>' + inline(piece[2:-2]) + '</strong>')
        elif piece.startswith('['):
            label, url = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', piece).groups()
            route = ROUTES.get(url.removeprefix('./'))
            parts.append(('<Ref to={' + literal(route) + '}>' if route else '<a href={' + literal(url) + '}>') + inline(label) + ('</Ref>' if route else '</a>'))
        elif piece.startswith('http'):
            parts.append('<a className="break-all" href={' + literal(piece) + '}>{' + literal(piece) + '}</a>')
        else:
            parts.append('{' + literal(piece) + '}')
    return ''.join(parts)


def blocks(lines):
    out = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line == '---':
            i += 1
            continue
        if line.startswith('```'):
            language = line[3:] or 'text'
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            if i == len(lines):
                raise ValueError('닫히지 않은 코드 블록')
            value = '\n'.join(code)
            if language == 'mermaid':
                out.append('<Diagram chart={' + literal(value) + '} />')
            else:
                out.append('<CodeBlock language=' + literal(language) + '>{' + literal(value) + '}</CodeBlock>')
            i += 1
            continue
        if line.startswith('|'):
            table = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table.append([cell.strip() for cell in lines[i].strip().strip('|').split('|')])
                i += 1
            if len(table) < 2 or not all(re.fullmatch(r':?-+:?', cell) for cell in table[1]):
                raise ValueError('지원하지 않는 표')
            row = lambda cells, tag: '<tr>' + ''.join('<' + tag + '>' + inline(cell) + '</' + tag + '>' for cell in cells) + '</tr>'
            out.append('<table><thead>' + row(table[0], 'th') + '</thead><tbody>' + ''.join(row(cells, 'td') for cells in table[2:]) + '</tbody></table>')
            continue
        if line.startswith('#'):
            heading = re.fullmatch(r'#{1,6}\s+(.+)', line).group(1)
            out.append('<h3>' + inline(heading) + '</h3>')
            i += 1
            continue
        if re.match(r'(- |\d+\. )', line):
            ordered = not line.startswith('- ')
            items = []
            while i < len(lines) and re.match(r'\s*(- |\d+\. )', lines[i]):
                items.append('<li>' + inline(re.sub(r'^\s*(- |\d+\. )', '', lines[i])) + '</li>')
                i += 1
            tag = 'ol' if ordered else 'ul'
            out.append('<' + tag + '>' + ''.join(items) + '</' + tag + '>')
            continue
        if line.startswith('> '):
            quote = []
            while i < len(lines) and lines[i].startswith('> '):
                quote.append(lines[i][2:])
                i += 1
            out.append('<blockquote><p>' + inline(' '.join(quote)) + '</p></blockquote>')
            continue
        paragraph = []
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#{1,6} |```|---$|\| |> |\d+\. |- )', lines[i]):
            paragraph.append(lines[i].strip())
            i += 1
        out.append('<p>' + inline(' '.join(paragraph)) + '</p>')
    return '\n'.join(out)


def generate(file, name, chapter):
    lines = (SOURCE / file).read_text().splitlines()
    title = lines.pop(0).removeprefix('# ')
    sections = []
    current = []
    heading = None
    fence = False
    for line in lines:
        if line.startswith('```'):
            fence = not fence
        match = None if fence else re.fullmatch(r'#{1,2}\s+(.+)', line)
        if match:
            if heading is not None:
                sections.append((heading, current))
            elif any(s.strip() for s in current):
                raise ValueError('절 앞의 문단을 확인하세요')
            heading, current = match.group(1), []
        else:
            current.append(line)
    sections.append((heading, current))
    body = []
    for n, (heading, content) in enumerate(sections, 1):
        rendered = blocks(content)
        implementation = IMPLEMENTATIONS.get((name, heading))
        if implementation:
            rendered += '\n<' + implementation + ' />'
        visual = VISUALS.get((name, heading))
        if visual:
            id, caption = visual
            rendered += '\n<Clotho id="' + id + '" caption={' + literal(caption) + '} className="my-6" />'
        if rendered:
            body.append('<Section id="section-' + str(n) + '" title={' + literal(heading) + '}>\n' + rendered + '\n</Section>')
        else:
            body.append('<h2 id="section-' + str(n) + '" className="mt-12 text-[21px] font-semibold">{' + literal(heading) + '}</h2>')
    if chapter + 1 < len(CHAPTERS):
        next_file, _, next_slug = CHAPTERS[chapter + 1]
        next_title = (SOURCE / next_file).read_text().splitlines()[0].removeprefix('# ')
        body.append('<p className="prose-doc mt-10">다음 → <Ref to="/pgvector/' + next_slug + '">{' + literal(next_title) + '}</Ref></p>')
    else:
        body.append('<p className="prose-doc mt-10"><Ref to="/pgvector/labs">실습 목록</Ref> · <Ref to="/pgvector/experiments">실험 질문과 결과</Ref> · <Ref to="/pgvector/about">전체 학습 순서</Ref></p>')
    imports = ["import { PageHeader, Section } from '@/components/layout/PageHeader'"]
    if any(page == name for page, _ in IMPLEMENTATIONS):
        imports.append("import " + name + "Implementation from '../implementation/" + name + "'")
    for component, path in [('CodeBlock', 'common/Code'), ('Ref', 'common/Ref'), ('Diagram', 'viz/Diagram'), ('Clotho', 'viz/Clotho')]:
        if '<' + component in '\n'.join(body):
            imports.append("import { " + component + " } from '@/components/" + path + "'")
    return '// Generated by scripts/sync-pgvector-guide.py from ' + file + '\n' + '\n'.join(imports) + '\n\nexport default function ' + name + '() {\n  return <>\n<PageHeader eyebrow="Week 05 · 기본 학습 ' + str(chapter + 1) + '/10" title={' + literal(title) + '} />\n' + '\n'.join(body) + '\n  </>\n}\n'


def main():
    global SOURCE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--source-dir', type=Path, help='원문 가이드 Markdown 디렉터리')
    args = parser.parse_args()
    if args.source_dir:
        SOURCE = args.source_dir.resolve()
    missing = [file for file, _, _ in CHAPTERS if not (SOURCE / file).is_file()]
    if missing:
        raise SystemExit('가이드 원문이 없습니다: ' + str(SOURCE) + '\n'
                         '원문을 준비한 뒤 --source-dir로 지정하세요. 웹 빌드와 배포에는 원문이 필요하지 않습니다.')
    if not args.check:
        DEST.mkdir(parents=True, exist_ok=True)
    for chapter, (file, name, _) in enumerate(CHAPTERS):
        output = generate(file, name, chapter)
        path = DEST / (name + '.tsx')
        if args.check:
            if not path.exists() or path.read_text() != output:
                raise SystemExit(f'가이드와 페이지가 다릅니다: {path}')
        else:
            path.write_text(output)
    print('가이드 10장 ' + ('동기화 검증 통과' if args.check else '페이지 생성 완료'))


if __name__ == '__main__':
    main()
