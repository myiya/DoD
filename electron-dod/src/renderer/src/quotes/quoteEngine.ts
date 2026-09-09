import type { InteractionEvent } from '../../../shared/types/interaction'
import type { QuoteEntry } from '../../../shared/types/quote'

export interface QuoteEngineOptions {
  /**
   * 全局最短间隔（防刷屏）
   */
  minIntervalMs?: number
}

export interface QuoteEngine {
  /**
   * 根据事件与候选台词库挑一句（可能返回 null）
   */
  pick: (event: InteractionEvent, quotes: QuoteEntry[]) => string | null
  reset: () => void
}

const getWeight = (entry: QuoteEntry): number => {
  if (typeof entry.weight !== 'number' || Number.isNaN(entry.weight) || entry.weight <= 0) return 1
  return Math.min(10, Math.max(0.1, entry.weight))
}

export const createQuoteEngine = (options?: QuoteEngineOptions): QuoteEngine => {
  const minIntervalMs = Math.max(150, options?.minIntervalMs ?? 450)

  let lastSpeakAt = 0
  let lastText = ''
  const cooldownUntilByText = new Map<string, number>()

  const canSpeakNow = (now: number): boolean => now - lastSpeakAt >= minIntervalMs

  const isCoolingDown = (text: string, now: number): boolean => {
    const until = cooldownUntilByText.get(text)
    return typeof until === 'number' && until > now
  }

  const pickWeighted = (items: QuoteEntry[]): QuoteEntry => {
    const total = items.reduce((sum, item) => sum + getWeight(item), 0)
    const r = Math.random() * total
    let acc = 0
    for (const item of items) {
      acc += getWeight(item)
      if (r <= acc) return item
    }
    return items[items.length - 1]
  }

  const pick: QuoteEngine['pick'] = (event, quotes) => {
    // drag 本身高频，默认不出词（避免刷屏）
    if (event.type === 'drag') return null

    const now = Date.now()
    if (!canSpeakNow(now)) return null

    const candidates = quotes.filter((q) => {
      if (q.event !== event.type) return false
      if (q.bodyPart && event.bodyPart && q.bodyPart !== event.bodyPart) return false
      if (q.bodyPart && !event.bodyPart) return false
      if (isCoolingDown(q.text, now)) return false
      return true
    })

    if (candidates.length === 0) return null

    let picked = pickWeighted(candidates)
    if (candidates.length > 1 && picked.text === lastText) {
      // 避免连续重复：最多重抽几次
      for (let i = 0; i < 3; i += 1) {
        const next = pickWeighted(candidates)
        if (next.text !== lastText) {
          picked = next
          break
        }
      }
    }

    lastSpeakAt = now
    lastText = picked.text
    const cooldownMs =
      typeof picked.cooldownMs === 'number' && picked.cooldownMs > 0 ? picked.cooldownMs : 0
    if (cooldownMs > 0) {
      cooldownUntilByText.set(picked.text, now + cooldownMs)
    }

    return picked.text
  }

  return {
    pick,
    reset() {
      lastSpeakAt = 0
      lastText = ''
      cooldownUntilByText.clear()
    }
  }
}
