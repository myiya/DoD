import { app, screen } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loggerService } from './logger-service'

export interface PetWindowState {
  bounds: { x: number; y: number; width: number; height: number }
  locked: boolean
}

const STATE_FILE_NAME = 'pet-window-state.json'

export const clampPetWindowBounds = (
  bounds: PetWindowState['bounds']
): PetWindowState['bounds'] => {
  const display = screen.getDisplayMatching(bounds)
  const workArea = display.workArea

  const width = Math.min(Math.max(120, bounds.width), workArea.width)
  const height = Math.min(Math.max(120, bounds.height), workArea.height)

  const minX = workArea.x
  const minY = workArea.y
  const maxX = workArea.x + workArea.width - width
  const maxY = workArea.y + workArea.height - height

  return {
    x: Math.min(maxX, Math.max(minX, bounds.x)),
    y: Math.min(maxY, Math.max(minY, bounds.y)),
    width,
    height
  }
}

const getDefaultBounds = (): PetWindowState['bounds'] => {
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea

  const w = 380
  const h = 380
  const margin = 18

  return clampPetWindowBounds({
    x: workArea.x + workArea.width - w - margin,
    y: workArea.y + workArea.height - h - margin,
    width: w,
    height: h
  })
}

class PetWindowStateService {
  private getStatePath(): string {
    return join(app.getPath('userData'), STATE_FILE_NAME)
  }

  load(): PetWindowState {
    const fallback: PetWindowState = {
      bounds: getDefaultBounds(),
      locked: false
    }

    try {
      const path = this.getStatePath()
      if (!existsSync(path)) return fallback

      const raw = readFileSync(path, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<PetWindowState> | null

      if (!parsed || typeof parsed !== 'object') return fallback

      const bounds =
        parsed.bounds && typeof parsed.bounds === 'object' ? parsed.bounds : fallback.bounds

      const safeBounds = {
        x: typeof bounds.x === 'number' ? bounds.x : fallback.bounds.x,
        y: typeof bounds.y === 'number' ? bounds.y : fallback.bounds.y,
        width: typeof bounds.width === 'number' ? bounds.width : fallback.bounds.width,
        height: typeof bounds.height === 'number' ? bounds.height : fallback.bounds.height
      }

      return {
        bounds: clampPetWindowBounds(safeBounds),
        locked: typeof parsed.locked === 'boolean' ? parsed.locked : fallback.locked
      }
    } catch (error) {
      loggerService.warn('Failed to load pet window state, fallback to default', error)
      return fallback
    }
  }

  save(state: PetWindowState): void {
    try {
      writeFileSync(this.getStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf-8')
    } catch (error) {
      loggerService.warn('Failed to save pet window state', error)
    }
  }
}

export const petWindowStateService = new PetWindowStateService()
