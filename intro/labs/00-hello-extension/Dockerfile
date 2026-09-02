# ---------------------------------------------------------------------------
# Lab 00 - 가장 간단한 Extension 만들기
#
# 여기서는 아무것도 설치하지 않는다. 컴파일러도, PGXS 도, contrib 도 없다.
# 공식 postgres 이미지 그대로다.
#
# Extension 을 만드는 데 정말로 필요한 건 텍스트 파일 두 개뿐이라는 것을
# 보여주는 것이 이 lab 의 목적이다.
# ---------------------------------------------------------------------------
FROM postgres:16-bookworm

LABEL org.opencontainers.image.title="pg-study-lab00"

# ⚠️ 실습 전용 설정입니다. 운영 환경에서는 절대 이렇게 하지 마세요.
#
# extension 디렉토리는 원래 root 소유라 postgres 유저가 쓸 수 없다.
# 이 lab 은 "psql 안에서 파일을 직접 만들어보는" 것이 핵심이라 쓰기를 허용한다.
# 실제로는 root 로 파일을 놓거나(make install), 패키지 매니저가 놓는다.
RUN chmod 777 /usr/share/postgresql/16/extension

ENV POSTGRES_DB=study \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres
