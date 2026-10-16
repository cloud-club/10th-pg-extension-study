"""기본 학습용 개념 모형. 좌표·시간·거리는 실측 벤치마크가 아니다.

Clotho 0.4.0의 circle, anchored line, property tracks, flow를 사용한다.
노드는 한 번만 선언하고 색·탐색 커서를 절대 시간으로 갱신해 seek를 지원한다.
"""


class Graph:
    def __init__(self, kit, id, title, duration, chapters):
        self.k = kit
        self.end = duration
        self.doc = {
            'clothoVersion': 1, 'id': id, 'title': title,
            'description': '원리를 설명하는 개념 모형입니다. 재생 시간은 검색 시간과 무관합니다.',
            'duration': duration,
            'canvas': {'width': 940, 'height': 550, 'background': kit['BG']},
            'elements': [], 'effects': [],
            'chapters': [dict(id=f'phase-{i}', time=t, label=label, subtitle=sub)
                         for i, (t, label, sub) in enumerate(chapters)],
            'settings': {'autoplay': True, 'loop': False, 'showChapterList': True,
                         'chapterListPosition': 'bottom'},
        }
        self.text('title', 32, 40, title, size=22)

    def add(self, element, start=0, end=None):
        element['appearances'] = [{'start': start, 'end': self.end if end is None else end,
                                  'entryMode': 'instant', 'entryDuration': 1}]
        self.doc['elements'].append(element)
        return element

    def text(self, id, x, y, text, start=0, end=None, size=16, color=None):
        return self.add(dict(type='text', id=id, x=x, y=y, content=text,
                             fontSize=size, color=color or self.k['INK']), start, end)

    def node(self, id, x, y, label, fill=None, r=20):
        return self.add(dict(type='circle', id=id, cx=x, cy=y, r=r,
                             fill=fill or self.k['PANEL'], stroke=self.k['MUTED'],
                             strokeWidth=1.5, label=label,
                             labelColor=self.k['ON_FILL'] if fill else self.k['INK'], labelSize=14))

    def edge(self, id, a, b, anchors=('right', 'left'), start=0, color=None, dash=None):
        el = dict(type='line', id=id, fromId=a, toId=b, fromAnchor=anchors[0],
                  toAnchor=anchors[1], stroke=color or self.k['DIM'], strokeWidth=2)
        if dash:
            el['strokeDasharray'] = dash
        return self.add(el, start)

    def box(self, id, x, y, w, h, label, start=0, end=None, fill=None):
        return self.add(dict(type='rect', id=id, x=x, y=y, width=w, height=h,
                             fill=fill or self.k['PANEL'], cornerRadius=8,
                             label=label, labelColor=self.k['INK'], labelSize=16), start, end)

    @staticmethod
    def track(el, property, keyframes, interpolation='discrete'):
        # 0.4.0의 discrete 보간은 구간 중간에서 바뀐다. 상태는 지정 시각까지
        # 유지해야 하므로 전환 직전의 키프레임을 명시한다.
        if interpolation == 'discrete':
            held = [keyframes[0]]
            for time, value in keyframes[1:]:
                previous_time, previous_value = held[-1]
                if time - previous_time > 1:
                    held.append((time - 1, previous_value))
                held.append((time, value))
            keyframes = held
        el.setdefault('tracks', []).append(dict(property=property, interpolate=interpolation,
                                                keyframes=[dict(time=t, value=v) for t, v in keyframes]))

    def visited(self, el, time, color=None):
        self.track(el, 'fill', [(0, el['fill']), (time, color or self.k['BIGM'])])
        self.track(el, 'labelColor', [(0, el['labelColor']), (time, self.k['ON_FILL'])])

    def travel(self, edge, time, color=None):
        color = color or self.k['BIGM']
        self.track(edge, 'stroke', [(0, edge['stroke']), (time, color)])
        self.doc['effects'].append(dict(type='flow', id=edge['id'] + '-flow', elementId=edge['id'],
                                       time=time, duration=900, color=color, particles=2, radius=3))

    def cursor(self, points, start):
        # 하나의 커서를 움직인다. 노드·레이어 이동은 절대 시간에서 다시 계산된다.
        _, x, y = points[0]
        el = self.add(dict(type='circle', id='search-cursor', cx=x, cy=y, r=28,
                           fill='transparent', stroke=self.k['TRGM'], strokeWidth=3), start)
        self.track(el, 'cx', [(t, x) for t, x, _ in points], 'number')
        self.track(el, 'cy', [(t, y) for t, _, y in points], 'number')
        return el


