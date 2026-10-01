# 발표 대본 — 관계형 DB가 이해하는 세계를 넓히다

- 버전: 완전판
- 형식: 16:9 와이드
- 슬라이드 수: 27장
- 구성: 핵심 서사 17장 + 상세 역사·엔진·소유권 6장 + 교정·결론·출처
- 원문: README.md, why-postgresql.md, history-timeline.md

## 01. 관계형 DB가 이해하는 세계를 넓히다

오늘의 중심 질문은 관계형 모델을 버리지 않으면서 PostgreSQL이 어떻게 새로운 데이터 세계를 받아들였는가입니다. INGRES의 선언적 관계형 철학, POSTGRES의 타입·함수·연산자·인덱스 확장, Postgres95의 SQL 전환, 커뮤니티 PostgreSQL, 그리고 MySQL의 별도 계보를 한 흐름으로 구분합니다.

## 02. 네 단계만 잡으면 전체 역사가 연결된다

전체 흐름을 먼저 잡습니다. INGRES는 관계형 모델과 선언적 질의를 실제 시스템으로 구현했습니다. POSTGRES는 그 관계형 기반을 유지하면서 새로운 타입과 동작을 추가할 수 있게 다시 설계했습니다. Postgres95는 이미 있던 확장 기능을 SQL로 사용할 수 있게 만든 전환이고, PostgreSQL은 그 코드를 커뮤니티가 이어받아 발전시킨 이름입니다. 이 네 단계는 연구 철학, 코드 계보, 프로젝트 운영 방식이 각각 어떻게 바뀌었는지를 보여 줍니다. 출처: [2][3][5]

## 03. 관계형 모델의 시작과 제품 계보는 같은 이야기가 아니다

관계형 모델의 이론적 출발은 IBM의 Edgar F. Codd가 1970년에 제안한 논문입니다. 이론을 실제 시스템으로 검증한 대표 연구는 IBM System R과 UC Berkeley INGRES입니다. Oracle V2는 1979년 상용 SQL RDBMS 계보에서 중요한 제품입니다. PostgreSQL은 Oracle에서 나온 것이 아니라 Berkeley의 INGRES와 POSTGRES 연구 계보에서 나왔습니다. 따라서 이론, 연구 구현, 상용 제품, 직접 코드 계보를 분리해 봐야 합니다. 출처: [1][2][5]

## 04. INGRES의 핵심은 “무엇을 원하는지만 선언하라”였다

INGRES의 고유한 철학이라기보다 관계형 DBMS 전반의 기반을 구현한 것입니다. 사용자는 원하는 결과를 QUEL 같은 비절차적 질의로 표현하고, 저장 위치·인덱스·조인 순서 같은 실행 방법은 DBMS가 결정합니다. 이것이 논리 구조와 물리 구조를 분리하는 데이터 독립성입니다. PostgreSQL뿐 아니라 MySQL과 Oracle을 포함한 현대 RDBMS도 이 기반을 공유합니다. 출처: [2]

## 05. 업무 데이터 밖에서 관계형 DB의 한계가 드러났다

POSTGRES가 다루려던 새로운 문제는 단순한 고객명, 부서 코드, 주문 수량을 넘어섰습니다. CAD와 반도체 회로, 지도와 공간 객체, 그래픽과 과학 데이터는 선·원·다각형 같은 복잡한 값을 자연스럽게 저장하고 질의해야 했습니다. 기존 DB에 숫자로 잘게 분해해 저장할 수는 있지만, 조립·연산·검색 의미가 애플리케이션으로 밀려나고 공간 인덱싱도 어렵습니다. 출처: [3][4]

## 06. INGRES에 계속 붙이는 대신, 확장성을 중심으로 다시 설계했다

INGRES는 실패한 시스템이 아닙니다. 관계형 모델의 실용성을 보여 준 성공적인 연구였습니다. 그 뒤 분산 DB, 추상 데이터 타입, QUEL을 데이터 타입처럼 쓰는 실험 등을 계속 추가하면서 기존 구조와 새 아이디어가 충돌했습니다. 연구팀은 기존 코드를 끝없이 패치하는 대신 관계형 모델은 유지하되 확장 지점을 처음부터 구조적으로 가진 새 후속 시스템 POSTGRES를 설계했습니다. INGRES에서 POSTGRES로의 화살표는 단순 버전 업이 아니라 새 연구 후속 시스템을 뜻합니다. 출처: [3][4]

## 07. 객체 DB로 떠난 것이 아니라, 관계형 DB의 표현력을 넓혔다

