import { useState, useCallback } from "react";
import type { CustomBackgroundLayers } from "../types";

const EMPTY_LAYERS: CustomBackgroundLayers = {
  layer1Url: null,
  layer2Url: null,
  layer3Url: null,
};

export function useSandbox(
  characterImageUrl: string | null,
  characterPrompt: string,
  setError: (e: string | null) => void,
) {
  const [backgroundMode, setBackgroundMode] = useState<"default" | "custom">(
    "default",
  );
  const [customBackgroundLayers, setCustomBackgroundLayers] =
    useState<CustomBackgroundLayers>({ ...EMPTY_LAYERS });
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false);
  const [regeneratingLayer, setRegeneratingLayer] = useState<number | null>(
    null,
  );

  const generateBackground = useCallback(async () => {
    if (!characterImageUrl) return;

    setError(null);
    setIsGeneratingBackground(true);

    try {
      const response = await fetch("/api/generate-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterImageUrl,
          characterPrompt: characterPrompt || "pixel art game character",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate background");
      }

      setCustomBackgroundLayers({
        layer1Url: data.layer1Url,
        layer2Url: data.layer2Url,
        layer3Url: data.layer3Url,
      });
      setBackgroundMode("custom");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate background",
      );
    } finally {
      setIsGeneratingBackground(false);
    }
  }, [characterImageUrl, characterPrompt, setError]);

  const regenerateBackgroundLayer = useCallback(
    async (layerNumber: 1 | 2 | 3) => {
      if (
        !characterImageUrl ||
        !characterPrompt ||
        !customBackgroundLayers.layer1Url
      )
        return;

      setError(null);
      setRegeneratingLayer(layerNumber);

      try {
        const response = await fetch("/api/generate-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterImageUrl,
            characterPrompt,
            regenerateLayer: layerNumber,
            existingLayers: customBackgroundLayers,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to regenerate layer");
        }

        setCustomBackgroundLayers({
          layer1Url: data.layer1Url,
          layer2Url: data.layer2Url,
          layer3Url: data.layer3Url,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to regenerate layer",
        );
      } finally {
        setRegeneratingLayer(null);
      }
    },
    [characterImageUrl, characterPrompt, customBackgroundLayers, setError],
  );

  const reset = useCallback(() => {
    setBackgroundMode("default");
    setCustomBackgroundLayers({ ...EMPTY_LAYERS });
  }, []);

  return {
    backgroundMode,
    setBackgroundMode,
    customBackgroundLayers,
    isGeneratingBackground,
    regeneratingLayer,
    generateBackground,
    regenerateBackgroundLayer,
    reset,
  };
}