def ivfflat(k):
    g = Graph(k, 'pgv-ivfflat-graph', 'IVFFlat: 중심 선택 → 동네 탐색 → 경계 보완', 24000, [
        (0, '동네 나누기', 'lists는 동네 수. 작은 점은 벡터, 큰 점은 대표 중심입니다.'),
        (7000, 'probes = 1', 'Q와 중심이 가장 가까운 동네 A만 조사합니다.'),
        (15000, 'probes = 2', '이웃 동네 B까지 열어 경계 너머의 가까운 벡터를 찾습니다.'),
    ])
    g.text('legend', 32, 84, '작은 점 = 저장된 벡터   큰 점 = 중심   분홍 Q = 질의 벡터', color=k['MUTED'], size=15)
    # 중심이 가까운 동네와 가장 가까운 개별 벡터의 동네는 다를 수 있다.
    regions = [('a', 90, 130, 270, 175), ('b', 365, 130, 270, 175),
               ('c', 90, 310, 270, 150), ('d', 365, 310, 270, 150)]
    for id, x, y, w, h in regions:
        g.add(dict(type='rect', id='region-' + id, x=x, y=y, width=w, height=h,
                   fill='transparent', stroke=k['DIM'], strokeWidth=1.5, cornerRadius=12))
        g.text('region-label-' + id, x + 12, y + 24, '동네 ' + id.upper(), size=14, color=k['MUTED'])
    centres = {'a': (245, 215), 'b': (475, 215), 'c': (245, 380), 'd': (475, 380)}
    nodes = {}
    for id, (x, y) in centres.items():
        nodes[id] = g.node('centroid-' + id, x, y, id.upper(), k['TSV'], 22)
    points = {
        'a': [(145, 205), (185, 265), (300, 175), (330, 280), (295, 270)],
        'b': [(397, 248), (415, 165), (545, 175), (570, 260), (465, 270)],
        'c': [(150, 350), (190, 420), (310, 345), (325, 415), (270, 440)],
        'd': [(400, 345), (415, 425), (555, 340), (585, 415), (520, 445)],
    }
    # 비교선은 배경에, 노드는 그 위에 그린다.
    g.node('query', 357, 245, 'Q', k['TRGM'], 17)
    for id in centres:
        g.edge('compare-' + id, 'query', 'centroid-' + id, ('auto', 'auto'), start=7000,
               color=k['PAD'], dash='4 5')
    for id, coords in points.items():
        for i, (x, y) in enumerate(coords):
            el = g.node(f'vector-{id}-{i}', x, y, f'{id}{i + 1}', r=13)
            if id == 'a':
                g.visited(el, 10000 + i * 650)
            if id == 'b':
                g.visited(el, 16500 + i * 650)
                if i == 0:
                    g.track(el, 'fill', [(0, k['PANEL']), (16500, k['BIGM']), (20500, k['OK'])])
    g.text('state-a', 680, 180, '먼저 동네 중심을 정합니다', 0, 7000, size=16)
    g.text('state-a2', 680, 218, 'lists = 4인 개념 예시', 0, 7000, size=15, color=k['MUTED'])
    g.text('state-b', 680, 180, '가장 가까운 중심: A', 7000, 15000)
    g.text('state-b2', 680, 218, '파랑: 조사한 벡터', 10000, 15000, color=k['BIGM'])
    g.text('state-b3', 680, 256, 'b1은 더 가까워도', 11500, 15000, color=k['WARN'])
    g.text('state-b4', 680, 288, '동네 밖이라 놓칩니다', 11500, 15000, color=k['WARN'])
    g.text('state-c', 680, 180, 'A와 B를 함께 조사', 15000)
    g.text('state-c2', 680, 218, '비교할 벡터가 늘지만', 17000, size=15)
    g.text('state-c3', 680, 250, '경계 너머도 찾습니다', 17000, size=15)
    g.text('state-c4', 680, 300, '초록 b1: 가까운 후보', 20500, color=k['OK'], size=15)
    g.text('note', 32, 510, '동네 내부에서는 원본 벡터로 거리를 잽니다. Q와 가까운 점이 옆 동네에 있을 수 있습니다.', size=15)
    # 연결선이 노드 위에 그려지지 않도록 도형 순서를 정리한다.
    g.doc['elements'].sort(key=lambda el: 0 if el['type'] == 'line' else 1)
    return g.doc


