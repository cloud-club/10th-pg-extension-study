/**
 * week05 개념 페이지의 마무리 퀴즈. 페이지 본문과 같은 데이터(stats·indexStats)에서 숫자를 읽는다 —
 * 퀴즈에도 손으로 적은 측정값을 넣지 않는다. 풀이에는 다시 읽을 절을 링크로 붙인다.
 */
import { K } from '@/components/common/Code'
import { Ref } from '@/components/common/Ref'
import { avg, build, exp, fCorrect, fDup, fmtNum, halfvec, pick, r2, ratio, recall, scale } from './stats'
import { hnsw, ivf, IVF_LISTS, EFC_SWEEP, HNSW_EF, shift, vacuumMs } from './indexStats'
import type { QuizItem } from './guide'

const lastBuild = build.rows[build.rows.length - 1]
const rel = pick(fCorrect.configs, 'hnsw_iterative_relaxed_order')
const dk = pick(fCorrect.configs, 'diskann_label_filter')
const f4 = pick(halfvec.configs, 'vector(float4)+HNSW')
const hv = pick(halfvec.configs, 'halfvec(float2)+HNSW')
const [L_SMALL, , L_BIG] = IVF_LISTS
const [EFC_LOW] = EFC_SWEEP
const EF_MAX = HNSW_EF[HNSW_EF.length - 1]
const sIvf = shift('ivfflat')

