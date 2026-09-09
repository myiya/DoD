import { ipcMain } from 'electron'
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

export const registerLogIpc = (): void => {
  safeHandle('log:clear', () => {
    loggerService.clearLogFile()
  })

  safeHandle('log:openDirectory', async () => {
    await loggerService.openLogDirectory()
  })
}
