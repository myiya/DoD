export type ThemeMode = 'system' | 'light' | 'dark'

export type InteractionMode = 'normal' | 'quiet'

export interface AppConfig {
  theme: ThemeMode
  petScale: number
  bubbleEnabled: boolean
  interactionMode: InteractionMode
  sfxEnabled: boolean
  sfxVolume: number
  /**
   * 当前启用的用户台词包 ID。
   * - null：回退到内置默认包（builtin）
   */
  activeQuotePackId: string | null
}