POSTGRES는 객체지향 데이터베이스로 관계형 모델을 대체하려 한 프로젝트가 아닙니다. 바깥 모델은 관계형 테이블과 선언적 질의로 유지하고, 컬럼 값에 복잡한 객체와 사용자 정의 타입을 담으며 그 타입의 함수·연산자·인덱싱 의미를 추가하는 방향을 선택했습니다. 이 결합을 나중에 객체-관계형이라고 부릅니다. 핵심 문장은 관계형 DB를 버린 것이 아니라 관계형 DB가 이해할 수 있는 세계를 넓혔다는 것입니다. 출처: [3][4]

## 08. 새 타입은 “값 + 동작 + 검색 규칙”을 함께 정의한다

새 타입을 만든다는 것은 이름과 바이트 크기만 등록하는 일이 아닙니다. 타입의 내부 표현과 길이·정렬 같은 특성, 텍스트와 내부 값을 오가는 입력·출력 함수, 실제 계산 함수, 그 함수를 SQL 기호에 연결하는 연산자, 인덱스가 정렬·비교·검색하는 규칙이 함께 필요합니다. 단, 저장 방식은 새로운 스토리지 엔진을 만든다는 뜻이 아니라 해당 값의 내부 표현을 정의한다는 뜻입니다. 테이블 페이지, MVCC, WAL과 트랜잭션은 PostgreSQL 코어가 계속 담당합니다. 출처: [6][7][8]

## 09. polygon 하나를 DB가 “이해한다”는 뜻

예를 들어 polygon 타입을 추가한다고 생각해 봅니다. 입력 함수는 사용자가 입력한 좌표 문자열을 내부 표현으로 변환하고 출력 함수는 반대로 보여 줍니다. 면적이나 교차 여부 같은 함수가 실제 계산을 수행하며 연산자는 그 함수를 SQL 기호에 연결합니다. 대량의 공간 객체를 빠르게 찾으려면 비교 연산과 지원 함수를 operator class로 묶어 인덱스 접근 방식에 연결해야 합니다. 그러면 optimizer가 새로운 타입도 쿼리 계획 안에서 다룰 수 있습니다. 출처: [3][4][9]

## 10. 최초 POSTGRES 설계는 확장성 하나만 보지 않았다

1986년 설계 문서는 POSTGRES의 목표를 여섯 축으로 설명합니다. 복잡한 객체, 사용자 확장성, 능동형 DB와 규칙, 복구 구조 단순화, 새로운 하드웨어 활용, 그리고 관계형 모델을 가능한 한 유지하는 것입니다. 오늘날 가장 선명하게 남은 인상은 타입 확장이지만, 당시에는 차세대 범용 DBMS의 여러 문제를 동시에 연구했습니다. 초기 저장·복구 방식이 현대 PostgreSQL과 완전히 같다고 보면 안 됩니다. 출처: [3]

## 11. 연구 계보와 직접 코드 계보를 따로 그려야 한다

INGRES에서 POSTGRES로의 연결은 같은 Berkeley 연구팀과 문제의식이 이어진 연구 계보입니다. 하지만 기존 INGRES 코드의 단순한 다음 버전이 아니라 새 목표로 설계한 후속 시스템입니다. POSTGRES 4.2에서 Postgres95, PostgreSQL로의 연결은 기존 코드를 계속 발전시킨 직접 코드 계보입니다. INGRES는 Michael Stonebraker와 Eugene Wong 중심 팀, POSTGRES는 Stonebraker가 이끌고 Lawrence Rowe 등이 설계에 참여했습니다. Postgres95는 Andrew Yu와 Jolly Chen이 만들었습니다. 출처: [2][3][5]

## 12. “오픈 소스”라는 이름보다 공유 문화가 먼저였다

소스 공유 문화는 초기 컴퓨팅 시절 연구소와 사용자 그룹에서 이미 존재했습니다. Berkeley에서는 1970년대부터 BSD 배포 문화가 발전했고, 1980년대 GNU와 자유 소프트웨어 운동은 사용·연구·수정·재배포의 권리를 라이선스로 정교화했습니다. 1990년대 Linux와 인터넷 기반 공동 개발이 확산됐고, Open Source라는 명칭과 OSI는 1998년에 등장했습니다. 따라서 1995년 Postgres95와 1996년 PostgreSQL은 용어가 만들어지기 전부터 오늘날 오픈소스에 가까운 방식을 실천했습니다. 출처: [13][14][15]