def hnsw(k):
    g = Graph(k, 'pgv-hnsw-graph', 'HNSW: 위층의 지름길 → 아래층의 후보 탐색', 28000, [
        (0, '층과 연결', '같은 글자는 같은 벡터입니다. 모든 벡터는 0층에 있습니다.'),
        (6000, '위층에서 이동', '진입점 A에서 Q와 가까운 H로 큰 걸음을 옮깁니다.'),
        (12000, '아래층으로', 'H의 위치를 출발점으로 삼아 다음 층을 탐색합니다.'),
        (19000, '후보를 넓혀 비교', '0층에서는 여러 후보를 유지하고 더 가까운 이웃을 찾습니다.'),
    ])
    g.text('legend', 32, 84, '회색 = 연결   파랑 = 방문   분홍 테두리 = 현재 위치   초록 = 선택한 후보', size=15, color=k['MUTED'])
    positions = {}
    for layer, y, labels in [(2, 165, ['a', 'h']), (1, 275, ['a', 'd', 'h']), (0, 385, list('abcdefghij'))]:
        g.text(f'layer-{layer}', 32, y + 5, f'L{layer}', size=16, color=k['MUTED'])
        for label in labels:
            x = 110 + list('abcdefghij').index(label) * 83
            positions[f'{label}-l{layer}'] = (x, y)
    edges = {}
    for layer, labels in [(2, ['a', 'h']), (1, ['a', 'd', 'h']), (0, list('abcdefghij'))]:
        for a, b in zip(labels, labels[1:]):
            id = f'{a}-{b}-l{layer}'
            edges[id] = g.edge(id, f'{a}-l{layer}', f'{b}-l{layer}')
    for layer in (2, 1):
        edges[f'down-{layer}'] = g.edge(f'down-{layer}', f'h-l{layer}', f'h-l{layer - 1}',
                                       ('bottom', 'top'), color=k['PAD'], dash='4 5')
    nodes = {id: g.node(id, x, y, id[0].upper()) for id, (x, y) in positions.items()}
    g.node('query', 774, 453, 'Q', k['TRGM'], 17)
    for id, t in [('a-l2', 6000), ('h-l2', 9500), ('h-l1', 13500), ('h-l0', 17000),
                  ('g-l0', 20000), ('i-l0', 22000), ('j-l0', 24000)]:
        g.visited(nodes[id], t)
    g.track(nodes['i-l0'], 'fill', [(0, k['PANEL']), (22000, k['BIGM']), (25500, k['OK'])])
    for id, t in [('a-h-l2', 8500), ('down-2', 12500), ('down-1', 16000),
                  ('g-h-l0', 19500), ('h-i-l0', 21000), ('i-j-l0', 23500)]:
        g.travel(edges[id], t)
    g.cursor([(6000, *positions['a-l2']), (7800, *positions['a-l2']),
              (9500, *positions['h-l2']), (12000, *positions['h-l2']),
              (13500, *positions['h-l1']), (15500, *positions['h-l1']),
              (17000, *positions['h-l0']), (20000, *positions['h-l0']),
              (22000, *positions['i-l0'])], 6000)
    g.text('query-label', 32, 460, 'Q는 저장된 노드가 아니라 검색하려는 질의입니다.', size=15, color=k['MUTED'])
    for id, t, end, text in [
        ('note-structure', 0, 6000, '위층으로 갈수록 점이 드뭅니다. 모든 점을 위층에 복제하지 않습니다.'),
        ('note-upper', 6000, 12000, '위층에서는 적은 노드를 비교하며 질의와 가까운 쪽으로 이동합니다.'),
        ('note-down', 12000, 19000, '점선은 같은 H에서 다음 층으로 내려가는 과정입니다.'),
        ('note-base', 19000, 28000, 'ef_search는 후보 탐색 폭을 조절합니다. 단순히 한 경로만 따라가는 검색은 아닙니다.'),
    ]:
        g.text(id, 32, 514, text, t, end, size=15)
    return g.doc


