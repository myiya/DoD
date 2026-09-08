import type { DesktopPetApi } from '../shared/types/api'

declare global {
  interface Window {
    api: DesktopPetApi
  }
}
