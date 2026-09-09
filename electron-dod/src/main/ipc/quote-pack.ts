import { ipcMain } from 'electron'
import { loggerService } from '../services/logger-service'
import { quotePackService } from '../services/quote-pack-service'

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

export const registerQuotePackIpc = (): void => {
  safeHandle('quotePack:list', () => quotePackService.list())
  safeHandle('quotePack:reload', () => quotePackService.reload())
  safeHandle('quotePack:getActiveQuotes', () => quotePackService.getActiveQuotes())
  safeHandle('quotePack:setActive', (packId) => {
    const value = packId === null || typeof packId === 'string' ? (packId as string | null) : null
    return quotePackService.setActive(value)
  })
  safeHandle('quotePack:delete', (packId) => {
    if (typeof packId !== 'string' || packId.trim().length === 0) {
      throw new Error('INVALID_PACK_ID')
    }
    return quotePackService.delete(packId)
  })
  safeHandle('quotePack:importFromPath', async (filePath) => {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new Error('INVALID_PATH')
    }
    return await quotePackService.importFromPath(filePath)
  })
}
