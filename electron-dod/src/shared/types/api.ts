import type { AppConfig } from './config'

export interface AppApi {
  getVersion: () => Promise<string>
}

export interface ConfigApi {
  get: () => Promise<AppConfig>
  update: (patch: Partial<AppConfig>) => Promise<AppConfig>
  reset: () => Promise<AppConfig>
}

export interface DesktopPetApi {
  app: AppApi
  config: ConfigApi
}
