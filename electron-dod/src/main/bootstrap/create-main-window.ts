import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'
import { loadRenderer } from './load-renderer'
import { windowState } from '../state/windows'

export const createMainWindow = (options?: { showOnReady?: boolean }): BrowserWindow => {
  const showOnReady = options?.showOnReady ?? true
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 900,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: '桌宠 DoD',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (showOnReady) {
      mainWindow.show()
    }
  })

  mainWindow.on('closed', () => {
    windowState.setMainWindow(null)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  void loadRenderer(mainWindow, { mode: 'settings' })

  windowState.setMainWindow(mainWindow)

  return mainWindow
}
