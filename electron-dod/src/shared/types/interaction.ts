export type InteractionEventType =
  'tap' | 'pet' | 'dragStart' | 'drag' | 'dragEnd' | 'scale' | 'enter' | 'exit' | 'idle'

export type BodyPart = 'face' | 'head' | 'body' | 'tail' | 'unknown'

export interface Point {
  x: number
  y: number
}

export interface InteractionEvent {
  type: InteractionEventType
  timestamp: number
  bodyPart?: BodyPart
  local?: Point
  screen?: Point
  delta?: Point
  scaleDelta?: number
}