## 13. 사용자가 늘자 연구보다 “지원”에 더 많은 시간이 들었다

POSTGRES는 1987년 데모 시스템, 1989년 소수 외부 사용자 대상 Version 1, 이후 여러 버전으로 확장됐습니다. 1993년에는 외부 사용자 커뮤니티가 거의 두 배가 됐고 버그 수정, 포팅, 질문 대응과 기능 요청이 연구팀 시간을 차지했습니다. Berkeley는 지원 부담을 줄이고 새 연구에 집중하기 위해 Version 4.2를 마지막으로 공식 POSTGRES 프로젝트를 종료했습니다. 종료는 코드 삭제나 폐쇄를 뜻하지 않았습니다. 4.2 소스는 anonymous FTP로 받을 수 있었습니다. 출처: [5][12]

## 14. Postgres95는 SQL을 위한 “실용적 계속 작업”이었다

공식 Berkeley POSTGRES 연구가 끝난 뒤에도 POSTGRES 코드는 Mariposa와 Tioga 연구의 기반으로 필요했습니다. Mariposa의 핵심 프로그래머 Andrew Yu와 Berkeley 박사과정 Jolly Chen은 코드를 정리하고 두 연구에서 사용하기 위해 SQL을 적용했습니다. 기존 PostQUEL 질의 언어는 서버의 SQL 구현으로 교체됐습니다. ANSI C 정리, 코드 축소, 성능과 유지보수 개선, psql 제공도 함께 이뤄졌습니다. 공개판은 처음부터 목표였다기보다 나중에 결정된 결과에 가까웠고, 1995년 웹에 공개된 뒤 예상보다 인기를 얻었습니다. 출처: [5][11]

## 15. Postgres95를 커뮤니티가 계승하며 PostgreSQL이 됐다

1996년 Andrew Yu와 Jolly Chen이 프로젝트에 많은 시간을 쓰기 어려워지자 메일링리스트 사용자들이 개발을 이어받았습니다. Marc Fournier는 서버와 메일링리스트 인프라를 제공했고 Bruce Momjian, Thomas Lockhart, Vadim Mikheev 등이 초기 글로벌 개발팀을 구성했습니다. Postgres95라는 연도 이름은 오래 유지하기 어렵고 SQL 지원을 드러낼 필요가 있어 PostgreSQL로 이름을 바꿨습니다. 이것은 새 DB를 다시 작성한 사건이 아니라 같은 코드 계보의 커뮤니티 계승과 명칭 변경입니다. 현재 PostgreSQL은 특정 회사가 소유하지 않는 커뮤니티 프로젝트입니다. 출처: [5][11][17]

## 16. 초기 확장 철학은 오늘날 extension 생태계로 남았다

현대 PostgreSQL은 CREATE TYPE, CREATE FUNCTION, CREATE OPERATOR, operator class와 여러 확장 지점을 제공합니다. 관련 SQL 객체와 네이티브 코드를 하나의 설치·업데이트 단위로 묶는 것이 extension입니다. 중요한 역사적 구분은 CREATE EXTENSION 명령이 1986년부터 있었던 것이 아니라는 점입니다. 오래 이어진 것은 코어를 직접 포크하지 않고 새로운 타입과 동작을 등록할 수 있어야 한다는 설계 방향이고, extension은 그것을 현대적으로 패키징하고 관리하는 장치입니다. 출처: [6][7][10]

## 17. MySQL은 같은 질문에서 출발한 경쟁 프로젝트가 아니었다

POSTGRES와 MySQL의 출발 질문은 다릅니다. POSTGRES는 기존 관계형 DB 구조가 복잡한 데이터와 새로운 동작을 수용하기 어려운 문제에서 출발했습니다. MySQL은 자체 ISAM 기반 데이터 처리 루틴에 SQL 인터페이스를 붙이려 했고, mSQL이 요구한 속도와 유연성을 충족하지 못해 자체 SQL 서버를 만들었습니다. 이 역사는 현대의 성능 우열을 자동으로 말해 주지 않습니다. 다만 PostgreSQL의 타입·연산자 확장과 MySQL의 플러그형 스토리지 엔진을 이해하는 출발점이 됩니다. 출처: [3][16][18]

## 18. 관계형 이론이 연구실에서 상용 산업으로 이동한 13년

