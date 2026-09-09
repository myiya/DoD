type SfxName = 'tap' | 'pet' | 'scale' | 'notice'

export interface SfxPlayerOptions {
  volume: number
}

export interface SfxPlayer {
  setVolume: (volume: number) => void
  play: (name: SfxName) => void
}

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value))

const createEnvelope = (
  ctx: AudioContext,
  gainNode: GainNode,
  baseVolume: number,
  durationMs: number
): void => {
  const now = ctx.currentTime
  const duration = durationMs / 1000

  gainNode.gain.cancelScheduledValues(now)
  gainNode.gain.setValueAtTime(0.0001, now)
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, baseVolume), now + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)
}

export const createSfxPlayer = (options: SfxPlayerOptions): SfxPlayer => {
  // 注意：AudioContext 必须在用户手势后才能播放，所以做成懒初始化
  let context: AudioContext | null = null
  let volume = clamp(options.volume)

  const ensureContext = (): AudioContext | null => {
    try {
      if (!context) {
        context = new AudioContext()
      }

      if (context.state === 'suspended') {
        void context.resume()
      }

      return context
    } catch (error) {
      console.warn('[SFX] AudioContext unavailable', error)
      return null
    }
  }

  const playTone = (freq: number, durationMs: number, type: OscillatorType, gain: number): void => {
    const ctx = ensureContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    createEnvelope(ctx, gainNode, clamp(volume * gain, 0, 1), durationMs)

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000)
  }

  const play = (name: SfxName): void => {
    // 桌宠音效尽量轻：短促、音量小、频段偏高（不打扰）
    switch (name) {
      case 'tap':
        playTone(740, 70, 'triangle', 0.32)
        playTone(1040, 50, 'sine', 0.22)
        break
      case 'pet':
        playTone(520, 120, 'triangle', 0.3)
        playTone(820, 90, 'sine', 0.18)
        break
      case 'scale':
        playTone(900, 55, 'sine', 0.18)
        break
      case 'notice':
        playTone(660, 90, 'sine', 0.14)
        playTone(990, 90, 'sine', 0.12)
        break
      default:
        break
    }
  }

  return {
    setVolume(nextVolume: number) {
      volume = clamp(nextVolume)
    },
    play
  }
}
