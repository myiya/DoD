import type { AppConfig } from './config'

export interface AppApi {
  getVersion: () => Promise<string>
}

export interface ConfigApi {
  get: () => Promise<AppConfig>
  update: (patch: Partial<AppConfig>) => Promise<AppConfig>
  reset: () => Promise<AppConfig>
  onChanged: (listener: (config: AppConfig) => void) => () => void
}

export interface PetWindowApi {
  show: () => Promise<void>
  hide: () => Promise<void>
  isVisible: () => Promise<boolean>
  moveBy: (deltaX: number, deltaY: number) => Promise<void>
  setLocked: (locked: boolean) => Promise<void>
  getLocked: () => Promise<boolean>
}

export interface DesktopPetApi {
  app: AppApi
  config: ConfigApi
  petWindow: PetWindowApi
}
