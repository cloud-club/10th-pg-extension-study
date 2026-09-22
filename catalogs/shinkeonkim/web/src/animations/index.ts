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
import hstoreStorageLayout from './hstore-storage-layout.json'
import hstoreUpdateRewrite from './hstore-update-rewrite.json'
import hstoreGinLookup from './hstore-gin-lookup.json'
import hstoreLostUpdate from './hstore-lost-update.json'
import hstoreRedisPath from './hstore-redis-path.json'
import hstoreOffsetsVsLengths from './hstore-offsets-vs-lengths.json'
import hstoreVsJsonbTypes from './hstore-vs-jsonb-types.json'

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
  'hstore-storage-layout': parseDocumentOrThrow(hstoreStorageLayout),
  'hstore-update-rewrite': parseDocumentOrThrow(hstoreUpdateRewrite),
  'hstore-gin-lookup': parseDocumentOrThrow(hstoreGinLookup),
  'hstore-lost-update': parseDocumentOrThrow(hstoreLostUpdate),
  'hstore-redis-path': parseDocumentOrThrow(hstoreRedisPath),
  'hstore-offsets-vs-lengths': parseDocumentOrThrow(hstoreOffsetsVsLengths),
  'hstore-vs-jsonb-types': parseDocumentOrThrow(hstoreVsJsonbTypes),
} as const

export type AnimationId = keyof typeof ANIMATIONS
