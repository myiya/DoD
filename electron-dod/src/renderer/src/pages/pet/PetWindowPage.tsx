import { useEffect, useMemo, useRef, useState } from 'react'
import {
  APP_CONFIG_LIMITS,
  DEFAULT_APP_CONFIG,
  normalizePetScale
} from '../../../../shared/constants/config'
import type { AppConfig } from '../../../../shared/types/config'
import type { InteractionEvent } from '../../../../shared/types/interaction'
import type { ActiveQuotePackContent } from '../../../../shared/types/quote'
import { PetStage } from '../../pet-runtime/PetStage'
import { createSfxPlayer } from '../../sfx/sfxPlayer'
import { createQuoteEngine } from '../../quotes/quoteEngine'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

function Bubble(props: { text: string; visible: boolean }): React.JSX.Element | null {
  if (!props.visible) return null
  return (
    <div className="pet-bubble" role="status" aria-live="polite">
      {props.text}
    </div>
  )
}

export function PetWindowPage(): React.JSX.Element {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG)
  const [activeQuoteContent, setActiveQuoteContent] = useState<ActiveQuotePackContent>({
    packId: 'builtin',
    quotes: []
  })
  const [bubbleText, setBubbleText] = useState('')
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const bubbleTimerRef = useRef<number | undefined>(undefined)
  const scaleThrottleRef = useRef(0)
  const scaleSoundCooldownRef = useRef(0)
  const sfxPlayerRef = useRef(createSfxPlayer({ volume: DEFAULT_APP_CONFIG.sfxVolume }))
  const quoteEngine = useMemo(() => createQuoteEngine({ minIntervalMs: 520 }), [])

  const quietMode = config.interactionMode === 'quiet'

  useEffect(() => {
    sfxPlayerRef.current.setVolume(config.sfxVolume)
  }, [config.sfxVolume])

  const showBubbleText = (text: string): void => {
    if (!config.bubbleEnabled || quietMode) return
    setBubbleText(text)
    setBubbleVisible(true)
    if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = window.setTimeout(() => setBubbleVisible(false), 1400)
  }

  useEffect(() => {
    document.body.classList.add('pet-mode')
    return () => {
      document.body.classList.remove('pet-mode')
    }
  }, [])

  useEffect(() => {
    const load = async (): Promise<void> => {
      const current = await window.api.config.get()
      setConfig(current)
    }

    void load()

    const off = window.api.config.onChanged((next) => {
      setConfig(next)
    })

    return () => {
      off()
    }
  }, [])

  useEffect(() => {
    const loadQuotes = async (): Promise<void> => {
      try {
        const content = await window.api.quotePack.getActiveQuotes()
        setActiveQuoteContent(content)
      } catch (error) {
        console.warn(error)
      }
    }
    void loadQuotes()
    // 当 activeQuotePackId 变化时刷新（config 由 onChanged 驱动更新）
  }, [config.activeQuotePackId])

  const handlePetEvent = (event: InteractionEvent): void => {
    // 注意：播放必须在“用户手势回调”内同步触发，不能 await IPC 后再播
    if (config.sfxEnabled && !quietMode) {
      if (event.type === 'tap') {
        sfxPlayerRef.current.play('tap')
      }
      if (event.type === 'pet') {
        sfxPlayerRef.current.play('pet')
      }
      if (event.type === 'scale') {
        const now = Date.now()
        if (now - scaleSoundCooldownRef.current > 120) {
          scaleSoundCooldownRef.current = now
          sfxPlayerRef.current.play('scale')
        }
      }
    }

    if (event.type === 'drag' && event.delta) {
      void window.api.petWindow.moveBy(event.delta.x, event.delta.y)
      return
    }

    if (event.type === 'scale' && typeof event.scaleDelta === 'number') {
      const now = Date.now()
      if (now - scaleThrottleRef.current < 80) return
      scaleThrottleRef.current = now

      const step = event.scaleDelta > 0 ? -0.05 : 0.05
      const nextScale = clamp(
        config.petScale + step,
        APP_CONFIG_LIMITS.minPetScale,
        APP_CONFIG_LIMITS.maxPetScale
      )
      const normalized = normalizePetScale(nextScale)
      void window.api.config.update({ petScale: normalized })
    }

    if (!config.bubbleEnabled || quietMode) return

    const text = quoteEngine.pick(event, activeQuoteContent.quotes)
    if (text) {
      showBubbleText(text)
    }
  }

  return (
    <div className="pet-root">
      <PetStage scale={config.petScale} onEvent={handlePetEvent} />
      <Bubble text={bubbleText} visible={bubbleVisible} />
    </div>
  )
}
