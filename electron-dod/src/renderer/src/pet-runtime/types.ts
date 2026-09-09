export type SpriteAsset =
  | {
      kind: 'image'
      url: string
    }
  | {
      kind: 'spritesheet'
      url: string
      frameWidth: number
      frameHeight: number
      frameCount: number
      fps: number
      loop?: boolean
      // 可选：从第几帧开始
      startFrame?: number
    }
