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
    reset: () => ipcRenderer.invoke('config:reset'),
    onChanged: (listener): (() => void) => {
      const handler = (_: unknown, config: unknown): void => {
        listener(config as never)
      }

      ipcRenderer.on('config:changed', handler)
      return () => ipcRenderer.off('config:changed', handler)
    }
  },
  petWindow: {
    show: () => ipcRenderer.invoke('petWindow:show'),
    hide: () => ipcRenderer.invoke('petWindow:hide'),
    isVisible: () => ipcRenderer.invoke('petWindow:isVisible'),
    moveBy: (deltaX, deltaY) => ipcRenderer.invoke('petWindow:moveBy', deltaX, deltaY),
    setLocked: (locked) => ipcRenderer.invoke('petWindow:setLocked', locked),
    getLocked: () => ipcRenderer.invoke('petWindow:getLocked')
  },
  quotePack: {
    list: () => ipcRenderer.invoke('quotePack:list'),
    reload: () => ipcRenderer.invoke('quotePack:reload'),
    importFromPath: (filePath) => ipcRenderer.invoke('quotePack:importFromPath', filePath),
    setActive: (packId) => ipcRenderer.invoke('quotePack:setActive', packId),
    delete: (packId) => ipcRenderer.invoke('quotePack:delete', packId),
    getActiveQuotes: () => ipcRenderer.invoke('quotePack:getActiveQuotes')
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
