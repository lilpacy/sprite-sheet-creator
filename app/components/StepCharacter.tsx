import { FalSpinner } from "./FalLogo";
import type { useCharacterGeneration } from "../hooks/useCharacterGeneration";
import type { AnimationType } from "../types";
import { ANIMATION_TYPES } from "../types";

interface StepCharacterProps {
  character: ReturnType<typeof useCharacterGeneration>;
  onGenerateSpriteSheet: () => void;
  isGeneratingSpriteSheet: boolean;
  selectedTypes: Set<AnimationType>;
  setSelectedTypes: (types: Set<AnimationType>) => void;
}

const TYPE_LABELS: Record<AnimationType, string> = {
  walk: "Walk",
  jump: "Jump",
  attack: "Attack",
  idle: "Idle",
};

export default function StepCharacter({
  character,
  onGenerateSpriteSheet,
  isGeneratingSpriteSheet,
  selectedTypes,
  setSelectedTypes,
}: StepCharacterProps) {
  const toggleType = (type: AnimationType) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      if (next.size <= 1) return; // must keep at least 1
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedTypes(next);
  };
  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">1</span>
        Generate Character
      </h2>

      {/* Input mode tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          className={`btn ${character.characterInputMode === "text" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => character.setCharacterInputMode("text")}
        >
          Text Prompt
        </button>
        <button
          className={`btn ${character.characterInputMode === "image" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => character.setCharacterInputMode("image")}
        >
          From Image
        </button>
      </div>

      {character.characterInputMode === "text" ? (
        <div className="input-group">
          <label htmlFor="prompt">Character Prompt</label>
          <textarea
            id="prompt"
            className="text-input"
            rows={3}
            placeholder="Describe your pixel art character (e.g., 'pixel art knight with sword and shield, medieval armor, 32-bit style')"
            value={character.characterPrompt}
            onChange={(e) => character.setCharacterPrompt(e.target.value)}
          />
        </div>
      ) : (
        <>
          <div className="input-group">
            <label>Upload Image</label>
            {!character.inputImageUrl ? (
              <label
                htmlFor="imageUpload"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2rem",
                  border: "2px dashed var(--border-color)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                  background: "var(--bg-secondary)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-color)";
                  e.currentTarget.style.background = "var(--bg-tertiary)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.background = "var(--bg-secondary)";
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: "var(--text-tertiary)", marginBottom: "0.75rem" }}
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                  Click to upload an image
                </span>
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.8rem",
                    marginTop: "0.25rem",
                  }}
                >
                  PNG, JPG, WEBP supported
                </span>
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        character.setInputImageUrl(
                          event.target?.result as string,
                        );
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ display: "none" }}
                />
              </label>
            ) : (
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  padding: "1rem",
                  border: "2px solid var(--border-color)",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                }}
              >
                <img
                  src={character.inputImageUrl}
                  alt="Uploaded preview"
                  style={{
                    maxWidth: "250px",
                    maxHeight: "250px",
                    borderRadius: "4px",
                    display: "block",
                  }}
                />
                <button
                  onClick={() => character.setInputImageUrl("")}
                  style={{
                    position: "absolute",
                    top: "0.5rem",
                    right: "0.5rem",
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "none",
                    background: "var(--bg-primary)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.2rem",
                    lineHeight: 1,
                  }}
                  title="Remove image"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div className="input-group" style={{ marginTop: "1rem" }}>
            <label htmlFor="promptOptional">
              Additional Instructions (optional)
            </label>
            <textarea
              id="promptOptional"
              className="text-input"
              rows={2}
              placeholder="Any additional instructions for the pixel art conversion..."
              value={character.characterPrompt}
              onChange={(e) => character.setCharacterPrompt(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={character.generateCharacter}
          disabled={
            character.isGeneratingCharacter ||
            (character.characterInputMode === "text" &&
              !character.characterPrompt.trim()) ||
            (character.characterInputMode === "image" &&
              !character.inputImageUrl.trim())
          }
        >
          {character.isGeneratingCharacter
            ? "Generating..."
            : character.characterInputMode === "image"
              ? "Convert to Pixel Art"
              : "Generate Character"}
        </button>
      </div>

      {character.isGeneratingCharacter && (
        <div className="loading">
          <FalSpinner />
          <span className="loading-text">
            {character.characterInputMode === "image"
              ? "Converting to pixel art..."
              : "Generating your character..."}
          </span>
        </div>
      )}

      {character.characterImageUrl && (
        <>
          <div className="image-preview">
            <img
              src={character.characterImageUrl}
              alt="Generated character"
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              Animation Types
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {ANIMATION_TYPES.map((type) => (
                <button
                  key={type}
                  className={`btn ${selectedTypes.has(type) ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => toggleType(type)}
                  style={{
                    fontSize: "0.85rem",
                    padding: "0.35rem 0.75rem",
                    opacity: selectedTypes.has(type) ? 1 : 0.5,
                  }}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="button-group">
            <button
              className="btn btn-secondary"
              onClick={character.generateCharacter}
              disabled={character.isGeneratingCharacter}
            >
              Regenerate
            </button>
            <button
              className="btn btn-success"
              onClick={onGenerateSpriteSheet}
              disabled={isGeneratingSpriteSheet}
            >
              {isGeneratingSpriteSheet
                ? "Creating Sprite Sheet..."
                : "Use for Sprite Sheet →"}
            </button>
          </div>

          {isGeneratingSpriteSheet && (
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">Creating sprite sheets...</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
