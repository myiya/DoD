import { Menu, Tray, nativeImage } from 'electron'
import icon from '../../../resources/icon.png?asset'
import { createMainWindow } from './create-main-window'
import { createPetWindow } from './create-pet-window'
import { windowState } from '../state/windows'
import { petWindowStateService } from '../services/pet-window-state-service'

const getOrCreateMainWindow = (): ReturnType<typeof createMainWindow> => {
  const existing = windowState.getMainWindow()
  if (existing && !existing.isDestroyed()) return existing
  return createMainWindow()
}

const getOrCreatePetWindow = (): ReturnType<typeof createPetWindow> => {
  const existing = windowState.getPetWindow()
  if (existing && !existing.isDestroyed()) return existing
  return createPetWindow()
}

export const createTray = (): Tray => {
  const tray = new Tray(nativeImage.createFromPath(icon))
  tray.setToolTip('桌宠 DoD')

  const rebuildMenu = (): void => {
    const petWindow = getOrCreatePetWindow()
    const locked = windowState.getPetLocked()
    const visible = petWindow.isVisible()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: visible ? '隐藏桌宠' : '显示桌宠',
        click: () => {
          if (petWindow.isVisible()) {
            petWindow.hide()
          } else {
            petWindow.showInactive()
          }
          rebuildMenu()
        }
      },
      {
        label: locked ? '解锁（可交互）' : '锁定（穿透）',
        click: () => {
          const next = !windowState.getPetLocked()
          petWindow.setIgnoreMouseEvents(next, { forward: true })
          windowState.setPetLocked(next)
          petWindowStateService.save({
            bounds: petWindow.getBounds(),
            locked: next
          })
          rebuildMenu()
        }
      },
      { type: 'separator' },
      {
        label: '打开设置',
        click: () => {
          const mainWindow = getOrCreateMainWindow()
          mainWindow.show()
          mainWindow.focus()
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        role: 'quit'
      }
    ])

    tray.setContextMenu(contextMenu)
  }

  tray.on('click', () => {
    const petWindow = getOrCreatePetWindow()
    if (petWindow.isVisible()) {
      petWindow.hide()
    } else {
      petWindow.showInactive()
    }
    rebuildMenu()
  })

  rebuildMenu()
  return tray
}
