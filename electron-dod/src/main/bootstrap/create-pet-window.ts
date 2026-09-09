import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'
import { clampPetWindowBounds, petWindowStateService } from '../services/pet-window-state-service'
import { windowState } from '../state/windows'
import { loadRenderer } from './load-renderer'

export const createPetWindow = (): BrowserWindow => {
  const initialState = petWindowStateService.load()
  let allowClose = false

  const petWindow = new BrowserWindow({
    ...initialState.bounds,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    title: '桌宠 DoD（Pet）',
    backgroundColor: '#00000000',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  petWindow.setAlwaysOnTop(true, 'screen-saver')

  // 默认不打扰：不抢焦点
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const applyLocked = (locked: boolean): void => {
    // forward: true 会把鼠标事件透传给下层窗口（用于“穿透”）
    petWindow.setIgnoreMouseEvents(locked, { forward: true })
    windowState.setPetLocked(locked)
  }

  applyLocked(initialState.locked)

  // 防止窗口状态文件/屏幕分辨率变化导致桌宠跑到屏幕外
  const ensureInBounds = (): void => {
    const next = clampPetWindowBounds(petWindow.getBounds())
    petWindow.setBounds(next, false)
    petWindowStateService.save({
      bounds: next,
      locked: windowState.getPetLocked()
    })
  }

  ensureInBounds()

  petWindow.on('ready-to-show', () => {
    petWindow.showInactive()
  })

  app.on('before-quit', () => {
    allowClose = true
  })

  petWindow.on('close', (event) => {
    if (allowClose) return
    event.preventDefault()
    petWindow.hide()
  })

  petWindow.on('move', () => {
    const bounds = petWindow.getBounds()
    petWindowStateService.save({
      bounds,
      locked: windowState.getPetLocked()
    })
  })

  const handleDisplayChange = (): void => {
    ensureInBounds()
  }

  screen.on('display-added', handleDisplayChange)
  screen.on('display-removed', handleDisplayChange)
  screen.on('display-metrics-changed', handleDisplayChange)

  petWindow.on('closed', () => {
    screen.off('display-added', handleDisplayChange)
    screen.off('display-removed', handleDisplayChange)
    screen.off('display-metrics-changed', handleDisplayChange)
    windowState.setPetWindow(null)
  })

  void loadRenderer(petWindow, { mode: 'pet' })

  windowState.setPetWindow(petWindow)

  return petWindow
}