1970년 Edgar F. Codd가 관계형 모델을 제안한 뒤 IBM System R과 Berkeley INGRES가 서로 다른 연구 현장에서 관계형 DBMS를 구현했습니다. Oracle의 전신 회사는 1977년에 설립됐고 1979년 Oracle V2를 상용 출시했습니다. IBM은 1983년 DB2를 출시했습니다. 이 연표는 이론, 연구 구현, 상용 제품이 같은 사건이 아니라 서로 다른 계보라는 점을 보여 줍니다. 출처: [1][22]

## 19. POSTGRES는 1995년에 갑자기 처음 공개된 것이 아니다

POSTGRES는 1987년 demoware, 1988년 ACM SIGMOD 시연, 1989년 Version 1의 소수 외부 배포를 거쳤습니다. 1990년 Version 2에서는 rule system을 다시 작성했고 1991년 Version 3에서는 여러 storage manager 지원과 query executor·rule system 개선이 이뤄졌습니다. 1994년 Version 4.2가 Berkeley의 마지막 공식 릴리스이자 anonymous FTP 배포판이었고, 1995년 Postgres95가 웹에 공개됐습니다. 따라서 공식 연구 종료, 소스 배포, 웹 기반 커뮤니티 전환은 구분해야 합니다. 출처: [5][12]

## 20. Postgres95는 “SQL을 넣은 완성품”이 아니라 과도기의 수술 기록이다

Postgres95는 POSTGRES 4.2를 기반으로 PostQUEL 인터프리터를 SQL 인터프리터로 교체하고, 코드를 ANSI C에 맞게 정리했습니다. 옛 공식 문서는 코드 크기가 약 25% 줄고 Wisconsin Benchmark에서 30~50% 성능 향상이 있었다고 설명하며 psql과 SQL 튜토리얼도 언급합니다. 그러나 당시 SQL 지원은 완전하지 않았고 subquery 등 일부 기능은 아직 없었습니다. 따라서 Postgres95의 의미는 완성된 표준 구현이 아니라 확장 가능한 POSTGRES 코드를 SQL 사용자와 이후 커뮤니티가 다룰 수 있는 기반으로 바꾼 데 있습니다. 출처: [11][23]

## 21. MySQL의 제품화·엔진·MariaDB는 한 줄 계보가 아니다

MySQL은 TcX가 사용하던 자체 ISAM 루틴에 더 나은 SQL 인터페이스가 필요해지면서 시작됐고 1995년 첫 공개 릴리스로 이어졌습니다. MyISAM은 기존 MySQL ISAM 엔진의 직접 개선 계보입니다. InnoDB는 Innobase Oy가 별도로 개발한 엔진이 MySQL에 통합된 관계이며, MariaDB는 MySQL 코드베이스에서 갈라진 fork입니다. 제품·코드 계보, 엔진 내부 계보, 외부 엔진 통합은 서로 다른 관계이므로 한 시간축으로 연결하면 안 됩니다. 출처: [16][19][24]

## 22. MyISAM과 InnoDB는 같은 엔진의 전후 버전이 아니다

MySQL은 SQL 처리와 저장을 스토리지 엔진으로 분리합니다. ISAM에서 MyISAM으로의 연결은 기존 MySQL ISAM 엔진을 개선한 직접 계보입니다. InnoDB는 Innobase Oy가 별도로 개발한 트랜잭션 스토리지 엔진으로 MyISAM의 코드를 고친 후속판이 아닙니다. MySQL에서 두 엔진이 선택지로 공존했고, 이후 기본 엔진이 MyISAM에서 InnoDB로 바뀐 것입니다. 따라서 MyISAM에서 InnoDB로의 화살표는 코드 계승이 아니라 기본 선택의 세대교체입니다. 출처: [16][18][19]

## 23. 소유권 계보는 기술 계보와 별도로 봐야 한다

MySQL 서버와 InnoDB는 개발 회사부터 달랐습니다. 2005년 Oracle이 InnoDB 개발사 Innobase Oy를 먼저 인수했습니다. 2008년 Sun Microsystems가 MySQL AB를 인수했고, Oracle은 2009년 Sun 인수 계약을 발표한 뒤 2010년에 완료했습니다. 따라서 Oracle은 MySQL AB를 직접 산 것이 아니라 Sun 전체 인수를 통해 MySQL 서버를 확보했고, InnoDB는 더 앞선 별도 인수로 확보했습니다. 같은 Oracle 산하라는 사실은 Oracle Database와 MySQL의 코드 계보가 합쳐졌다는 뜻이 아닙니다. 출처: [19][20][21]

## 24. 헷갈리기 쉬운 여섯 문장을 붉은 펜으로 교정하기

