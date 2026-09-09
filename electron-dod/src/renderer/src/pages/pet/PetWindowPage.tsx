import { useEffect, useRef, useState } from 'react'
import {
  APP_CONFIG_LIMITS,
  DEFAULT_APP_CONFIG,
  normalizePetScale
} from '../../../../shared/constants/config'
import type { AppConfig } from '../../../../shared/types/config'
import type { InteractionEvent } from '../../../../shared/types/interaction'
import { PetStage } from '../../pet-runtime/PetStage'
import { createSfxPlayer } from '../../sfx/sfxPlayer'

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

const bubbleLines: Record<string, string[]> = {
  tap: ['嘿嘿～', '戳戳！', '你叫我吗？', '在呢在呢', '嗷呜（小声）'],
  pet: ['呼噜呼噜…', '摸摸加一分！', '好舒服～', '继续继续', '我可爱吧？'],
  drag: ['我飘起来啦', '搬家搬家', '抓稳喽～'],
  dragStart: ['我飘起来啦', '搬家搬家', '抓稳喽～'],
  dragEnd: ['好啦就放这儿', '落地成功', '我站稳了！'],
  scale: ['变大一点点', '变小一点点', '我能伸缩自如'],
  idle: ['我先发个呆…', '今天也要快乐', '悄悄待机中'],
  enter: ['你来了！', '欢迎光临～'],
  exit: ['别走呀', '我会想你的']
}

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
  const [bubbleText, setBubbleText] = useState('')
  const [bubbleVisible, setBubbleVisible] = useState(false)
  const bubbleTimerRef = useRef<number | undefined>(undefined)
  const scaleThrottleRef = useRef(0)
  const dragBubbleThrottleRef = useRef(0)
  const scaleSoundCooldownRef = useRef(0)
  const sfxPlayerRef = useRef(createSfxPlayer({ volume: DEFAULT_APP_CONFIG.sfxVolume }))

  const quietMode = config.interactionMode === 'quiet'

  useEffect(() => {
    sfxPlayerRef.current.setVolume(config.sfxVolume)
  }, [config.sfxVolume])

  const showBubble = (eventType: string): void => {
    if (!config.bubbleEnabled || quietMode) return
    const lines = bubbleLines[eventType] ?? bubbleLines.tap
    setBubbleText(pick(lines))
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

    if (event.type === 'dragStart') {
      showBubble('dragStart')
      return
    }

    if (event.type === 'drag' && event.delta) {
      void window.api.petWindow.moveBy(event.delta.x, event.delta.y)
      const now = Date.now()
      if (now - dragBubbleThrottleRef.current > 350) {
        dragBubbleThrottleRef.current = now
        showBubble('drag')
      }
      return
    }

    if (event.type === 'dragEnd') {
      showBubble('dragEnd')
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
      showBubble('scale')
      return
    }

    showBubble(event.type)
  }

  return (
    <div className="pet-root">
      <PetStage scale={config.petScale} onEvent={handlePetEvent} />
      <Bubble text={bubbleText} visible={bubbleVisible} />
    </div>
  )
}
