import { contextBridge, ipcRenderer } from 'electron'
import { normalizeConfigPatch } from '../shared/constants/config'
import type { DesktopPetApi } from '../shared/types/api'

const api: DesktopPetApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (patch) => ipcRenderer.invoke('config:update', normalizeConfigPatch(patch)),
    reset: () => ipcRenderer.invoke('config:reset')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
