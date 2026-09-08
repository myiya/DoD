import { app, ipcMain } from 'electron'
import { registerConfigIpc } from './config'

export const registerIpcHandlers = (): void => {
  ipcMain.removeHandler('app:getVersion')
  ipcMain.handle('app:getVersion', () => app.getVersion())

  registerConfigIpc()
}
