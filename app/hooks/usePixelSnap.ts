import { useState, useCallback } from "react";
import type { AnimationType, SpriteSheetDimensions } from "../types";
import { pixelSnapFromUrl } from "../../lib/pixel-snapper";

type PixelSnappedUrls = Record<AnimationType, string | null>;

const EMPTY_URLS: PixelSnappedUrls = {
  walk: null,
  jump: null,
  attack: null,
  idle: null,
};

export function usePixelSnap(
  bgRemovedUrls: Record<AnimationType, string | null>,
  setError: (e: string | null) => void,
  onSnapped: (dimensions: Record<AnimationType, SpriteSheetDimensions>) => void,
) {
  const [urls, setUrls] = useState<PixelSnappedUrls>({ ...EMPTY_URLS });
  const [isSnapping, setIsSnapping] = useState(false);
  const [kColors, setKColors] = useState(16);

  const snapAll = useCallback(async (selectedTypes?: Set<AnimationType>) => {
    const types: AnimationType[] = selectedTypes
      ? (["walk", "jump", "attack", "idle"] as AnimationType[]).filter((t) => selectedTypes.has(t))
      : ["walk", "jump", "attack", "idle"];

    if (types.some((t) => !bgRemovedUrls[t])) return;

    setError(null);
    setIsSnapping(true);

    try {
      const snapConfig = { kColors };
      const results = await Promise.all(
        types.map((type) =>
          pixelSnapFromUrl(bgRemovedUrls[type]!, snapConfig),
        ),
      );

      const newUrls: PixelSnappedUrls = { ...EMPTY_URLS };
      const dimensions = {} as Record<AnimationType, SpriteSheetDimensions>;
      types.forEach((type, i) => {
        newUrls[type] = results[i].dataUrl;
        dimensions[type] = { width: results[i].width, height: results[i].height };
      });
      setUrls(newUrls);
      onSnapped(dimensions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pixel snap");
    } finally {
      setIsSnapping(false);
    }
  }, [bgRemovedUrls, kColors, setError, onSnapped]);

  const reset = useCallback(() => {
    setUrls({ ...EMPTY_URLS });
  }, []);

  return { urls, isSnapping, kColors, setKColors, snapAll, reset };
}
