import { useState, useCallback } from "react";
import type { AnimationType } from "../types";
import { readFileAsDataUrl } from "../lib/image-utils";

type SpriteSheetUrls = Record<AnimationType, string | null>;

const EMPTY_URLS: SpriteSheetUrls = {
  walk: null,
  jump: null,
  attack: null,
  idle: null,
};

export function useSpriteSheetGeneration(
  characterImageUrl: string | null,
  setError: (e: string | null) => void,
  onGenerated: () => void,
) {
  const [urls, setUrls] = useState<SpriteSheetUrls>({ ...EMPTY_URLS });
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingType, setRegeneratingType] =
    useState<AnimationType | null>(null);

  const generateAll = useCallback(async (selectedTypes?: Set<AnimationType>) => {
    if (!characterImageUrl) return;

    const types: AnimationType[] = selectedTypes
      ? (["walk", "jump", "attack", "idle"] as AnimationType[]).filter((t) => selectedTypes.has(t))
      : ["walk", "jump", "attack", "idle"];

    setError(null);
    setIsGenerating(true);

    try {
      const responses = await Promise.all(
        types.map((type) =>
          fetch("/api/generate-sprite-sheet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterImageUrl, type }),
          }),
        ),
      );

      const dataArr = await Promise.all(responses.map((r) => r.json()));

      for (let i = 0; i < types.length; i++) {
        if (!responses[i].ok) {
          throw new Error(
            dataArr[i].error ||
              `Failed to generate ${types[i]} sprite sheet`,
          );
        }
      }

      const newUrls: SpriteSheetUrls = { ...EMPTY_URLS };
      types.forEach((type, i) => {
        newUrls[type] = dataArr[i].imageUrl;
      });
      setUrls(newUrls);
      onGenerated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate sprite sheets",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [characterImageUrl, setError, onGenerated]);

  const regenerate = useCallback(
    async (type: AnimationType) => {
      if (!characterImageUrl) return;

      setError(null);
      setRegeneratingType(type);

      try {
        const response = await fetch("/api/generate-sprite-sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterImageUrl, type }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || `Failed to generate ${type} sprite sheet`,
          );
        }

        setUrls((prev) => ({ ...prev, [type]: data.imageUrl }));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to regenerate ${type} sprite sheet`,
        );
      } finally {
        setRegeneratingType(null);
      }
    },
    [characterImageUrl, setError],
  );

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

  return {
    urls,
    isGenerating,
    regeneratingType,
    generateAll,
    regenerate,
    handleUpload,
    reset,
  };
}
