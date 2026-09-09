import type { AppConfig } from './config'
import type { QuotePackListResult } from './quote-pack'
import type { ActiveQuotePackContent } from './quote'

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

export interface QuotePackApi {
  list: () => Promise<QuotePackListResult>
  reload: () => Promise<QuotePackListResult>
  importFromPath: (filePath: string) => Promise<QuotePackListResult>
  setActive: (packId: string | null) => Promise<QuotePackListResult>
  delete: (packId: string) => Promise<QuotePackListResult>
  getActiveQuotes: () => Promise<ActiveQuotePackContent>
}

export interface LogApi {
  clear: () => Promise<void>
  openDirectory: () => Promise<void>
}

export interface DesktopPetApi {
  app: AppApi
  config: ConfigApi
  petWindow: PetWindowApi
  quotePack: QuotePackApi
  log: LogApi
}
