export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AnimationType = "walk" | "jump" | "attack" | "idle";

export const ANIMATION_TYPES: readonly AnimationType[] = ["walk", "jump", "attack", "idle"] as const;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Frame {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contentBounds: BoundingBox;
}

export interface CustomBackgroundLayers {
  layer1Url: string | null;
  layer2Url: string | null;
  layer3Url: string | null;
}

export interface SpriteSheetDimensions {
  width: number;
  height: number;
}
