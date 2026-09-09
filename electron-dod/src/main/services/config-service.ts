import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  DEFAULT_APP_CONFIG,
  normalizeAppConfig,
  normalizeConfigPatch
} from '../../shared/constants/config'
import type { AppConfig } from '../../shared/types/config'
import { CONFIG_FILE_NAME } from '../constants/app'
import { loggerService } from './logger-service'

class ConfigService {
  private ensureConfigDirectory(): void {
    const configDirectory = dirname(this.getConfigPath())
    if (!existsSync(configDirectory)) {
      mkdirSync(configDirectory, { recursive: true })
    }
  }

  getConfigPath(): string {
    return join(app.getPath('userData'), CONFIG_FILE_NAME)
  }

  private writeConfig(config: AppConfig): AppConfig {
    writeFileSync(this.getConfigPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
    return config
  }

  private createDefaultConfig(): AppConfig {
    loggerService.info('Initialize default config file')
    const config = this.writeConfig({ ...DEFAULT_APP_CONFIG })
    loggerService.setLogLevel(config.logLevel)
    return config
  }

  get(): AppConfig {
    this.ensureConfigDirectory()

    if (!existsSync(this.getConfigPath())) {
      return this.createDefaultConfig()
    }

    try {
      const raw = readFileSync(this.getConfigPath(), 'utf-8')
      const parsed = JSON.parse(raw) as unknown
      const normalized = normalizeAppConfig(parsed)

      if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
        this.writeConfig(normalized)
      }

      loggerService.setLogLevel(normalized.logLevel)
      return normalized
    } catch (error) {
      loggerService.error('Failed to read config, fallback to default config', error)
      return this.createDefaultConfig()
    }
  }

  update(patchInput: unknown): AppConfig {
    try {
      const currentConfig = this.get()
      const patch = normalizeConfigPatch(patchInput)
      const nextConfig = normalizeAppConfig(
        {
          ...currentConfig,
          ...patch
        },
        currentConfig
      )

      this.writeConfig(nextConfig)
      loggerService.setLogLevel(nextConfig.logLevel)
      loggerService.info('Config updated successfully', patch)
      return nextConfig
    } catch (error) {
      loggerService.error('Failed to update config', error)
      throw error
    }
  }

  reset(): AppConfig {
    const config = this.writeConfig({ ...DEFAULT_APP_CONFIG })
    loggerService.setLogLevel(config.logLevel)
    loggerService.info('Config reset to default values')
    return config
  }
}

export const configService = new ConfigService()
