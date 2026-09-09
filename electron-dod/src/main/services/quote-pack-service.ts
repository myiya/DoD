import { app, dialog } from 'electron'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
// 说明：
// - 当前仓库的 node_modules 由 pnpm 管理，但本环境里 pnpm lockfile 写入会失败，
//   导致无法新增依赖。
// - 为了不引入新依赖，这里使用项目已存在于 pnpm store 里的 `yauzl`，
//   并通过相对路径直接引用其实现文件（仅用于本地 zip 读取）。
// - 后续若你环境恢复正常（pnpm 可写 lockfile），建议改回 `import * as yauzl from 'yauzl'` 并显式安装依赖。
import * as yauzl from '../../../node_modules/.pnpm/yauzl@2.10.0/node_modules/yauzl/index.js'
import { configService } from './config-service'
import { loggerService } from './logger-service'
import { windowState } from '../state/windows'
import type { QuotePackInfo, QuotePackListResult } from '../../shared/types/quote-pack'
import type { ActiveQuotePackContent, QuoteEntry } from '../../shared/types/quote'
import { BUILTIN_QUOTES } from '../../shared/constants/builtin-quotes'

type QuotePackManifest = {
  schemaVersion: 1
  id: string
  name: string
  version: string | number
  description?: string
}

const BUILTIN_PACK: QuotePackInfo = {
  id: 'builtin',
  name: '内置默认包',
  version: '1',
  builtin: true
}

const PACK_ID_RE = /^[a-z0-9][a-z0-9-_]{1,38}[a-z0-9]$/i

const isSafeZipPath = (fileName: string): boolean => {
  if (!fileName) return false
  if (fileName.includes('\\')) return false
  if (fileName.startsWith('/')) return false
  if (/^[a-zA-Z]:/.test(fileName)) return false
  if (fileName.split('/').some((segment) => segment === '..')) return false
  return true
}

const readStreamToString = (stream: NodeJS.ReadableStream, maxBytes: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    stream.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        stream.removeAllListeners()
        if (
          typeof (stream as NodeJS.ReadableStream & { destroy?: unknown }).destroy === 'function'
        ) {
          ;(stream as NodeJS.ReadableStream & { destroy: (error?: Error) => void }).destroy(
            new Error('FILE_TOO_LARGE')
          )
        } else {
          reject(new Error('FILE_TOO_LARGE'))
        }
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })

const openZip = (zipPath: string): Promise<yauzl.ZipFile> =>
  new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) return reject(error ?? new Error('ZIP_OPEN_FAILED'))
      resolve(zipfile)
    })
  })

const readRequiredFilesFromZip = async (
  zipPath: string,
  options?: { maxEntries?: number; maxFileBytes?: number }
): Promise<{ manifestText: string; quotesText: string }> => {
  const maxEntries = options?.maxEntries ?? 2000
  const maxFileBytes = options?.maxFileBytes ?? 6 * 1024 * 1024

  const zipfile = await openZip(zipPath)

  return await new Promise((resolve, reject) => {
    let entries = 0
    let manifestText: string | null = null
    let quotesText: string | null = null

    const finalize = (): void => {
      try {
        zipfile.close()
      } catch {
        // ignore
      }
    }

    zipfile.on('error', (error) => {
      finalize()
      reject(error)
    })

    zipfile.readEntry()
    zipfile.on('entry', (entry: yauzl.Entry) => {
      entries += 1
      if (entries > maxEntries) {
        finalize()
        reject(new Error('ZIP_TOO_MANY_ENTRIES'))
        return
      }

      if (!isSafeZipPath(entry.fileName)) {
        finalize()
        reject(new Error('ZIP_PATH_TRAVERSAL'))
        return
      }

      // directory
      if (entry.fileName.endsWith('/')) {
        zipfile.readEntry()
        return
      }

      const baseName = entry.fileName.includes('/')
        ? entry.fileName.split('/').pop()
        : entry.fileName
      if (!baseName) {
        zipfile.readEntry()
        return
      }

      if (baseName !== 'manifest.json' && baseName !== 'quotes.jsonl') {
        zipfile.readEntry()
        return
      }

      zipfile.openReadStream(entry, async (error, stream) => {
        if (error || !stream) {
          finalize()
          reject(error ?? new Error('ZIP_READ_STREAM_FAILED'))
          return
        }

        try {
          const text = await readStreamToString(stream, maxFileBytes)
          if (baseName === 'manifest.json') manifestText = text
          if (baseName === 'quotes.jsonl') quotesText = text
        } catch (streamError) {
          finalize()
          reject(streamError)
          return
        }

        if (manifestText && quotesText) {
          finalize()
          resolve({ manifestText, quotesText })
          return
        }

        zipfile.readEntry()
      })
    })

    zipfile.on('end', () => {
      finalize()
      if (!manifestText) return reject(new Error('MANIFEST_MISSING'))
      if (!quotesText) return reject(new Error('QUOTES_MISSING'))
      resolve({ manifestText, quotesText })
    })
  })
}

