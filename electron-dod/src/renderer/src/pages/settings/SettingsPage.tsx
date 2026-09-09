import { useEffect, useMemo, useRef, useState } from 'react'
import {
  APP_CONFIG_LIMITS,
  DEFAULT_APP_CONFIG,
  INTERACTION_MODE_OPTIONS,
  THEME_OPTIONS
} from '../../../../shared/constants/config'
import type { AppConfig, InteractionMode, ThemeMode } from '../../../../shared/types/config'
import type { InteractionEvent } from '../../../../shared/types/interaction'
import { PetStage } from '../../pet-runtime/PetStage'
import { createSfxPlayer } from '../../sfx/sfxPlayer'

function SettingsPage(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG)
  const [version, setVersion] = useState('...')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('已连接配置中心')
  const [events, setEvents] = useState<InteractionEvent[]>([])
  const scaleSoundCooldownRef = useRef(0)

  const sfxPlayer = useMemo(() => createSfxPlayer({ volume: DEFAULT_APP_CONFIG.sfxVolume }), [])

  useEffect(() => {
    const loadInitialData = async (): Promise<void> => {
      try {
        setLoading(true)
        setError('')

        const [currentVersion, currentConfig] = await Promise.all([
          window.api.app.getVersion(),
          window.api.config.get()
        ])

        setVersion(currentVersion)
        setConfig(currentConfig)
        setNotice('配置已加载，可以开始调整')
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
    sfxPlayer.setVolume(config.sfxVolume)
  }, [config.sfxVolume, sfxPlayer])

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

  const handleThemeChange = async (value: ThemeMode): Promise<void> => {
    await updateConfig({ theme: value }, `主题已切换为「${value}」`)
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

  const handleReset = async (): Promise<void> => {
    try {
      setSaving(true)
      setError('')
      const nextConfig = await window.api.config.reset()
      setConfig(nextConfig)
      setNotice('已恢复默认配置')
    } catch (resetError) {
      console.error(resetError)
      setError('恢复默认配置失败。')
    } finally {
      setSaving(false)
    }
  }

  const handlePetEvent = (event: InteractionEvent): void => {
    setEvents((prev) => [event, ...prev].slice(0, 16))

    // 在 M2 阶段，用提示语快速确认事件链路是通的
    const part = event.bodyPart ? `·${event.bodyPart}` : ''
    setNotice(`收到事件：${event.type}${part}`)

    if (!config.sfxEnabled) return

    if (event.type === 'tap') {
      sfxPlayer.play('tap')
    }

    if (event.type === 'pet') {
      sfxPlayer.play('pet')
    }

    if (event.type === 'scale') {
      const now = Date.now()
      if (now - scaleSoundCooldownRef.current > 120) {
        scaleSoundCooldownRef.current = now
        sfxPlayer.play('scale')
      }
    }
  }

  return (
    <main className="settings-shell">
      <section className="settings-panel">
        <header className="settings-header">
          <div>
            <p className="settings-kicker">桌宠 DoD · M0→M2</p>
            <h1>最小设置页</h1>
            <p className="settings-subtitle">
              当前页面只负责验证配置链路：`renderer → preload → main → userData/config.json`。
            </p>
          </div>
          <div className="settings-meta">
            <span className="meta-chip">版本 {version}</span>
            <span className={`meta-chip ${loading ? 'is-busy' : ''}`}>
              {loading ? '加载中' : saving ? '保存中' : '已就绪'}
            </span>
          </div>
        </header>

        <section className="summary-card">
          <div>
            <h2>当前状态</h2>
            <p>{notice}</p>
          </div>
          {error ? (
            <p className="feedback error">{error}</p>
          ) : (
            <p className="feedback">配置读写正常。</p>
          )}
        </section>

        <section className="settings-group">
          <div className="group-header">
            <h2>桌宠预览（M2）</h2>
            <p>用于验证 Sprite 渲染与交互事件（tap/pet/drag/scale/idle）。</p>
          </div>

          <div className="pet-row">
            <div className="pet-preview">
              <PetStage scale={config.petScale} onEvent={handlePetEvent} />
              <p className="pet-hint">提示：点一下 / 长按摸摸 / 拖动 / 滚轮缩放（事件记录）。</p>
            </div>

            <div className="pet-log">
              <div className="pet-log-header">
                <h3>事件日志</h3>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={events.length === 0}
                  onClick={() => setEvents([])}
                >
                  清空
                </button>
              </div>
              {events.length === 0 ? (
                <p className="pet-log-empty">还没有事件，去摸摸它。</p>
              ) : (
                <ul>
                  {events.map((item, index) => (
                    <li key={`${item.type}-${item.timestamp}-${index}`}>
                      <span className="log-type">{item.type}</span>
                      {item.bodyPart ? <span className="log-part">{item.bodyPart}</span> : null}
                      <span className="log-time">
                        {new Date(item.timestamp).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="settings-group">
          <div className="group-header">
            <h2>基础配置</h2>
            <p>这些字段会落盘到 `userData/config.json`。</p>
          </div>

          <label className="field">
            <span className="field-label">主题模式</span>
            <select
              value={config.theme}
              disabled={loading || saving}
              onChange={(event) => void handleThemeChange(event.target.value as ThemeMode)}
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">宠物缩放</span>
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

          <label className="field field-checkbox">
            <div>
              <span className="field-label">气泡提示</span>
              <p>后续桌宠对话气泡的总开关。</p>
            </div>
            <input
              type="checkbox"
              checked={config.bubbleEnabled}
              disabled={loading || saving}
              onChange={(event) => void handleBubbleToggle(event.target.checked)}
            />
          </label>

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
              <span className="field-label">音效（轻量）</span>
              <p>默认关闭。开启后仅在关键交互触发短促提示音，尽量不打扰。</p>
            </div>
            <input
              type="checkbox"
              checked={config.sfxEnabled}
              disabled={loading || saving}
              onChange={(event) => void handleSfxToggle(event.target.checked)}
            />
          </label>

          <label className="field">
            <span className="field-label">音效音量</span>
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
        </section>

        <section className="settings-group">
          <div className="group-header">
            <h2>调试动作</h2>
            <p>M0 只保留最小能力，方便确认主进程与渲染进程通信是否稳定。</p>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="ghost-button"
              disabled={loading || saving}
              onClick={() => void handleReset()}
            >
              恢复默认配置
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}

export default SettingsPage
