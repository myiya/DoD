import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { LOG_DIRECTORY_NAME, LOG_FILE_NAME } from '../constants/app'

type LogLevel = 'INFO' | 'WARN' | 'ERROR'

class LoggerService {
  private ensureLogDirectory(): string {
    const logDirectory = join(app.getPath('userData'), LOG_DIRECTORY_NAME)

    if (!existsSync(logDirectory)) {
      mkdirSync(logDirectory, { recursive: true })
    }

    return logDirectory
  }

  private getLogFilePath(): string {
    return join(this.ensureLogDirectory(), LOG_FILE_NAME)
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
