import { useEffect, useMemo, useRef, useState } from 'react'
import {
  APP_CONFIG_LIMITS,
  DEFAULT_APP_CONFIG,
  INTERACTION_MODE_OPTIONS,
  LOG_LEVEL_OPTIONS
} from '../../../../shared/constants/config'
import type { AppConfig, InteractionMode, LogLevel } from '../../../../shared/types/config'
import type { QuotePackInfo, QuotePackListResult } from '../../../../shared/types/quote-pack'
import { createSfxPlayer } from '../../sfx/sfxPlayer'

type SettingsSectionKey = 'pet' | 'interaction' | 'sfx' | 'quotes' | 'logs' | 'about'

function SettingsPage(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG)
  const [version, setVersion] = useState('...')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('设置已就绪')
  const [petVisible, setPetVisible] = useState(true)
  const [petLocked, setPetLocked] = useState(false)
  const [quotePacks, setQuotePacks] = useState<QuotePackInfo[]>([])
  const [quoteActiveId, setQuoteActiveId] = useState<string | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [quoteDragOver, setQuoteDragOver] = useState(false)
  const quoteFileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('pet')

  const sfxPlayer = useMemo(() => createSfxPlayer({ volume: DEFAULT_APP_CONFIG.sfxVolume }), [])

  useEffect(() => {
    const loadInitialData = async (): Promise<void> => {
      try {
        setLoading(true)
        setError('')

        const [currentVersion, currentConfig, visible, locked, packList] = await Promise.all([
          window.api.app.getVersion(),
          window.api.config.get(),
          window.api.petWindow.isVisible(),
          window.api.petWindow.getLocked(),
          window.api.quotePack.list()
        ])

        setVersion(currentVersion)
        setConfig(currentConfig)
        setPetVisible(visible)
        setPetLocked(locked)
        setQuotePacks(packList.packs)
        setQuoteActiveId(packList.activeId)
        setNotice('设置已就绪')
      } catch (loadError) {
        console.error(loadError)
        setError('加载配置失败，请检查主进程日志。')
      } finally {
        setLoading(false)
      }
    }

    void loadInitialData()
  }, [])

  useEffect(() => {
    const off = window.api.config.onChanged((next) => {
      setConfig(next)
    })
    return () => off()
  }, [])

  useEffect(() => {
    sfxPlayer.setVolume(config.sfxVolume)
  }, [config.sfxVolume, sfxPlayer])

  const refreshPetWindowState = async (): Promise<void> => {
    try {
      const [visible, locked] = await Promise.all([
        window.api.petWindow.isVisible(),
        window.api.petWindow.getLocked()
      ])
      setPetVisible(visible)
      setPetLocked(locked)
    } catch (stateError) {
      console.warn(stateError)
    }
  }

  const updateConfig = async (patch: Partial<AppConfig>, successNotice: string): Promise<void> => {
    try {
      setSaving(true)
      setError('')
      const nextConfig = await window.api.config.update(patch)
      setConfig(nextConfig)
      setNotice(successNotice)
    } catch (updateError) {
      console.error(updateError)
      setError('保存失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }

  const handleScaleChange = async (value: number): Promise<void> => {
    await updateConfig({ petScale: value }, `宠物缩放已更新为 ${value.toFixed(1)}x`)
  }

  const handleBubbleToggle = async (checked: boolean): Promise<void> => {
    await updateConfig({ bubbleEnabled: checked }, checked ? '气泡提示已开启' : '气泡提示已关闭')
  }

  const handleInteractionModeChange = async (value: InteractionMode): Promise<void> => {
    const label = value === 'quiet' ? '安静模式' : '正常模式'
    await updateConfig({ interactionMode: value }, `互动模式已切换为「${label}」`)
  }

  const handleSfxToggle = async (checked: boolean): Promise<void> => {
    // 先在用户手势内“解锁”音频（避免 await IPC 后被判定为非手势触发）
    if (checked) {
      sfxPlayer.play('notice')
    }
    await updateConfig({ sfxEnabled: checked }, checked ? '音效已开启（轻量）' : '音效已关闭')
  }

  const handleSfxVolumeChange = async (value: number): Promise<void> => {
    await updateConfig({ sfxVolume: value }, `音效音量已更新为 ${(value * 100).toFixed(0)}%`)
  }

  const handleTogglePetVisible = async (): Promise<void> => {
    if (petVisible) {
      await window.api.petWindow.hide()
    } else {
      await window.api.petWindow.show()
    }
    await refreshPetWindowState()
  }

  const handleTogglePetLocked = async (): Promise<void> => {
    await window.api.petWindow.setLocked(!petLocked)
    await refreshPetWindowState()
    setNotice(!petLocked ? '桌宠已锁定（穿透）' : '桌宠已解锁（可交互）')
  }

  const applyPackListResult = (result: QuotePackListResult): void => {
    setQuotePacks(result.packs)
    setQuoteActiveId(result.activeId)
    if (result.notice) setNotice(result.notice)
  }

  const withQuoteBusy = async (fn: () => Promise<void>): Promise<void> => {
    try {
      setQuoteBusy(true)
      setQuoteError('')
      await fn()
    } catch (e) {
      console.warn(e)
      setQuoteError('操作失败：请检查台词包格式或主进程日志。')
    } finally {
      setQuoteBusy(false)
    }
  }

  const handleImportClick = (): void => {
    quoteFileInputRef.current?.click()
  }

  const handleImportFile = (filePath: string): void => {
    void withQuoteBusy(async () => {
      const result = await window.api.quotePack.importFromPath(filePath)
      applyPackListResult(result)
    })
  }

  const handleQuoteReload = (): void => {
    void withQuoteBusy(async () => {
      const result = await window.api.quotePack.reload()
      applyPackListResult(result)
    })
  }

  const handleSetActive = (packId: string | null): void => {
    void withQuoteBusy(async () => {
      const result = await window.api.quotePack.setActive(packId)
      applyPackListResult(result)
    })
  }

  const handleDeletePack = (packId: string): void => {
    if (!window.confirm(`确定删除台词包「${packId}」吗？删除后无法恢复。`)) return
    void withQuoteBusy(async () => {
      const result = await window.api.quotePack.delete(packId)
      applyPackListResult(result)
    })
  }

  const handleClearLog = async (): Promise<void> => {
    if (!window.confirm('确定清空日志吗？此操作会清空 app.log 内容。')) return
    try {
      setSaving(true)
      setError('')
      await window.api.log.clear()
      setNotice('日志已清空')
    } catch (e) {
      console.warn(e)
      setError('清空日志失败，请检查主进程日志。')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenLogDir = async (): Promise<void> => {
    try {
      await window.api.log.openDirectory()
    } catch (e) {
      console.warn(e)
      setError('打开日志目录失败，请检查主进程日志。')
    }
  }

  return (
    <main className="settings-shell">
      <section className="settings-panel settings-panel--wide">
        <header className="settings-header settings-header--compact">
          <div>
            <p className="settings-kicker">桌宠 DoD · Settings</p>
            <h1>设置</h1>
            <p className="settings-subtitle">这里是桌宠的真实设置中心。</p>
          </div>
          <div className="settings-meta">
            <span className="meta-chip">版本 {version}</span>
            <span className={`meta-chip ${loading ? 'is-busy' : ''}`}>
              {loading ? '加载中' : saving ? '保存中' : '已就绪'}
            </span>
          </div>
        </header>

        <section className="summary-card summary-card--compact">
          <div>
            <h2>状态</h2>
            <p>{notice}</p>
          </div>
          {error ? (
            <p className="feedback error">{error}</p>
          ) : (
            <p className="feedback">运行正常。</p>
          )}
        </section>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="设置分类">
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'pet' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('pet')}
            >
              桌宠窗口
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'interaction' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('interaction')}
            >
              互动
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'sfx' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('sfx')}
            >
              音效
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'quotes' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('quotes')}
            >
              台词包
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'logs' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('logs')}
            >
              日志
            </button>
            <button
              type="button"
              className={`settings-nav-item ${activeSection === 'about' ? 'is-active' : ''}`}
              onClick={() => setActiveSection('about')}
            >
              关于
            </button>
          </nav>

          <section className="settings-content">
            {activeSection === 'pet' ? (
              <div className="settings-group">
                <div className="group-header">
                  <h2>桌宠窗口</h2>
                  <p>显示/隐藏、锁定穿透、缩放。</p>
                </div>

                <div className="action-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving}
                    onClick={() => void handleTogglePetVisible()}
                  >
                    {petVisible ? '隐藏桌宠' : '显示桌宠'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving}
                    onClick={() => void handleTogglePetLocked()}
                  >
                    {petLocked ? '解锁（可交互）' : '锁定（穿透）'}
                  </button>
                </div>

                <label className="field">
                  <span className="field-label">缩放</span>
                  <div className="range-row">
                    <input
                      type="range"
                      min={APP_CONFIG_LIMITS.minPetScale}
                      max={APP_CONFIG_LIMITS.maxPetScale}
                      step="0.1"
                      value={config.petScale}
                      disabled={loading || saving}
                      onChange={(event) => void handleScaleChange(Number(event.target.value))}
                    />
                    <strong>{config.petScale.toFixed(1)}x</strong>
                  </div>
                </label>
              </div>
            ) : null}

            {activeSection === 'interaction' ? (
              <div className="settings-group">
                <div className="group-header">
                  <h2>互动</h2>
                  <p>控制打扰程度与气泡显示。</p>
                </div>

                <label className="field">
                  <span className="field-label">互动模式</span>
                  <div className="segmented-group">
                    {INTERACTION_MODE_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={option === config.interactionMode ? 'active' : ''}
                        disabled={loading || saving}
                        onClick={() => void handleInteractionModeChange(option)}
                      >
                        {option === 'normal' ? '正常模式' : '安静模式'}
                      </button>
                    ))}
                  </div>
                </label>

                <label className="field field-checkbox">
                  <div>
                    <span className="field-label">气泡提示</span>
                    <p>桌宠说话的总开关。</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.bubbleEnabled}
                    disabled={loading || saving}
                    onChange={(event) => void handleBubbleToggle(event.target.checked)}
                  />
                </label>
              </div>
            ) : null}

            {activeSection === 'sfx' ? (
              <div className="settings-group">
                <div className="group-header">
                  <h2>音效</h2>
                  <p>默认关闭。开启后仅在关键交互触发短促提示音。</p>
                </div>

                <label className="field field-checkbox">
                  <div>
                    <span className="field-label">音效（轻量）</span>
                    <p>开启后会在点击/摸摸/缩放时发出短音效。</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.sfxEnabled}
                    disabled={loading || saving}
                    onChange={(event) => void handleSfxToggle(event.target.checked)}
                  />
                </label>

                <label className="field">
                  <span className="field-label">音量</span>
                  <div className="range-row">
                    <input
                      type="range"
                      min={APP_CONFIG_LIMITS.minSfxVolume}
                      max={APP_CONFIG_LIMITS.maxSfxVolume}
                      step="0.05"
                      value={config.sfxVolume}
                      disabled={loading || saving || !config.sfxEnabled}
                      onChange={(event) => void handleSfxVolumeChange(Number(event.target.value))}
                    />
                    <strong>{(config.sfxVolume * 100).toFixed(0)}%</strong>
                  </div>
                </label>

                <div className="action-row">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving || !config.sfxEnabled}
                    onClick={() => sfxPlayer.play('notice')}
                  >
                    测试音效
                  </button>
                </div>
              </div>
            ) : null}

            {activeSection === 'quotes' ? (
              <div className="settings-group">
                <div className="group-header">
                  <h2>台词包</h2>
                  <p>导入 zip 后即可离线玩：按事件选台词，在桌宠气泡里说出来（单选启用）。</p>
                </div>

                <input
                  ref={quoteFileInputRef}
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const filePath = (file as unknown as { path?: string }).path
                    if (!filePath) {
                      setQuoteError('无法获取文件路径：请用“导入台词包”按钮选择 zip。')
                      return
                    }
                    handleImportFile(filePath)
                    event.currentTarget.value = ''
                  }}
                />

                <div
                  className="dropzone"
                  data-active={quoteDragOver ? 'true' : 'false'}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (!quoteBusy) setQuoteDragOver(true)
                  }}
                  onDragLeave={() => setQuoteDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setQuoteDragOver(false)
                    if (quoteBusy) return
                    const file = event.dataTransfer.files?.[0]
                    if (!file) return
                    const filePath = (file as unknown as { path?: string }).path
                    if (!filePath) {
                      setQuoteError('拖拽导入失败：未拿到文件路径。')
                      return
                    }
                    handleImportFile(filePath)
                  }}
                >
                  <div>
                    <h3>导入台词包</h3>
                    <p>{quoteBusy ? '处理中…' : '拖拽 .zip 到这里导入，或点击下方按钮。'}</p>
                  </div>
                  {quoteError ? <p className="feedback error">{quoteError}</p> : null}
                </div>

                <div className="action-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving || quoteBusy}
                    onClick={handleImportClick}
                  >
                    导入台词包
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving || quoteBusy}
                    onClick={handleQuoteReload}
                  >
                    重载
                  </button>
                  <span className="meta-chip" style={{ marginLeft: 'auto' }}>
                    已启用：{quoteActiveId ?? 'builtin'}
                  </span>
                </div>

                {quotePacks.length === 0 ? (
                  <p className="pet-log-empty">还没有台词包。</p>
                ) : (
                  <ul style={{ marginTop: 12 }}>
                    {quotePacks.map((pack) => {
                      const isBuiltin = Boolean(pack.builtin) || pack.id === 'builtin'
                      const enabled = (quoteActiveId ?? 'builtin') === pack.id
                      return (
                        <li key={pack.id} className="pack-row">
                          <div style={{ minWidth: 0 }}>
                            <div className="pack-row-title">
                              <strong className="pack-row-name">{pack.name}</strong>
                              <span className="meta-chip">v{pack.version}</span>
                              <span className="meta-chip">{enabled ? '启用' : '未启用'}</span>
                              {isBuiltin ? <span className="meta-chip">内置</span> : null}
                            </div>
                            <p style={{ margin: '6px 0 0', opacity: 0.78 }}>
                              id：<code>{pack.id}</code>
                            </p>
                          </div>

                          <div className="pack-row-actions">
                            {!enabled ? (
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={quoteBusy}
                                onClick={() => handleSetActive(pack.id)}
                              >
                                设为启用
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={quoteBusy || isBuiltin}
                                onClick={() => handleSetActive(null)}
                              >
                                禁用（回退内置）
                              </button>
                            )}

                            <button
                              type="button"
                              className="ghost-button"
                              disabled={quoteBusy || isBuiltin}
                              onClick={() => handleDeletePack(pack.id)}
                            >
                              删除
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {activeSection === 'logs' ? (
              <div className="settings-group">
                <div className="group-header">
                  <h2>日志</h2>
                  <p>默认写入日志文件。可设置级别、清空、打开目录。</p>
                </div>

                <label className="field">
                  <span className="field-label">日志级别</span>
                  <select
                    value={config.logLevel}
                    disabled={loading || saving}
                    onChange={(event) =>
                      void updateConfig(
                        { logLevel: event.target.value as LogLevel },
                        `日志级别已设置为 ${event.target.value}`
                      )
                    }
                  >
                    {LOG_LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  <p>说明：仅控制落盘到 app.log 的过滤，开发环境控制台输出不受影响。</p>
                </label>

                <div className="action-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving}
                    onClick={() => void handleClearLog()}
                  >
                    清空日志
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={loading || saving}
                    onClick={() => void handleOpenLogDir()}
                  >
                    打开日志目录
                  </button>
                </div>

                <p className="pet-hint">
                  日志文件：<code>userData/logs/app.log</code>
                </p>
              </div>
            ) : null}

            {activeSection === 'about' ? (
              <div className="settings-group">
                <div className="group-header">
                  <h2>关于</h2>
                  <p>版本信息与基础说明。</p>
                </div>

                <div className="summary-card summary-card--compact">
                  <div>
                    <h2>桌宠 DoD</h2>
                    <p>版本 {version}</p>
                  </div>
                  <p className="feedback">离线可玩：台词包 + 轻量互动。</p>
                </div>

                <div className="summary-card summary-card--compact">
                  <div>
                    <h2>存储位置</h2>
                    <p>
                      配置：<code>userData/config.json</code>
                      <br />
                      日志：<code>userData/logs/app.log</code>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  )
}

export default SettingsPage
