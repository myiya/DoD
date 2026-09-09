export interface SpriteRendererOptions {
  canvas: HTMLCanvasElement
  imageUrl: string
  pixelRatio?: number
}

export interface SpriteRenderer {
  setScale: (scale: number) => void
  getLocalBounds: () => { width: number; height: number }
  screenToLocal: (clientX: number, clientY: number) => { x: number; y: number }
  dispose: () => void
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const createSpriteRenderer = (options: SpriteRendererOptions): SpriteRenderer => {
  const { canvas, imageUrl } = options
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context is not available')
  }

  const image = new Image()
  image.src = imageUrl

  const pixelRatio = clamp(options.pixelRatio ?? window.devicePixelRatio ?? 1, 1, 3)
  let scale = 1
  let disposed = false
  let rafId = 0

  // 目标 FPS：30（更接近“桌宠动画”的稳定感）
  const targetFrameMs = 1000 / 30
  let lastFrameTime = 0

  const baseSize = 260
  const state = {
    t: 0,
    localBounds: { width: baseSize, height: baseSize }
  }

  const resize = (): void => {
    const cssSize = baseSize * scale
    canvas.style.width = `${cssSize}px`
    canvas.style.height = `${cssSize}px`
    canvas.width = Math.floor(cssSize * pixelRatio)
    canvas.height = Math.floor(cssSize * pixelRatio)
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    state.localBounds = { width: cssSize, height: cssSize }
  }

  const draw = (time: number): void => {
    if (disposed) return

    if (time - lastFrameTime < targetFrameMs) {
      rafId = window.requestAnimationFrame(draw)
      return
    }

    const dt = lastFrameTime === 0 ? 0 : (time - lastFrameTime) / 1000
    lastFrameTime = time

    state.t += dt

    const { width, height } = state.localBounds
    ctx.clearRect(0, 0, width, height)

    // 简单“呼吸 + 摇摆”，用于验证渲染循环与缩放效果
    const wobble = Math.sin(state.t * 2.2) * 0.06
    const breathe = 1 + Math.sin(state.t * 1.6) * 0.035
    const yFloat = Math.sin(state.t * 1.8) * 10

    const centerX = width / 2
    const centerY = height / 2 + yFloat
    const drawSize = Math.min(width, height) * 0.7 * breathe

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(wobble)
    ctx.translate(-drawSize / 2, -drawSize / 2)

    if (image.complete && image.naturalWidth > 0) {
      ctx.drawImage(image, 0, 0, drawSize, drawSize)
    } else {
      // 图片尚未加载时给个占位
      ctx.fillStyle = 'rgba(148, 163, 184, 0.12)'
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      const r = 18
      ctx.moveTo(r, 0)
      ctx.lineTo(drawSize - r, 0)
      ctx.quadraticCurveTo(drawSize, 0, drawSize, r)
      ctx.lineTo(drawSize, drawSize - r)
      ctx.quadraticCurveTo(drawSize, drawSize, drawSize - r, drawSize)
      ctx.lineTo(r, drawSize)
      ctx.quadraticCurveTo(0, drawSize, 0, drawSize - r)
      ctx.lineTo(0, r)
      ctx.quadraticCurveTo(0, 0, r, 0)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = 'rgba(226, 232, 240, 0.75)'
      ctx.font = '14px ui-sans-serif, system-ui'
      ctx.fillText('loading…', drawSize / 2 - 26, drawSize / 2 + 6)
    }

    ctx.restore()
    rafId = window.requestAnimationFrame(draw)
  }

  const ensureAnimation = (): void => {
    if (rafId) return
    rafId = window.requestAnimationFrame(draw)
  }

  image.addEventListener('load', () => {
    if (disposed) return
    resize()
  })

  resize()
  ensureAnimation()

  return {
    setScale(nextScale: number) {
      scale = clamp(nextScale, 0.5, 2.2)
      resize()
    },
    getLocalBounds() {
      return { ...state.localBounds }
    },
    screenToLocal(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      }
    },
    dispose() {
      disposed = true
      if (rafId) {
        window.cancelAnimationFrame(rafId)
        rafId = 0
      }
    }
  }
}