const normalizeManifest = (raw: unknown): QuotePackManifest => {
  if (typeof raw !== 'object' || raw === null) throw new Error('MANIFEST_INVALID')
  const v = raw as Record<string, unknown>
  if (v.schemaVersion !== 1) throw new Error('MANIFEST_INVALID_SCHEMA')
  if (typeof v.id !== 'string' || !PACK_ID_RE.test(v.id)) throw new Error('MANIFEST_INVALID_ID')
  if (typeof v.name !== 'string' || v.name.trim().length === 0)
    throw new Error('MANIFEST_INVALID_NAME')
  const versionValue = v.version
  if (typeof versionValue !== 'string' && typeof versionValue !== 'number') {
    throw new Error('MANIFEST_INVALID_VERSION')
  }
  return {
    schemaVersion: 1,
    id: v.id,
    name: v.name,
    version: String(versionValue),
    description: typeof v.description === 'string' ? v.description : undefined
  }
}

const ALLOWED_EVENTS = new Set([
  'tap',
  'pet',
  'dragStart',
  'drag',
  'dragEnd',
  'scale',
  'idle',
  'enter',
  'exit'
])

const ALLOWED_BODYPARTS = new Set(['face', 'head', 'body', 'tail', 'unknown'])

const normalizeQuotesJsonl = (text: string): string => {
  const maxLines = 2000
  const maxLineBytes = 2048
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) throw new Error('QUOTES_EMPTY')
  if (lines.length > maxLines) throw new Error('QUOTES_TOO_MANY_LINES')

  const normalized: string[] = []
  for (const line of lines) {
    if (Buffer.byteLength(line, 'utf-8') > maxLineBytes) {
      throw new Error('QUOTES_LINE_TOO_LONG')
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      throw new Error('QUOTES_INVALID_LINE')
    }
    if (typeof parsed !== 'object' || parsed === null) throw new Error('QUOTES_INVALID_LINE')
    const v = parsed as Record<string, unknown>
    if (typeof v.text !== 'string' || v.text.trim().length === 0)
      throw new Error('QUOTES_INVALID_TEXT')
    if (typeof v.event !== 'string' || !ALLOWED_EVENTS.has(v.event))
      throw new Error('QUOTES_INVALID_EVENT')

    if (
      v.weight !== undefined &&
      (typeof v.weight !== 'number' || Number.isNaN(v.weight) || v.weight <= 0)
    ) {
      throw new Error('QUOTES_INVALID_WEIGHT')
    }
    if (
      v.cooldownMs !== undefined &&
      (typeof v.cooldownMs !== 'number' || Number.isNaN(v.cooldownMs) || v.cooldownMs < 0)
    ) {
      throw new Error('QUOTES_INVALID_COOLDOWN')
    }
    if (
      v.bodyPart !== undefined &&
      (typeof v.bodyPart !== 'string' || !ALLOWED_BODYPARTS.has(v.bodyPart))
    ) {
      throw new Error('QUOTES_INVALID_BODYPART')
    }

    normalized.push(JSON.stringify(v))
  }

  return `${normalized.join('\n')}\n`
}

const parseQuotesJsonl = (text: string): QuoteEntry[] => {
  const normalizedText = normalizeQuotesJsonl(text)
  return normalizedText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as QuoteEntry)
}

class QuotePackService {
  private getRootDir(): string {
    return join(app.getPath('userData'), 'packs', 'quotes')
  }

  private ensureRootDir(): void {
    const dir = this.getRootDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  private getPackDir(packId: string): string {
    return join(this.getRootDir(), packId)
  }

  private listInstalledPacks(): QuotePackInfo[] {
    this.ensureRootDir()
    const root = this.getRootDir()
    const packs: QuotePackInfo[] = []

    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(root, entry.name)
      const manifestPath = join(dir, 'manifest.json')
      if (!existsSync(manifestPath)) continue
      try {
        const manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown
        const manifest = normalizeManifest(manifestRaw)
        packs.push({
          id: manifest.id,
          name: manifest.name,
          version: String(manifest.version),
          installedAt: statSync(dir).mtimeMs
        })
      } catch (error) {
        loggerService.warn(`Skip invalid quote pack: ${entry.name}`, error)
      }
    }

    // stable order: newest first (optional)
    packs.sort((a, b) => (b.installedAt ?? 0) - (a.installedAt ?? 0))
    return packs
  }

