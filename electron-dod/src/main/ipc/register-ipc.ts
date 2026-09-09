import { app, ipcMain } from 'electron'
import { registerConfigIpc } from './config'
import { registerLogIpc } from './log'
import { registerPetWindowIpc } from './pet-window'
import { registerQuotePackIpc } from './quote-pack'

export const registerIpcHandlers = (): void => {
  ipcMain.removeHandler('app:getVersion')
  ipcMain.handle('app:getVersion', () => app.getVersion())

  registerConfigIpc()
  registerLogIpc()
  registerPetWindowIpc()
  registerQuotePackIpc()
}
