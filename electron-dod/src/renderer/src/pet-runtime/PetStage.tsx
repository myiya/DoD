import { useEffect, useRef } from 'react'
import type { InteractionEvent } from '../../../shared/types/interaction'
import { createSpriteRenderer } from './canvas/createSpriteRenderer'
import electronPetUrl from '../assets/electron.svg'

export interface PetStageProps {
  scale: number
  onEvent: (event: InteractionEvent) => void
}

const classifyBodyPart = (
  localX: number,
  localY: number,
  width: number,
  height: number
): InteractionEvent['bodyPart'] => {
  if (width <= 0 || height <= 0) return 'unknown'

  const yRatio = localY / height
  const xRatio = localX / width

  if (yRatio > 0.86) return 'tail'
  if (yRatio < 0.22) return 'face'
  if (yRatio < 0.4) return 'head'
  if (xRatio < 0.18 || xRatio > 0.82) return 'body'
  return 'body'
}

export function PetStage(props: PetStageProps): React.JSX.Element {
  const { scale, onEvent } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const idleTimeoutMs = 8000
  const longPressMs = 520
  const moveThreshold = 4

  const stateRef = useRef({
    pointerDown: false,
    dragging: false,
    longPressTriggered: false,
    startClientX: 0,
    startClientY: 0,
    lastClientX: 0,
    lastClientY: 0,
    idleTimer: 0 as number | undefined,
    longPressTimer: 0 as number | undefined
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const state = stateRef.current
    const renderer = createSpriteRenderer({
      canvas,
      imageUrl: electronPetUrl
    })
    renderer.setScale(scale)

    const scheduleIdle = (): void => {
      if (state.idleTimer) window.clearTimeout(state.idleTimer)
      state.idleTimer = window.setTimeout(() => {
        onEvent({
          type: 'idle',
          timestamp: Date.now()
        })
      }, idleTimeoutMs)
    }

    const emitWithPosition = (
      type: InteractionEvent['type'],
      clientX: number,
      clientY: number,
      extras?: Partial<InteractionEvent>
    ): void => {
      const local = renderer.screenToLocal(clientX, clientY)
      const bounds = renderer.getLocalBounds()
      const bodyPart = classifyBodyPart(local.x, local.y, bounds.width, bounds.height)

      onEvent({
        type,
        timestamp: Date.now(),
        bodyPart,
        local,
        screen: { x: clientX, y: clientY },
        ...extras
      })
    }

    const handlePointerEnter = (event: PointerEvent): void => {
      scheduleIdle()
      emitWithPosition('enter', event.clientX, event.clientY)
    }

    const handlePointerLeave = (event: PointerEvent): void => {
      scheduleIdle()
      emitWithPosition('exit', event.clientX, event.clientY)
    }

    const handlePointerDown = (event: PointerEvent): void => {
      scheduleIdle()
      state.pointerDown = true
      state.dragging = false
      state.longPressTriggered = false
      state.startClientX = event.clientX
      state.startClientY = event.clientY
      state.lastClientX = event.clientX
      state.lastClientY = event.clientY

      if (state.longPressTimer) window.clearTimeout(state.longPressTimer)
      state.longPressTimer = window.setTimeout(() => {
        if (!state.pointerDown || state.dragging) return
        state.longPressTriggered = true
        emitWithPosition('pet', state.startClientX, state.startClientY)
      }, longPressMs)
    }

    const handlePointerMove = (event: PointerEvent): void => {
      scheduleIdle()
      if (!state.pointerDown) return

      const dx = event.clientX - state.startClientX
      const dy = event.clientY - state.startClientY

      if (!state.dragging && Math.hypot(dx, dy) >= moveThreshold) {
        state.dragging = true
      }

      if (state.dragging) {
        emitWithPosition('drag', event.clientX, event.clientY, {
          delta: {
            x: event.clientX - state.lastClientX,
            y: event.clientY - state.lastClientY
          }
        })
      }

      state.lastClientX = event.clientX
      state.lastClientY = event.clientY
    }

    const handlePointerUp = (event: PointerEvent): void => {
      scheduleIdle()
      state.pointerDown = false
      if (state.longPressTimer) window.clearTimeout(state.longPressTimer)

      if (!state.dragging && !state.longPressTriggered) {
        emitWithPosition('tap', event.clientX, event.clientY)
      }

      state.dragging = false
      state.longPressTriggered = false
    }

    const handleWheel = (event: WheelEvent): void => {
      scheduleIdle()
      emitWithPosition('scale', event.clientX, event.clientY, {
        scaleDelta: event.deltaY
      })
    }

    const target = containerRef.current
    if (!target) return

    target.addEventListener('pointerenter', handlePointerEnter)
    target.addEventListener('pointerleave', handlePointerLeave)
    target.addEventListener('pointerdown', handlePointerDown)
    target.addEventListener('pointermove', handlePointerMove)
    target.addEventListener('pointerup', handlePointerUp)
    target.addEventListener('pointercancel', handlePointerUp)
    target.addEventListener('wheel', handleWheel, { passive: true })

    scheduleIdle()

    return () => {
      renderer.dispose()
      if (state.idleTimer) window.clearTimeout(state.idleTimer)
      if (state.longPressTimer) window.clearTimeout(state.longPressTimer)
      target.removeEventListener('pointerenter', handlePointerEnter)
      target.removeEventListener('pointerleave', handlePointerLeave)
      target.removeEventListener('pointerdown', handlePointerDown)
      target.removeEventListener('pointermove', handlePointerMove)
      target.removeEventListener('pointerup', handlePointerUp)
      target.removeEventListener('pointercancel', handlePointerUp)
      target.removeEventListener('wheel', handleWheel)
    }
  }, [idleTimeoutMs, longPressMs, moveThreshold, onEvent, scale])

  return (
    <div className="pet-stage" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  )
}
