import type { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null
let petWindow: BrowserWindow | null = null
let petLocked = false

export const windowState = {
  setMainWindow(window: BrowserWindow | null) {
    mainWindow = window
  },
  getMainWindow() {
    return mainWindow
  },
  setPetWindow(window: BrowserWindow | null) {
    petWindow = window
  },
  getPetWindow() {
    return petWindow
  },
  setPetLocked(locked: boolean) {
    petLocked = locked
  },
  getPetLocked() {
    return petLocked
  }
}