첫째, INGRES는 PostgreSQL만의 철학이 아니라 관계형 DB 전반의 기반을 구현했습니다. 둘째, POSTGRES는 그 위에 사용자 확장성을 중심 설계로 만들었습니다. 셋째, 사용자 정의 타입은 Postgres95에서 생긴 것이 아니라 POSTGRES의 핵심 아이디어였습니다. 넷째, Postgres95는 PostQUEL을 SQL로 교체해 실용성을 높인 직접 후속 코드입니다. 다섯째, PostgreSQL은 새로 다시 만든 DB가 아니라 커뮤니티가 Postgres95를 계승해 이름을 바꾼 프로젝트입니다. 여섯째, 오픈 소스라는 명칭은 1998년에 생겼지만 공유와 공동 개발 방식은 그보다 먼저 존재했습니다. 출처: [3][5][13]

## 25. PostgreSQL을 설명하는 네 문장 중 무엇을 선택할까?

설명 A는 오늘날 기능 비교를 역사적 원인으로 거꾸로 투사하므로 부정확합니다. 설명 B는 중요한 사용자 정의 타입만 남기지만 POSTGRES의 더 넓은 확장 설계를 놓칩니다. 설명 C는 Postgres95와 PostgreSQL의 직접 코드 계보를 끊어 버립니다. 권장 설명은 D입니다. PostgreSQL은 관계형 코어를 유지하면서 타입·함수·연산자·인덱스 접근 방식을 확장하도록 설계한 POSTGRES에서 출발했고, Postgres95의 SQL 전환과 커뮤니티 계승을 거쳐 발전했습니다. 출처: [3][5][6]

## 26. Sources / foundations & PostgreSQL

발표에서 사용한 주요 원문과 공식 문서입니다. 역사적 동기는 Berkeley 원문과 PostgreSQL 공식 역사, 현재 확장 기능은 PostgreSQL 공식 문서를 우선했습니다. MySQL 계보와 회사 인수는 MySQL·Oracle·MariaDB Foundation 자료를 교차 확인했습니다.

## 27. Sources / community, open source & MySQL

발표에서 사용한 주요 원문과 공식 문서입니다. 역사적 동기는 Berkeley 원문과 PostgreSQL 공식 역사, 현재 확장 기능은 PostgreSQL 공식 문서를 우선했습니다. MySQL 계보와 회사 인수는 MySQL·Oracle·MariaDB Foundation 자료를 교차 확인했습니다.

## Sources

[1] https://www.ibm.com/history/relational-database
[2] https://dl.acm.org/doi/10.1145/320473.320476
[3] https://dsf.berkeley.edu/papers/ERL-M85-95.pdf
[4] https://arxiv.org/pdf/1901.01973
[5] https://www.postgresql.org/docs/current/history.html
[6] https://www.postgresql.org/docs/current/extend.html
[7] https://www.postgresql.org/docs/current/sql-createtype.html
[8] https://www.postgresql.org/docs/current/sql-createoperator.html
[9] https://www.postgresql.org/docs/current/sql-createopclass.html
[10] https://www.postgresql.org/docs/current/sql-createextension.html
[11] https://www.postgresql.org/message-id/20041203184254.F6767@cookie.varlena.com
[12] https://dsf.berkeley.edu/postgres-v4r2/postgres.faq
[13] https://opensource.org/about/history-of-the-open-source-initiative
[14] https://www.gnu.org/press/2001-05-04-GPL.html
[15] https://www.computerhistory.org/timeline/software-languages
[16] https://dev.mysql.com/doc/refman/8.0/en/history.html
[17] https://www.postgresql.org/about/press/faq
[18] https://docs.oracle.com/cd/E17952_01/mysql-8.4-en/mysql-8.4-en.pdf
[19] https://mariadb.org/wp-content/uploads/2019/11/MySQL-MariaDB-story.pdf
[20] https://www.oracle.com/corporate/pressrelease/oracle-buys-sun-042009.html
[21] https://investor.oracle.com/investor-news/news-details/2010/Oracle-Reports-GAAP-EPS-Of-023-Non-GAAP-EPS-Of-038/default.aspx
[22] https://docs.oracle.com/cd/E11882_01/server.112/e40540/intro.htm — Introduction to Oracle Database
[23] https://www.postgresql.org/docs/6.3/c0102.htm — Postgres95 and PostgreSQL history
[24] https://dev.mysql.com/doc/refman/9.2/en/myisam-storage-engine.html — The MyISAM Storage Engine
