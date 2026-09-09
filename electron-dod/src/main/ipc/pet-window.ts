import { ipcMain } from 'electron'
import { createPetWindow } from '../bootstrap/create-pet-window'
import { clampPetWindowBounds, petWindowStateService } from '../services/pet-window-state-service'
import { loggerService } from '../services/logger-service'
import { windowState } from '../state/windows'

const getOrCreatePetWindow = (): ReturnType<typeof createPetWindow> => {
  const existing = windowState.getPetWindow()
  if (existing && !existing.isDestroyed()) return existing
  return createPetWindow()
}

const safeHandle = <TResult>(
  channel: string,
  handler: (...args: unknown[]) => TResult | Promise<TResult>
): void => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, async (_, ...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      loggerService.error(`IPC handler failed: ${channel}`, error)
      throw error
    }
  })
}

export const registerPetWindowIpc = (): void => {
  safeHandle('petWindow:show', () => {
    const win = getOrCreatePetWindow()
    win.showInactive()
  })

  safeHandle('petWindow:hide', () => {
    const win = getOrCreatePetWindow()
    win.hide()
  })

  safeHandle('petWindow:isVisible', () => {
    const win = getOrCreatePetWindow()
    return win.isVisible()
  })

  safeHandle('petWindow:moveBy', (deltaX, deltaY) => {
    const win = getOrCreatePetWindow()
    const dx = typeof deltaX === 'number' ? deltaX : 0
    const dy = typeof deltaY === 'number' ? deltaY : 0
    const bounds = win.getBounds()
    const nextBounds = clampPetWindowBounds({
      ...bounds,
      x: Math.round(bounds.x + dx),
      y: Math.round(bounds.y + dy)
    })
    win.setBounds(nextBounds, false)

    petWindowStateService.save({
      bounds: nextBounds,
      locked: windowState.getPetLocked()
    })
  })

  safeHandle('petWindow:setLocked', (locked) => {
    const win = getOrCreatePetWindow()
    const nextLocked = Boolean(locked)
    win.setIgnoreMouseEvents(nextLocked, { forward: true })
    windowState.setPetLocked(nextLocked)
    petWindowStateService.save({
      bounds: win.getBounds(),
      locked: nextLocked
    })
  })

  safeHandle('petWindow:getLocked', () => {
    getOrCreatePetWindow()
    return windowState.getPetLocked()
  })
}
