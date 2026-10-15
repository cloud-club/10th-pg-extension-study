// 이 파일은 build.py 가 생성한다. 직접 고치지 말 것.
import { parseDocumentOrThrow } from '@kokoa/clotho'
import cronEventLoop from './cron-event-loop.json'
import cronLifecycle from './cron-lifecycle.json'
import cronConcurrency from './cron-concurrency.json'
import ngramSlice from './ngram-slice.json'
import twoCharTrap from './two-char-trap.json'
import ginPipeline from './gin-pipeline.json'
import lexemeVsNgram from './lexeme-vs-ngram.json'
import btreeVsInverted from './btree-vs-inverted.json'
import ginStructure from './gin-structure.json'
import similarityCompare from './similarity-compare.json'

/** 애니메이션 id → 파싱된 clotho 문서. 새 문서는 build.py 에 등록하면 여기에 자동으로 실린다. */
export const ANIMATIONS = {
  'cron-event-loop': parseDocumentOrThrow(cronEventLoop),
  'cron-lifecycle': parseDocumentOrThrow(cronLifecycle),
  'cron-concurrency': parseDocumentOrThrow(cronConcurrency),
  'ngram-slice': parseDocumentOrThrow(ngramSlice),
  'two-char-trap': parseDocumentOrThrow(twoCharTrap),
  'gin-pipeline': parseDocumentOrThrow(ginPipeline),
  'lexeme-vs-ngram': parseDocumentOrThrow(lexemeVsNgram),
  'btree-vs-inverted': parseDocumentOrThrow(btreeVsInverted),
  'gin-structure': parseDocumentOrThrow(ginStructure),
  'similarity-compare': parseDocumentOrThrow(similarityCompare),
} as const

export type AnimationId = keyof typeof ANIMATIONS