def diskann(k):
    g = Graph(k, 'pgv-diskann-graph', 'DiskANN: 한 층의 그래프에서 후보 목록을 갱신', 29000, [
        (0, '연결과 시작점', '회색 선은 이동할 수 있는 연결입니다. A에서 출발합니다.'),
        (6000, 'A의 이웃 비교', 'B와 C를 후보에 넣고, Q에 더 가까운 C를 먼저 확장합니다.'),
        (12000, 'C에서 J로', 'J를 찾았다고 B를 버리지 않습니다. 후보 목록을 갱신합니다.'),
        (19000, 'J에서 G로', '지름길로 G까지 접근합니다. 최종 후보는 원본 벡터로 재평가할 수 있습니다.'),
    ])
    g.text('legend', 32, 84, '파랑 = 방문   노랑 = 대기 후보   분홍 테두리 = 현재 위치   초록 = 가까운 후보', size=14, color=k['MUTED'])
    p = {'a': (90, 285), 'b': (230, 160), 'c': (225, 400), 'd': (365, 255),
         'e': (420, 370), 'f': (520, 155), 'h': (585, 270), 'j': (455, 425), 'g': (610, 380)}
    pairs = [('a', 'b'), ('a', 'c'), ('b', 'd'), ('b', 'f'), ('d', 'h'),
             ('d', 'e'), ('e', 'g'), ('f', 'h'), ('h', 'g'), ('c', 'j'), ('j', 'g')]
    edges = {a + '-' + b: g.edge(a + '-' + b, a, b, ('auto', 'auto')) for a, b in pairs}
    nodes = {id: g.node(id, x, y, id.upper()) for id, (x, y) in p.items()}
    g.node('query', 625, 450, 'Q', k['TRGM'], 17)
    g.text('queue-title', 690, 145, '후보 목록', size=18)
    for id, start, end, lines in [
        ('queue-0', 0, 6000, ['A (거리 10)', '진입점부터 시작']),
        ('queue-1', 6000, 12000, ['C (거리 7)', 'B (거리 8)']),
        ('queue-2', 12000, 19000, ['J (거리 4)', 'B (거리 8)']),
        ('queue-3', 19000, 29000, ['G (거리 0.7)', 'B (거리 8)']),
    ]:
        for i, text in enumerate(lines):
            g.box(id + f'-{i}', 690, 175 + i * 62, 215, 44, text, start, end)
    g.text('queue-note', 690, 345, '거리는 본문의 예시값', size=14)
    g.text('queue-note-2', 690, 375, '그림의 길이와 무관', size=14, color=k['MUTED'])
    g.visited(nodes['a'], 3000)
    for id, t in [('b', 6500), ('c', 7000), ('j', 12500), ('g', 20000)]:
        g.visited(nodes[id], t, k['WARN'])
    for id, t, done in [('c', 7000, 9500), ('j', 12500, 16000), ('g', 20000, 24500)]:
        g.track(nodes[id], 'fill', [(0, k['PANEL']), (t, k['WARN']),
                                    (done, k['OK'] if id == 'g' else k['BIGM'])])
    for id, t in [('a-c', 8500), ('c-j', 14500), ('j-g', 22000)]:
        g.travel(edges[id], t)
    g.cursor([(3000, *p['a']), (8000, *p['a']), (9500, *p['c']),
              (14500, *p['c']), (16000, *p['j']), (22000, *p['j']), (24000, *p['g'])], 3000)
    g.text('note', 32, 515, '지름길은 이동을 줄일 수 있습니다. 그래프 이동 횟수가 실제 SSD 읽기 횟수와 같지는 않습니다.', size=14)
    return g.doc