  list(): QuotePackListResult {
    const installed = this.listInstalledPacks()
    const config = configService.get()
    const activeId = installed.some((p) => p.id === config.activeQuotePackId)
      ? config.activeQuotePackId
      : null

    if (activeId !== config.activeQuotePackId) {
      // 修正脏配置：指向不存在的包时回退 builtin
      try {
        configService.update({ activeQuotePackId: null })
      } catch (error) {
        loggerService.warn('Failed to repair activeQuotePackId', error)
      }
    }

    return {
      activeId,
      packs: [BUILTIN_PACK, ...installed]
    }
  }

  reload(): QuotePackListResult {
    return this.list()
  }

  getActiveQuotes(): ActiveQuotePackContent {
    const config = configService.get()
    const activeId = config.activeQuotePackId
    if (!activeId) {
      return { packId: 'builtin', quotes: BUILTIN_QUOTES }
    }

    try {
      const packDir = this.getPackDir(activeId)
      const quotesPath = join(packDir, 'quotes.jsonl')
      if (!existsSync(quotesPath)) {
        throw new Error('QUOTES_MISSING')
      }
      const text = readFileSync(quotesPath, 'utf-8')
      const quotes = parseQuotesJsonl(text)
      return { packId: activeId, quotes }
    } catch (error) {
      loggerService.warn('Failed to load active quote pack, fallback to builtin', error)
      try {
        configService.update({ activeQuotePackId: null })
      } catch (repairError) {
        loggerService.warn('Failed to repair activeQuotePackId', repairError)
      }
      return { packId: 'builtin', quotes: BUILTIN_QUOTES }
    }
  }

  setActive(packId: string | null): QuotePackListResult {
    const normalized = packId === 'builtin' ? null : packId
    const installed = this.listInstalledPacks()
    if (normalized !== null && !installed.some((p) => p.id === normalized)) {
      throw new Error('PACK_NOT_FOUND')
    }

    configService.update({ activeQuotePackId: normalized })
    return {
      ...this.list(),
      notice: normalized ? `已启用：${normalized}` : '已回退到内置默认包'
    }
  }

  delete(packId: string): QuotePackListResult {
    if (packId === 'builtin') throw new Error('CANNOT_DELETE_BUILTIN')
    this.ensureRootDir()
    const dir = this.getPackDir(packId)
    if (!existsSync(dir)) throw new Error('PACK_NOT_FOUND')

    rmSync(dir, { recursive: true, force: true })

    const config = configService.get()
    if (config.activeQuotePackId === packId) {
      configService.update({ activeQuotePackId: null })
    }

    return {
      ...this.list(),
      notice: `已删除：${packId}`
    }
  }

  async importFromPath(zipPath: string): Promise<QuotePackListResult> {
    if (typeof zipPath !== 'string' || zipPath.trim().length === 0) {
      throw new Error('INVALID_PATH')
    }
    if (!existsSync(zipPath)) throw new Error('FILE_NOT_FOUND')

    const size = statSync(zipPath).size
    const maxZipBytes = 30 * 1024 * 1024
    if (size > maxZipBytes) throw new Error('ZIP_TOO_LARGE')

    const { manifestText, quotesText } = await readRequiredFilesFromZip(zipPath)
    const manifest = normalizeManifest(JSON.parse(manifestText) as unknown)
    const normalizedQuotes = normalizeQuotesJsonl(quotesText)

    this.ensureRootDir()
    const packDir = this.getPackDir(manifest.id)

    if (existsSync(packDir)) {
      const parent = windowState.getMainWindow()
      const result = parent
        ? await dialog.showMessageBox(parent, {
            type: 'warning',
            message: `台词包「${manifest.name}」（${manifest.id}）已存在，是否覆盖？`,
            detail: '选择“覆盖”会替换旧包内容；选择“取消”不会做任何改动。',
            buttons: ['覆盖', '取消'],
            defaultId: 1,
            cancelId: 1
          })
        : await dialog.showMessageBox({
            type: 'warning',
            message: `台词包「${manifest.name}」（${manifest.id}）已存在，是否覆盖？`,
            detail: '选择“覆盖”会替换旧包内容；选择“取消”不会做任何改动。',
            buttons: ['覆盖', '取消'],
            defaultId: 1,
            cancelId: 1
          })
      if (result.response !== 0) {
        return { ...this.list(), notice: '已取消覆盖' }
      }
      rmSync(packDir, { recursive: true, force: true })
    }

    mkdirSync(packDir, { recursive: true })
    writeFileSync(join(packDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')
    writeFileSync(join(packDir, 'quotes.jsonl'), normalizedQuotes, 'utf-8')

    const config = configService.get()
    let notice = `已导入：${manifest.name}`
    if (config.activeQuotePackId === null) {
      configService.update({ activeQuotePackId: manifest.id })
      notice = `已导入并设为启用：${manifest.name}`
    }

    return { ...this.list(), notice }
  }
}

export const quotePackService = new QuotePackService()
