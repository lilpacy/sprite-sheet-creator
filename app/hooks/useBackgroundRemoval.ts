import { useState, useCallback } from "react";
import type { AnimationType, SpriteSheetDimensions } from "../types";
import { readFileAsDataUrl } from "../lib/image-utils";

type BgRemovedUrls = Record<AnimationType, string | null>;

const EMPTY_URLS: BgRemovedUrls = {
  walk: null,
  jump: null,
  attack: null,
  idle: null,
};

export function useBackgroundRemoval(
  spriteSheetUrls: Record<AnimationType, string | null>,
  setError: (e: string | null) => void,
  onRemoved: (dimensions: Record<AnimationType, SpriteSheetDimensions>) => void,
) {
  const [urls, setUrls] = useState<BgRemovedUrls>({ ...EMPTY_URLS });
  const [isRemoving, setIsRemoving] = useState(false);

  const removeAll = useCallback(async (selectedTypes?: Set<AnimationType>) => {
    const types: AnimationType[] = selectedTypes
      ? (["walk", "jump", "attack", "idle"] as AnimationType[]).filter((t) => selectedTypes.has(t))
      : ["walk", "jump", "attack", "idle"];

    if (types.some((t) => !spriteSheetUrls[t])) return;

    setError(null);
    setIsRemoving(true);

    try {
      const responses = await Promise.all(
        types.map((type) =>
          fetch("/api/remove-background", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: spriteSheetUrls[type] }),
          }),
        ),
      );

      const dataArr = await Promise.all(responses.map((r) => r.json()));

      for (let i = 0; i < types.length; i++) {
        if (!responses[i].ok) {
          throw new Error(
            dataArr[i].error ||
              `Failed to remove ${types[i]} background`,
          );
        }
      }

      const newUrls: BgRemovedUrls = { ...EMPTY_URLS };
      const dimensions = {} as Record<AnimationType, SpriteSheetDimensions>;
      types.forEach((type, i) => {
        newUrls[type] = dataArr[i].imageUrl;
        dimensions[type] = { width: dataArr[i].width, height: dataArr[i].height };
      });
      setUrls(newUrls);
      onRemoved(dimensions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove background",
      );
    } finally {
      setIsRemoving(false);
    }
  }, [spriteSheetUrls, setError, onRemoved]);

  const handleUpload = useCallback(
    async (file: File, type: AnimationType) => {
      const dataUrl = await readFileAsDataUrl(file);
      setUrls((prev) => ({ ...prev, [type]: dataUrl }));
    },
    [],
  );

  const reset = useCallback(() => {
    setUrls({ ...EMPTY_URLS });
  }, []);

  return { urls, isRemoving, removeAll, handleUpload, reset };
}