def streaming(k):
    g = Graph(k, 'pgv-diskann-stream', 'Streaming: 필터를 통과한 결과가 모일 때까지', 25000, [
        (0, '조건과 후보', "category = 'book', LIMIT 3을 요청합니다."),
        (5000, '필터에서 제외', '처음 후보 3개는 book이 아닙니다. 결과가 아직 없습니다.'),
        (11000, '다음 후보 요청', '후보 공급을 이어 가며 5번과 6번을 결과에 담습니다.'),
        (19000, '3개를 모으면 종료', '8번까지 받아 5·6·8을 모은 뒤 LIMIT에서 멈춥니다.'),
    ])
    g.text('condition', 32, 90, "WHERE category = 'book'  ·  LIMIT 3", size=18)
    tags = ['game', 'game', 'movie', 'game', 'book', 'book', 'game', 'book']
    g.text('candidates-label', 32, 153, '인덱스가 다음 후보를 공급합니다', size=15, color=k['MUTED'])
    for i, tag in enumerate(tags):
        x = 90 + 108 * i
        node = g.node(f'candidate-{i + 1}', x, 210, str(i + 1), r=23)
        g.text(f'tag-{i + 1}', x - 22, 265, tag, size=14, color=k['MUTED'])
        g.visited(node, 5200 + i * 2000, k['OK'] if tag == 'book' else k['PAD'])
    g.cursor([(5200 + i * 2000, 90 + i * 108, 210) for i in range(8)], 5200)
    g.box('filter', 335, 310, 265, 48, 'PostgreSQL: book인가?')
    g.text('accepted-label', 32, 405, '통과한 결과', size=15, color=k['MUTED'])
    for id, x, start in [('5', 305, 13500), ('6', 465, 15500), ('8', 625, 19500)]:
        node = g.add(dict(type='circle', id='result-' + id, cx=x, cy=405, r=23,
                          fill=k['OK'], label=id, labelSize=17, labelColor=k['ON_FILL']), start)
        g.edge('accept-' + id, 'filter', node['id'], ('bottom', 'top'), start, k['OK'])
    for id, t, end, text in [
        ('count-0', 0, 13500, '결과 0 / 3: 부족하면 다음 후보를 요청합니다.'),
        ('count-1', 13500, 15500, '결과 1 / 3: 5번을 담고 계속 탐색합니다.'),
        ('count-2', 15500, 19500, '결과 2 / 3: 6번을 담고 계속 탐색합니다.'),
        ('count-3', 19500, 25000, '결과 3 / 3: 5·6·8을 모았습니다. 여기서 멈춥니다.'),
    ]:
        g.text(id, 32, 493, text, t, end, size=16)
    g.text('note', 32, 530, '이 순서는 개념 예시입니다. ANN 후보가 전역 정답 순서로 공급된다는 보장은 아닙니다.', size=14, color=k['MUTED'])
    # 연결선 뒤에 도형이 오도록 유지한다.
    g.doc['elements'].sort(key=lambda el: 0 if el['type'] == 'line' else 1)
    return g.doc


def docs(kit):
    return {doc['id']: doc for doc in [ivfflat(kit), hnsw(kit), diskann(kit), streaming(kit)]}
