/**
 * week05 페이지가 공유하는 "따라가기" 장치.
 * 처음 PostgreSQL을 보는 사람이 위에서 아래로 읽기만 해도 이어지도록, 개념 페이지는
 *   Summary(핵심 3줄 요약) → Goal(이 페이지가 답할 질문) → 본문 → Deep(접어 둔 심화)
 *   → Quiz(마무리 퀴즈) → Next(다음 페이지와 넘어가는 이유)
 * 순서를 지킨다. 개념 페이지가 아닌 곳(개요·정리·자료)은 Recap(정리 + 다음)으로 끝낸다.
 */
import { useState } from 'react'
import { Callout } from '@/components/layout/Callout'
import { Section } from '@/components/layout/PageHeader'
import { Ref } from '@/components/common/Ref'
import { cn } from '@/lib/utils'

/** 페이지 맨 위: 이 페이지를 다 읽으면 남아야 할 세 문장. 발표에서는 이 상자 하나로 페이지를 소개한다. */
export function Summary({ points }: { points: React.ReactNode[] }) {
  return (
    <div className="mb-6 rounded-xl border border-primary/40 bg-primary/[0.06] px-5 py-4">
      <p className="!mb-2 !mt-0 text-[13px] font-semibold uppercase tracking-wide text-primary">핵심 3줄 요약</p>
      <ol className="!m-0 !list-none !space-y-1.5 !p-0 text-[14.5px] leading-relaxed">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11.5px] font-bold text-primary">{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 페이지 맨 위: 이 페이지가 답할 질문과, 앞에서 무엇을 알고 왔다고 가정하는지. */
export function Goal({ questions, assumes }: { questions: React.ReactNode[]; assumes?: React.ReactNode }) {
  return (
    <Callout kind="info" title="이 페이지에서 답할 질문">
      <ol className="!my-1">{questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
      {assumes && <p className="!mt-2 text-muted-foreground">앞에서 알고 왔다고 가정하는 것: {assumes}</p>}
    </Callout>
  )
}

type NextDef = { to: string; title: string; why: React.ReactNode }

/** 다음 페이지로 넘어가는 이유 한 줄. */
export function Next({ to, title, why }: NextDef) {
  return <p className="mt-8 text-[14.5px]"><strong>다음 →</strong> <Ref to={to}>{title}</Ref>: {why}</p>
}

/** 개념 페이지가 아닌 곳의 맨 아래: 세 줄 정리와 다음 페이지. */
export function Recap({ points, next }: { points: React.ReactNode[]; next?: NextDef }) {
  return <>
    <Callout kind="ok" title="이 페이지 정리">
      <ul className="!my-1">{points.map((p, i) => <li key={i}>{p}</li>)}</ul>
    </Callout>
    {next && <Next {...next} />}
  </>
}

export type QuizItem = {
  q: React.ReactNode
  choices: React.ReactNode[]
  /** 0부터 센 정답 보기 번호 */
  answer: number
  /** 정답을 고른 뒤 보여 줄 풀이. 본문의 어느 절로 돌아가면 되는지도 함께 적는다. */
  why: React.ReactNode
}

const MARK = ['①', '②', '③', '④', '⑤']
/** 정답 위치가 한쪽으로 몰리지 않게 문제마다 보기 순서를 정해진 규칙으로 돌린다(새로고침해도 같은 순서). */
const orderOf = (n: number, qi: number) => Array.from({ length: n }, (_, k) => (k + qi * 3 + 1) % n)

/** 페이지 맨 아래: 보기를 고르면 바로 정답과 풀이가 나온다. 점수는 이 화면에서만 세고 어디에도 저장하지 않는다. */
export function Quiz({ items }: { items: QuizItem[] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => items.map(() => null))
  const answered = picked.filter((p) => p !== null).length
  const score = picked.filter((p, i) => p === items[i].answer).length
  const orders = items.map((it, qi) => orderOf(it.choices.length, qi))
  const pick = (qi: number, ci: number) => setPicked((prev) => prev.map((p, i) => (i === qi && p === null ? ci : p)))

  return (
    <Section id="quiz" title="마무리 퀴즈">
      <p>보기를 하나 고르면 정답과 풀이가 바로 나온다. 틀린 문제는 풀이에 적힌 절로 돌아가 다시 읽는다.</p>
      <div className="not-prose space-y-4">
        {items.map((it, qi) => {
          const p = picked[qi]
          const order = orders[qi]
          const shown = (ci: number) => MARK[order.indexOf(ci)]
          return (
            <div key={qi} className="rounded-xl border border-border bg-card p-4">
              <p className="!mb-3 !mt-0 text-[14.5px] font-semibold leading-relaxed"><span className="mr-1.5 text-primary">Q{qi + 1}.</span>{it.q}</p>
              <div className="grid gap-2">
                {order.map((ci) => {
                  const c = it.choices[ci]
                  const isAnswer = ci === it.answer
                  const state = p === null ? 'idle' : isAnswer ? 'right' : p === ci ? 'wrong' : 'dim'
                  return (
                    <button key={ci} type="button" disabled={p !== null} onClick={() => pick(qi, ci)}
                      className={cn('flex gap-2 rounded-lg border px-3 py-2 text-left text-[14px] leading-relaxed transition-colors',
                        state === 'idle' && 'border-border hover:border-primary/50 hover:bg-primary/[0.05]',
                        state === 'right' && 'border-ok/60 bg-ok/10',
                        state === 'wrong' && 'border-trgm/60 bg-trgm/10',
                        state === 'dim' && 'border-border opacity-60')}>
                      <span className="shrink-0 font-semibold">{shown(ci)}</span><span>{c}</span>
                    </button>
                  )
                })}
              </div>
              {p !== null && (
                <div className={cn('mt-3 rounded-lg px-3 py-2.5 text-[13.5px] leading-relaxed', p === it.answer ? 'bg-ok/[0.08]' : 'bg-trgm/[0.08]')}>
                  <p className={cn('!mb-1 !mt-0 font-semibold', p === it.answer ? 'text-ok' : 'text-trgm')}>
                    {p === it.answer ? '정답' : `오답 — 정답은 ${shown(it.answer)}`}
                  </p>
                  <div className="[&_code]:text-[12.5px]">{it.why}</div>
                </div>
              )}
            </div>
          )
        })}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-[14px]">
          <span>{answered < items.length ? `${items.length}문제 중 ${answered}문제 풀었음` : `${items.length}문제 중 ${score}문제 맞힘`}</span>
          {answered > 0 && (
            <button type="button" onClick={() => setPicked(items.map(() => null))}
              className="ml-auto rounded-md border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground hover:text-foreground">다시 풀기</button>
          )}
        </div>
      </div>
    </Section>
  )
}

/** 처음 읽을 때는 건너뛰어도 흐름이 끊기지 않는 심화 내용. 발표에서는 접어 둔 채 넘어간다. */
export function Deep({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="my-6 rounded-xl border border-border p-4 [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-[15px] font-semibold">
        <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">심화 · 건너뛰어도 됨</span>{title}
      </summary>
      <div className="prose-doc">{children}</div>
    </details>
  )
}

/** 본문 안에서 처음 나오는 용어를 한 줄로 풀어 준다. */
export function Term({ word, children }: { word: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-lg border-l-2 border-primary/50 bg-primary/[0.04] px-3 py-2 text-[13.5px]">
      <strong>{word}</strong> — {children}
    </div>
  )
}
