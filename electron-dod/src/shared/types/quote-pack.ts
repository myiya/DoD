export interface QuotePackInfo {
  id: string
  name: string
  version: string
  /**
   * true 表示内置默认包（不可删除，不需要导入）。
   */
  builtin?: boolean
  /**
   * Unix timestamp (ms)
   */
  installedAt?: number
}

export interface QuotePackListResult {
  activeId: string | null
  packs: QuotePackInfo[]
  /**
   * 操作提示信息（用于 UI toast/状态栏）
   */
  notice?: string
}
