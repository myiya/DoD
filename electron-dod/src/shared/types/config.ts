export type ThemeMode = 'system' | 'light' | 'dark'

export type InteractionMode = 'normal' | 'quiet'

export interface AppConfig {
  theme: ThemeMode
  petScale: number
  bubbleEnabled: boolean
  interactionMode: InteractionMode
  sfxEnabled: boolean
  sfxVolume: number
}
