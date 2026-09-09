import type { QuoteEntry } from '../types/quote'

// 内置默认包：确保“禁用用户包”后仍然离线可玩
export const BUILTIN_QUOTES: QuoteEntry[] = [
  { event: 'tap', text: '嘿嘿～', weight: 2 },
  { event: 'tap', text: '戳戳！' },
  { event: 'tap', text: '你叫我吗？' },

  { event: 'pet', text: '呼噜呼噜…', cooldownMs: 2200 },
  { event: 'pet', text: '好舒服～' },
  { event: 'pet', text: '继续继续' },

  { event: 'dragStart', text: '我飘起来啦' },
  { event: 'dragStart', text: '搬家搬家' },
  { event: 'dragEnd', text: '落地成功' },
  { event: 'dragEnd', text: '我站稳了！' },

  { event: 'scale', text: '变大一点点', cooldownMs: 1200 },
  { event: 'scale', text: '变小一点点', cooldownMs: 1200 },

  { event: 'idle', text: '我先发个呆…', cooldownMs: 5000 },
  { event: 'idle', text: '悄悄待机中', cooldownMs: 5000 },

  { event: 'enter', text: '你来了！', cooldownMs: 1500 },
  { event: 'exit', text: '别走呀', cooldownMs: 1500 }
]