export const QUIZ: Record<string, QuizItem[]> = {
  first: [
    {
      q: '임베딩(embedding)이란 무엇인가?',
      choices: ['문장을 압축해 저장한 파일', '문장·이미지를 모델에 넣어 얻은 숫자 목록(벡터)', '문장에 들어 있는 낱말들의 목록', '문서마다 붙인 분류 번호'],
      answer: 1,
      why: <>임베딩 모델은 뜻이 비슷한 문장일수록 비슷한 숫자가 나오도록 학습되어 있다. 그래서 “비슷한 문서 찾기”가 “가까운 점 찾기”가 된다(2·3단계).</>,
    },
    {
      q: <>“환불 받고 싶어요”로 “반품 절차 안내” 문서를 찾고 싶다. <K>WHERE body LIKE '%환불%'</K>로 안 되는 이유는?</>,
      choices: ['LIKE는 한국어를 지원하지 않아서', '두 문장에 겹치는 낱말이 없어서 — 글자가 아니라 뜻을 비교해야 한다', '문서가 너무 길어서', '인덱스가 없어서'],
      answer: 1,
      why: <>LIKE는 글자가 같은지를 본다. 필요한 것은 뜻이 비슷한지이고, 그래서 임베딩과 거리 계산이 필요하다(1단계).</>,
    },
    {
      q: '평소 쓰는 B-tree 인덱스로 “질문에서 가장 가까운 순” 검색을 빠르게 할 수 없는 이유는?',
      choices: ['B-tree는 숫자를 저장할 수 없어서', '“가까운 순서”가 질문마다 달라서, 미리 정렬해 둘 하나의 순서가 없다', 'B-tree는 PostgreSQL에 없어서', 'B-tree는 너무 커서'],
      answer: 1,
      why: <>서울에서 가까운 순서와 부산에서 가까운 순서가 다르듯, 기준점(질문)이 바뀌면 순서가 바뀐다(5단계).</>,
    },
    {
      q: 'ANN 인덱스가 돌려준 10개 중 8개가 진짜 “가장 가까운 10개”에 들어 있었다. recall@10은?',
      choices: ['0.2', '0.8', '8', '10'],
      answer: 1,
      why: <>recall@10 = 겹친 개수 / 10 = 8 / 10 = 0.8. 자세한 계산은 <Ref to="/pgvector/ann-details#recall">근사 검색과 recall</Ref>.</>,
    },
  ],

  install: [
    {
      q: <>슈퍼유저가 아닌 일반 계정으로 <K>CREATE EXTENSION vector;</K>를 실행하면?</>,
      choices: ['그냥 설치된다', '권한 오류가 난다 — pgvector는 trusted 확장이 아니라 슈퍼유저만 설치할 수 있다', '경고만 나오고 설치된다', 'pgvectorscale이 대신 설치된다'],
      answer: 1,
      why: <>실제 오류는 “Must be superuser to create this extension.” 클라우드 DB에서는 서비스의 허용 목록이 대신 설치해 준다(<Ref to="/pgvector/install#trusted">1절</Ref>).</>,
    },
    {
      q: <><K>vector(3)</K> 컬럼에 <K>'[1,2,3,4]'</K>를 넣으면?</>,
      choices: ['앞의 3개만 저장된다', '0을 채워 저장된다', '차원이 맞지 않는다는 오류가 난다', '자동으로 vector(4)로 바뀐다'],
      answer: 2,
      why: <>몰래 자르거나 채우지 않고 거절한다. 임베딩 모델을 바꿨을 때 바로 드러난다(<Ref to="/pgvector/install#types">2절</Ref>).</>,
    },
    {
      q: <><K>vector_l2_ops</K>로 만든 인덱스가 쓰이려면 질의에 어떤 연산자를 써야 하나?</>,
      choices: [<K key="a">{'<->'}</K>, <K key="b">{'<=>'}</K>, <K key="c">{'<#>'}</K>, '아무거나 써도 된다'],
      answer: 0,
      why: <><K>{'<->'}</K>가 L2(직선) 거리다. 인덱스를 만들 때 고른 거리와 질의의 연산자가 같아야 인덱스가 쓰인다(<Ref to="/pgvector/install#operators">3절</Ref>).</>,
    },
    {
      q: 'EXPLAIN 결과에서 “인덱스를 썼다”는 것을 보여 주는 줄은?',
      choices: [<K key="a">Seq Scan on items</K>, <K key="b">Index Scan using proper_hnsw</K>, <K key="c">Sort</K>, <K key="d">Planning Time</K>],
      answer: 1,
      why: <>Seq Scan은 처음부터 끝까지 읽은 것이다. <K>Buffers</K>는 읽은 8KB 페이지 수로, 이 주차의 비용 지표다(<Ref to="/pgvector/install#explain">4절</Ref>).</>,
    },
    {
      q: '3행짜리 테이블에 HNSW 인덱스를 만들었는데 EXPLAIN에 Seq Scan이 나왔다. 왜?',
      choices: ['인덱스가 고장 나서', '플래너가 3행은 전부 읽고 정렬하는 쪽이 더 싸다고 계산해서', 'pgvector가 설치되지 않아서', 'HNSW는 3행 이상만 저장해서'],
      answer: 1,
      why: <>플래너는 비용을 계산해 고른다. 작은 테이블로 인덱스를 시험하면 오해하기 쉽다(<Ref to="/pgvector/install#tiny">5절</Ref>).</>,
    },
  ],

  ann: [
    {
      q: 'recall을 계산하려면 “정답 top-10”이 필요하다. 정답은 어떻게 구하나?',
      choices: ['인덱스를 두 번 실행해서', '인덱스를 끄고 모든 행과 거리를 계산해서', '임베딩 모델에게 물어서', '가장 최근에 넣은 10개'],
      answer: 1,
      why: <>느리지만 확실한 정확한 검색으로 정답을 만들고, 인덱스 결과와 겹친 개수를 센다(<Ref to="/pgvector/ann-details#recall">1절</Ref>).</>,
    },
    {
      q: '인덱스 결과 10개 중 6개가 정답에 있었다. 나머지 4개는?',
      choices: ['완전히 엉뚱한 행이다', '대개 11번째·12번째처럼 조금 더 먼 행이다 — 틀린 행이라기보다 덜 가까운 행', '오류로 생긴 빈 행이다', '중복된 행이다'],
      answer: 1,
      why: <>그래서 후보들의 거리가 비슷할 때는 돌려준 행의 평균 거리도 함께 본다(<Ref to="/pgvector/ann-details#recall">1절</Ref>).</>,
    },
    {
      q: '이 주차가 비용을 실행 시간보다 “질의당 읽은 페이지 수(버퍼)”로 먼저 보는 이유는?',
      choices: ['시간은 잴 수 없어서', '페이지 수는 같은 데이터·같은 인덱스면 거의 같아서, 실행마다 덜 흔들린다', '페이지 수가 항상 더 작아서', 'PostgreSQL이 시간을 알려 주지 않아서'],
      answer: 1,
      why: <>시간은 노트북 상태에 따라 흔들린다. 그래프는 대부분 “가로 = 페이지/질의, 세로 = recall”이다(<Ref to="/pgvector/ann-details#cost">2절</Ref>).</>,
    },
    {
      q: '128차원 무작위 점들로 recall을 재면 왜 문제가 되나?',
      choices: ['점이 너무 적어서', '모든 점이 거의 같은 거리에 있어 “가장 가까운 것”이 우연에 좌우된다', 'PostgreSQL이 128차원을 지원하지 않아서', '인덱스가 만들어지지 않아서'],
      answer: 1,
      why: <>고차원의 거리 집중이다. 그래서 실험은 질문 근처에 진짜 가까운 점을 섞어 넣었다(<Ref to="/pgvector/ann-details#pitfalls">3절</Ref>).</>,
    },
  ],

  ivfflat: [
    {
      q: 'IVFFlat의 “Flat”은 무슨 뜻인가?',
      choices: ['그래프가 한 층이라는 뜻', '목록 안의 벡터를 압축하지 않고 원본 그대로 저장한다는 뜻', '모든 동네의 크기가 같다는 뜻', '차원을 줄여 저장한다는 뜻'],
      answer: 1,
      why: <>그래서 고른 동네 안에서는 정확한 거리를 잰다. 놓치는 것은 동네를 고르는 단계에서다(<Ref to="/pgvector/ivfflat-details#name">1절</Ref>).</>,
    },
    {
      q: 'IVFFlat이 진짜 가장 가까운 점을 놓치는 경우는?',
      choices: ['동네 안 거리를 대충 계산해서', '진짜 이웃이 고르지 않은 옆 동네에 있을 때 — 질문이 동네 경계 근처일 때', '벡터를 압축해서', '중심이 너무 많아서 항상'],
      answer: 1,
      why: <><K>ivfflat.probes</K>를 늘려 옆 동네까지 뒤지면 덜 놓친다(<Ref to="/pgvector/ivfflat-details#search">3절</Ref>).</>,
    },
    {
      q: <>probes=1로 고정하고 lists를 {L_SMALL}에서 {L_BIG}로 늘렸다. 이 자료의 측정에서 무슨 일이 생겼나?</>,
      choices: [
        'recall이 올랐다',
        <>동네가 잘게 나뉘어 진짜 이웃이 옆 동네로 갈라지면서 recall이 {r2(ivf(L_SMALL, 1).recall)} → {r2(ivf(L_BIG, 1).recall)}로 떨어졌다</>,
        '아무 변화가 없었다',
        '인덱스를 만들 수 없었다',
      ],
      answer: 1,
      why: <>lists를 키우면 probes도 함께 키워야 한다. 너무 잘게 나누면 중심 비교 비용 때문에 오히려 더 읽기도 한다(<Ref to="/pgvector/ivfflat-details#lists-probes">4절</Ref>).</>,
    },
    {
      q: '질의마다 SET으로 바꿀 수 있는 손잡이는?',
      choices: [<K key="a">lists</K>, <K key="b">ivfflat.probes</K>, '둘 다', '둘 다 아님'],
      answer: 1,
      why: <>lists는 인덱스를 만들 때 정하므로 바꾸려면 다시 만들어야 한다. probes는 <K>SET ivfflat.probes = …</K>(<Ref to="/pgvector/ivfflat-details#lists-probes">4절</Ref>).</>,
    },
    {
      q: '무리 절반으로 IVFFlat을 만든 뒤 나머지 무리의 행을 넣었다. 새 무리에 대한 recall을 되살린 것은?',
      choices: ['probes를 1로 낮추기', <><K key="a">REINDEX</K>로 다시 만들기 — 새 데이터까지 보고 중심을 다시 정한다</>, 'VACUUM', '아무것도 하지 않아도 저절로 회복된다'],
      answer: 1,
      why: <>측정에서 REINDEX 전 {r2(sIvf.before)}, 후 {r2(sIvf.after)}. 중심은 만드는 순간 고정되기 때문이다(<Ref to="/pgvector/ivfflat-details#shift">6절</Ref>).</>,
    },
  ],

  hnsw: [
    {
      q: 'HNSW에서 위층으로 갈수록 점이 적은 이유는?',
      choices: ['오래된 점만 위층에 올라가서', '점마다 한 층 더 올라갈 확률이 1/m로 정해져, 위층일수록 기하급수적으로 적어진다', '거리가 먼 점만 올라가서', '관리자가 직접 정해서'],
      answer: 1,
      why: <>기본 m=16이면 16개 중 1개가 1층에, 256개 중 1개가 2층에 올라간다(<Ref to="/pgvector/hnsw-details#layers">2절</Ref>).</>,
    },
    {
      q: <><K>hnsw.ef_search</K>를 40에서 200으로 올리면?</>,
      choices: ['인덱스를 다시 만들어야 한다', '들고 다니는 후보 명단이 길어져 더 정확해지고, 더 많이 읽는다', '인덱스 크기가 커진다', '결과가 항상 똑같다'],
      answer: 1,
      why: <>질의마다 SET으로 바꿀 수 있는 유일한 HNSW 손잡이다. pgvector 문서는 LIMIT의 2배 이상을 권한다(<Ref to="/pgvector/hnsw-details#search">4절</Ref>).</>,
    },
    {
      q: <>ef_construction={EFC_LOW}로 만든 인덱스는 ef_search를 {EF_MAX}까지 올려도 recall이 {hnsw(16, EFC_LOW, EF_MAX).recall.toFixed(3)}에서 더 오르지 않았다. 무엇을 해야 하나?</>,
      choices: ['ef_search를 더 올린다', 'ef_construction(또는 m)을 올려 인덱스를 다시 만든다 — 길 자체가 엉성한 것이 원인', 'VACUUM을 한다', 'probes를 올린다'],
      answer: 1,
      why: <>m·ef_construction은 길의 품질, ef_search는 탐색 폭이다. 길이 엉성하면 탐색 폭을 늘려도 천장이 있다(<Ref to="/pgvector/hnsw-details#knobs">5절</Ref>).</>,
    },
    {
      q: <>행 20%를 지운 뒤 VACUUM이 HNSW에서는 {vacuumMs('HNSW').toFixed(0)}ms, IVFFlat에서는 {vacuumMs('IVFFlat').toFixed(0)}ms 걸렸다. HNSW가 오래 걸린 이유는?</>,
      choices: ['인덱스가 더 커서 단순히 읽을 게 많아서', '지워진 점을 거쳐 가던 길이 끊기지 않도록 주변 점들의 이웃을 다시 이어 줘야 해서', 'HNSW는 지운 행을 다시 넣어서', '측정 오류'],
      answer: 1,
      why: <>삭제·갱신이 잦은 테이블이면 운영 부담이 된다. pgvector 문서는 먼저 REINDEX한 뒤 VACUUM하라고 권한다(<Ref to="/pgvector/hnsw-details#delete">6절</Ref>).</>,
    },
    {
      q: <><K>WITH (m = 16, ef_construction = 16)</K>으로 HNSW 인덱스를 만들면?</>,
      choices: ['그대로 만들어진다', '경고만 나온다', '오류 — ef_construction은 2 × m 이상이어야 한다', 'm이 8로 자동 조정된다'],
      answer: 2,
      why: <>실제 오류: “ef_construction must be greater than or equal to 2 * m”. 고를 후보가 이을 이웃(0층 2m)보다 적으면 안 되기 때문이다(<Ref to="/pgvector/hnsw-details#insert">3절</Ref>).</>,
    },
  ],

  'hnsw-ivfflat': [
    {
      q: '데이터가 계속 들어오고 성격도 바뀌는 서비스에서 기본으로 고를 인덱스는?',
      choices: ['IVFFlat — 빌드가 빨라서', 'HNSW — 넣을 때마다 그 자리에서 길을 이어, 다시 만들 필요가 없어서', '인덱스 없이', '둘 다 만든다'],
      answer: 1,
      why: <>IVFFlat은 중심이 낡으면 REINDEX 시점을 관리해야 한다(<Ref to="/pgvector/hnsw-ivfflat#why-hnsw">3절</Ref>).</>,
    },
    {
      q: '“HNSW가 같은 비용에서 IVFFlat보다 더 정확하다”는 일반론은 이 자료의 측정에서 어땠나?',
      choices: ['그대로 확인됐다', '재현되지 않았다 — 두 데이터셋 모두 IVFFlat이 비슷한 recall을 더 적은 페이지로 냈다(인공 데이터라는 한계와 함께)', 'HNSW가 두 배 정확했다', '측정하지 않았다'],
      answer: 1,
      why: <>그래서 HNSW를 기본으로 권하는 근거를 정확도가 아니라 운영으로 정리했다(<Ref to="/pgvector/hnsw-ivfflat#compare">2절</Ref>).</>,
    },
    {
      q: '매일 밤 데이터를 통째로 다시 적재하는 정적인 데이터라면?',
      choices: ['HNSW만 가능하다', 'IVFFlat도 합리적이다 — 빌드가 빠르고 작으며, 어차피 매번 다시 만든다', '인덱스를 쓸 수 없다', 'DiskANN만 가능하다'],
      answer: 1,
      why: <>AWS 가이드의 기준도 같다: IVFFlat은 “정적인 대형 데이터 + 배치 재빌드 주기가 있을 때”(<Ref to="/pgvector/hnsw-ivfflat#why-hnsw">3절</Ref>).</>,
    },
  ],

  tuning: [
    {
      q: '“recall@10 vs 질의당 페이지” 그래프에서 좋은 위치는?',
      choices: ['오른쪽 아래', '왼쪽 위 — 적게 읽고 정확하다', '오른쪽 위', '왼쪽 아래'],
      answer: 1,
      why: <>같은 가로 위치(같은 비용)에서 더 높이 있는 선이 같은 돈으로 더 정확한 인덱스다(<Ref to="/pgvector/tuning#curve">1절</Ref>).</>,
    },
    {
      q: <>HNSW를 가장 싸게 설정했을 때(ef_search=10) 행 수를 {fmtNum(recall.n_vectors)}에서 {fmtNum(scale.n_vectors)}로 늘리면 recall은?</>,
      choices: ['그대로였다', <>{r2(avg(pick(recall.configs, 'hnsw_ef10').recall))} → {r2(pick(scale.configs, 'hnsw_ef10').recall_at_10)}로 크게 떨어졌다</>, '1.0으로 올랐다', '측정할 수 없었다'],
      answer: 1,
      why: <>같은 탐색 폭으로 더 넓은 공간을 보니 놓치는 것이 는다. IVFFlat의 가장 싼 설정도 마찬가지였다(<Ref to="/pgvector/tuning#scale">2절</Ref>).</>,
    },
    {
      q: '같은 비교에서 DiskANN의 가장 싼 설정은?',
      choices: ['HNSW보다 더 많이 떨어졌다', <>{r2(pick(scale.configs, 'diskann_sls10').recall_at_10)}을 유지했다</>, '인덱스를 만들 수 없었다', '0이 되었다'],
      answer: 1,
      why: <>대신 DiskANN은 출발점부터 많이 읽고, 만드는 데 오래 걸린다(<Ref to="/pgvector/cost#build">빌드 비용과 크기</Ref>).</>,
    },
    {
      q: '이 페이지에서 얻을 실무 교훈은?',
      choices: ['기본값이 항상 최선이다', '기본값을 믿지 말고 내 데이터로 recall을 재며 손잡이를 고른다', 'recall은 재지 않아도 된다', '가장 비싼 설정을 쓴다'],
      answer: 1,
      why: <>가장 싼 설정의 품질은 규모와 데이터에 따라 크게 달라졌다(<Ref to="/pgvector/tuning#scale">2절</Ref>).</>,
    },
  ],

  diskann: [
    {
      q: 'pgvectorscale은 pgvector에 무엇을 더하나?',
      choices: ['새 벡터 타입과 새 거리 연산자', <>새 인덱스 종류 하나(<K key="a">USING diskann</K>) — 타입·연산자는 pgvector 것을 그대로 쓴다</>, 'pgvector를 대체하는 별도 DB', '임베딩 모델'],
      answer: 1,
      why: <>그래서 질의 SQL은 그대로고 CREATE INDEX의 USING만 바뀐다(<Ref to="/pgvector/diskann-details#what">1절</Ref>).</>,
    },
    {
      q: 'DiskANN이 압축본(SBQ)으로 후보를 고른 다음 하는 일은?',
      choices: ['그대로 결과를 돌려준다', <>상위 후보를 원본 벡터로 다시 재서 순서를 바로잡는다(<K key="a">diskann.query_rescore</K>)</>, '후보를 모두 버린다', 'HNSW 인덱스에 넘긴다'],
      answer: 1,
      why: <>썸네일로 먼저 고르고 원본으로 확인하는 것과 같다(<Ref to="/pgvector/diskann-details#build">2절</Ref>).</>,
    },
    {
      q: <>라벨을 인덱스에 넣은 DiskANN에서 <K>WHERE labels && ARRAY[10]</K>는 EXPLAIN에 어떻게 나오나?</>,
      choices: [<K key="a">Filter</K>, <K key="b">Index Cond</K>, <K key="c">Sort Key</K>, '나오지 않는다'],
      answer: 1,
      why: <>인덱스가 찾는 도중에 직접 거른다. HNSW + WHERE는 결과를 받은 뒤 버리는 <K>Filter</K>다(<Ref to="/pgvector/diskann-details#labels">3절</Ref>).</>,
    },
    {
      q: 'AWS RDS나 Supabase에서 pgvectorscale을 쓸 수 있나? (2026-10 웹 검색 기준)',
      choices: ['모두 쓸 수 있다', '대부분 쓸 수 없다 — 제작사의 Timescale Cloud 외에는 허용 목록에 없다', 'RDS만 된다', 'Supabase만 된다'],
      answer: 1,
      why: <>pgvector는 대부분 지원한다. 이 차이가 실무 선택을 크게 좌우한다(<Ref to="/pgvector/selection-details#managed">언제 무엇을 쓰나</Ref>).</>,
    },
  ],

  cost: [
    {
      q: <>{fmtNum(lastBuild.n)}행에서 DiskANN 인덱스를 만드는 데 HNSW보다 얼마나 더 걸렸나?</>,
      choices: ['비슷했다', <>약 {ratio(lastBuild.diskann_build_ms, lastBuild.hnsw_build_ms)}</>, '절반이었다', '측정하지 못했다'],
      answer: 1,
      why: <>행이 늘수록 격차가 벌어졌다. 제작사도 “빌드가 느리다, 현재 단일 스레드 구현”이라고 인정했다(<Ref to="/pgvector/cost#build">1절</Ref>).</>,
    },
    {
      q: '확장을 더 설치하지 않고 HNSW 인덱스 크기를 줄이는 첫 수단은?',
      choices: ['m을 100으로 올린다', <><K key="a">halfvec</K> — 숫자 하나를 4바이트 대신 2바이트로 저장한다</>, 'VACUUM', 'REINDEX'],
      answer: 1,
      why: <>측정에서 {f4.index_mb.toFixed(1)} MB → {hv.index_mb.toFixed(1)} MB({Math.round((1 - hv.index_mb / f4.index_mb) * 100)}% 감소). DiskANN과의 크기 차이 대부분을 이것만으로 줄였다(<Ref to="/pgvector/cost#halfvec">4절</Ref>).</>,
    },
    {
      q: '“압축을 끄면 서버가 죽는다”는 첫 결론은 어떻게 됐나?',
      choices: ['그대로 확인됐다', <>{exp.plain_repro.attempts}번 다시 해 봐도 한 번도 죽지 않아 철회했다</>, '메모리를 늘리자 해결됐다', '측정을 그만뒀다'],
      answer: 1,
      why: <>극적인 결과 하나를 바로 일반화하지 않고, 반복 재현부터 해 봐야 한다는 교훈이다(<Ref to="/pgvector/cost#plain">3절</Ref>).</>,
    },
    {
      q: '인덱스 크기를 테이블 크기로 나눈 비율에 대한 설명으로 맞는 것은?',
      choices: ['세 인덱스 모두 테이블보다 크다', 'HNSW는 이웃 목록까지 저장해 테이블보다 크고, DiskANN은 압축본을 저장해 테이블보다 작다', 'DiskANN이 가장 크다', '행 수가 늘수록 비율이 크게 변한다'],
      answer: 1,
      why: <>HNSW 약 {r2(lastBuild.hnsw_ratio_to_table)}배, DiskANN 약 {r2(lastBuild.diskann_ratio_to_table)}배로 행 수가 바뀌어도 거의 일정했다(<Ref to="/pgvector/cost#size">2절</Ref>).</>,
    },
  ],

  filtering: [
    {
      q: <>HNSW 인덱스 기본값에서 <K>WHERE label = 10 ORDER BY embedding {'<->'} 질문 LIMIT 10</K>이 0행을 돌려준 이유는?</>,
      choices: ['라벨 10인 행이 없어서', '인덱스가 가까운 후보 ef_search(40)개를 먼저 내줬는데 전부 다른 라벨이라 WHERE에서 다 걸러졌다', '오류가 나서', 'LIMIT이 잘못돼서'],
      answer: 1,
      why: <>오류 없이 빈 결과가 나온다는 점이 위험하다(<Ref to="/pgvector/filtering-details#hnsw-default">2절</Ref>).</>,
    },
    {
      q: '이 문제를 고치는 pgvector 설정은?',
      choices: [<K key="a">SET hnsw.ef_search = 1</K>, <K key="b">SET hnsw.iterative_scan = relaxed_order</K>, <K key="c">SET enable_seqscan = on</K>, <K key="d">VACUUM</K>],
      answer: 1,
      why: <>결과가 모자라면 탐색을 이어서 더 찾는다. pgvector 0.8.0에 추가됐다(<Ref to="/pgvector/filtering-details#iterative">3절</Ref>).</>,
    },
    {
      q: '같은 10행을 찾을 때 HNSW + iterative_scan과 DiskANN 라벨 인덱스의 비용은?',
      choices: [
        '같았다',
        <>HNSW {fmtNum(rel.buffers_per_query)}페이지·{rel.ms_per_query.toFixed(1)}ms vs DiskANN {fmtNum(dk.buffers_per_query)}페이지·{dk.ms_per_query.toFixed(2)}ms — DiskANN이 약 {ratio(rel.ms_per_query, dk.ms_per_query)} 빨랐다</>,
        'HNSW가 더 쌌다',
        'DiskANN은 결과를 찾지 못했다',
      ],
      answer: 1,
      why: <>대신 DiskANN이 돌려준 행은 평균 거리가 조금 더 멀었다(<Ref to="/pgvector/filtering-details#quality">5절</Ref>).</>,
    },
    {
      q: '이 실험의 첫 판이 “HNSW는 어떤 설정으로도 0행”이라고 잘못 결론 낸 이유는?',
      choices: ['pgvector 버그', <>실험 데이터가 {fmtNum(fDup.rows)}행 중 서로 다른 벡터 {fDup.distinct_vectors}개뿐이었다 — 서브쿼리가 한 번만 계산된 InitPlan 함정</>, '메모리 부족', '라벨이 없어서'],
      answer: 1,
      why: <>같은 벡터가 대량으로 있으면 HNSW 그래프가 끊어져 닿는 행이 몇백 개뿐이었다. 데이터는 만든 직후 검증한다(<Ref to="/pgvector/filtering-details#first-edition">7절</Ref>).</>,
    },
  ],
}
