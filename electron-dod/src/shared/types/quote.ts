import type { BodyPart, InteractionEventType } from './interaction'

export interface QuoteEntry {
  event: InteractionEventType
  text: string
  weight?: number
  cooldownMs?: number
  bodyPart?: BodyPart
}

export interface ActiveQuotePackContent {
  /**
   * 'builtin' 或用户导入的 packId
   */
  packId: string
  quotes: QuoteEntry[]
}
