export type ThemeMode = 'system' | 'light' | 'dark'

export type InteractionMode = 'normal' | 'quiet'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface AppConfig {
  theme: ThemeMode
  petScale: number
  bubbleEnabled: boolean
  interactionMode: InteractionMode
  sfxEnabled: boolean
  sfxVolume: number
  /**
   * 日志级别：默认 INFO。
   * 仅控制落盘（app.log）的写入过滤；开发环境控制台输出不受影响。
   */
  logLevel: LogLevel
  /**
   * 当前启用的用户台词包 ID。
   * - null：回退到内置默认包（builtin）
   */
  activeQuotePackId: string | null
}
