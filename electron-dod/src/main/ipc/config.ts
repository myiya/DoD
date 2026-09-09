import { BrowserWindow, ipcMain } from 'electron'
import { configService } from '../services/config-service'
import { loggerService } from '../services/logger-service'

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

export const registerConfigIpc = (): void => {
  const broadcastConfig = (config: unknown): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('config:changed', config)
      } catch (error) {
        loggerService.warn('Failed to broadcast config change', error)
      }
    }
  }

  safeHandle('config:get', () => configService.get())
  safeHandle('config:update', (patch) => {
    const config = configService.update(patch)
    broadcastConfig(config)
    return config
  })
  safeHandle('config:reset', () => {
    const config = configService.reset()
    broadcastConfig(config)
    return config
  })
}
