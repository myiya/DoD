import type { AppConfig, InteractionMode, ThemeMode } from '../types/config'

export const THEME_OPTIONS: ThemeMode[] = ['system', 'light', 'dark']

export const INTERACTION_MODE_OPTIONS: InteractionMode[] = ['normal', 'quiet']

export const DEFAULT_APP_CONFIG: AppConfig = {
  theme: 'system',
  petScale: 1,
  bubbleEnabled: true,
  interactionMode: 'normal'
}

export const APP_CONFIG_LIMITS = {
  minPetScale: 0.6,
  maxPetScale: 1.8
} as const

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isThemeMode = (value: unknown): value is ThemeMode =>
  typeof value === 'string' && THEME_OPTIONS.includes(value as ThemeMode)

const isInteractionMode = (value: unknown): value is InteractionMode =>
  typeof value === 'string' && INTERACTION_MODE_OPTIONS.includes(value as InteractionMode)

const clampPetScale = (value: number): number =>
  Math.min(APP_CONFIG_LIMITS.maxPetScale, Math.max(APP_CONFIG_LIMITS.minPetScale, value))

export const normalizePetScale = (
  value: unknown,
  fallback = DEFAULT_APP_CONFIG.petScale
): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return clampPetScale(value)
}

export const normalizeAppConfig = (
  value: unknown,
  fallback: AppConfig = DEFAULT_APP_CONFIG
): AppConfig => {
  if (!isObject(value)) {
    return { ...fallback }
  }

  return {
    theme: isThemeMode(value.theme) ? value.theme : fallback.theme,
    petScale: normalizePetScale(value.petScale, fallback.petScale),
    bubbleEnabled:
      typeof value.bubbleEnabled === 'boolean' ? value.bubbleEnabled : fallback.bubbleEnabled,
    interactionMode: isInteractionMode(value.interactionMode)
      ? value.interactionMode
      : fallback.interactionMode
  }
}

export const normalizeConfigPatch = (value: unknown): Partial<AppConfig> => {
  if (!isObject(value)) {
    return {}
  }

  const patch: Partial<AppConfig> = {}

  if (isThemeMode(value.theme)) {
    patch.theme = value.theme
  }

  if (typeof value.petScale === 'number' && !Number.isNaN(value.petScale)) {
    patch.petScale = clampPetScale(value.petScale)
  }

  if (typeof value.bubbleEnabled === 'boolean') {
    patch.bubbleEnabled = value.bubbleEnabled
  }

  if (isInteractionMode(value.interactionMode)) {
    patch.interactionMode = value.interactionMode
  }

  return patch
}
