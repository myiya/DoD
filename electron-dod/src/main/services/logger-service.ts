import { app, shell } from 'electron'
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { LOG_DIRECTORY_NAME, LOG_FILE_NAME } from '../constants/app'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  INFO: 10,
  WARN: 20,
  ERROR: 30
}

class LoggerService {
  private fileLogLevel: LogLevel = 'INFO'

  private ensureLogDirectory(): string {
    const logDirectory = join(app.getPath('userData'), LOG_DIRECTORY_NAME)

    if (!existsSync(logDirectory)) {
      mkdirSync(logDirectory, { recursive: true })
    }

    return logDirectory
  }

  getLogFilePath(): string {
    return join(this.ensureLogDirectory(), LOG_FILE_NAME)
  }

  getLogDirectoryPath(): string {
    return this.ensureLogDirectory()
  }

  setLogLevel(level: LogLevel): void {
    this.fileLogLevel = level
  }

  clearLogFile(): void {
    writeFileSync(this.getLogFilePath(), '', 'utf-8')
  }

  async openLogDirectory(): Promise<void> {
    await shell.openPath(this.getLogDirectoryPath())
  }

  private shouldWriteToFile(level: LogLevel): boolean {
    return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[this.fileLogLevel]
  }

  private write(level: LogLevel, message: string, context?: unknown): void {
    const timestamp = new Date().toISOString()
    const serializedContext =
      context === undefined
        ? ''
        : ` ${typeof context === 'string' ? context : JSON.stringify(context)}`
    const line = `[${timestamp}] [${level}] ${message}${serializedContext}`

    if (!app.isPackaged) {
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](line)
    }

    try {
      // 仅控制落盘（app.log）的写入过滤；开发环境控制台输出不受影响
      if (!this.shouldWriteToFile(level)) return
      appendFileSync(this.getLogFilePath(), `${line}\n`, 'utf-8')
    } catch (error) {
      console.error('[LoggerService] Failed to write log file.', error)
    }
  }

  info(message: string, context?: unknown): void {
    this.write('INFO', message, context)
  }

  warn(message: string, context?: unknown): void {
    this.write('WARN', message, context)
  }

  error(message: string, context?: unknown): void {
    this.write('ERROR', message, context)
  }
}

export const loggerService = new LoggerService()
