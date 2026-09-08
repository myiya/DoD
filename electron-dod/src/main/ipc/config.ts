import { ipcMain } from 'electron'
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
  safeHandle('config:get', () => configService.get())
  safeHandle('config:update', (patch) => configService.update(patch))
  safeHandle('config:reset', () => configService.reset())
}
