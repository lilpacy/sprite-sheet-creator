import { useState, useCallback } from "react";

export function useCharacterGeneration(
  setError: (e: string | null) => void,
) {
  const [characterInputMode, setCharacterInputMode] = useState<"text" | "image">("text");
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);

  const generateCharacter = useCallback(async () => {
    if (characterInputMode === "text" && !characterPrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }
    if (characterInputMode === "image" && !inputImageUrl.trim()) {
      setError("Please enter an image URL");
      return;
    }

    setError(null);
    setIsGeneratingCharacter(true);

    try {
      const requestBody =
        characterInputMode === "image"
          ? { imageUrl: inputImageUrl, prompt: characterPrompt || undefined }
          : { prompt: characterPrompt };

      const response = await fetch("/api/generate-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate character");
      }

      setCharacterImageUrl(data.imageUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate character",
      );
    } finally {
      setIsGeneratingCharacter(false);
    }
  }, [characterInputMode, characterPrompt, inputImageUrl, setError]);

  const reset = useCallback(() => {
    setCharacterImageUrl(null);
    setCharacterPrompt("");
    setInputImageUrl("");
    setCharacterInputMode("text");
  }, []);

  return {
    characterInputMode,
    setCharacterInputMode,
    characterPrompt,
    setCharacterPrompt,
    inputImageUrl,
    setInputImageUrl,
    characterImageUrl,
    isGeneratingCharacter,
    generateCharacter,
    reset,
  };
}
