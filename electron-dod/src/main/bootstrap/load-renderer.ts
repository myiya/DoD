import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { BrowserWindow } from 'electron'

export const loadRenderer = async (
  window: BrowserWindow,
  query: Record<string, string>
): Promise<void> => {
  const searchParams = new URLSearchParams(query)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const baseUrl = process.env['ELECTRON_RENDERER_URL']
    const url = `${baseUrl}?${searchParams.toString()}`
    await window.loadURL(url)
    return
  }

  // production
  const filePath = join(__dirname, '../renderer/index.html')
  // BrowserWindow.loadFile supports query string with "search" option
  await window.loadFile(filePath, { search: searchParams.toString() })
}
