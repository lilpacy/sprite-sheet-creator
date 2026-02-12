import { FalSpinner } from "./FalLogo";
import type { AnimationType } from "../types";
import type { useSpriteSheetGeneration } from "../hooks/useSpriteSheetGeneration";
import { downloadImage } from "../lib/image-utils";

interface StepSpriteSheetsProps {
  spriteSheets: ReturnType<typeof useSpriteSheetGeneration>;
  isRemovingBg: boolean;
  onRemoveBackground: () => void;
  onBack: () => void;
  selectedTypes: Set<AnimationType>;
}

const SHEET_ITEMS: { label: string; type: AnimationType }[] = [
  { label: "Walk", type: "walk" },
  { label: "Jump", type: "jump" },
  { label: "Attack", type: "attack" },
  { label: "Idle", type: "idle" },
];

export default function StepSpriteSheets({
  spriteSheets,
  isRemovingBg,
  onRemoveBackground,
  onBack,
  selectedTypes,
}: StepSpriteSheetsProps) {
  const visibleItems = SHEET_ITEMS.filter((item) => selectedTypes.has(item.type));
  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">2</span>
        Sprite Sheets Generated
      </h2>

      <p className="description-text">
        Walk, jump, and attack sprite sheets have been generated. If poses
        don&apos;t look right, try regenerating.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        {visibleItems.map(({ label, type }) => (
          <div key={type}>
            <h4
              style={{
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              {label} (4 frames)
            </h4>
            {spriteSheets.urls[type] && (
              <div
                className="image-preview"
                style={{
                  margin: 0,
                  opacity:
                    spriteSheets.regeneratingType === type ? 0.5 : 1,
                }}
              >
                <img
                  src={spriteSheets.urls[type]!}
                  alt={`${label} sprite sheet`}
                />
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "0.25rem",
                marginTop: "0.5rem",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => spriteSheets.regenerate(type)}
                disabled={
                  spriteSheets.isGenerating ||
                  spriteSheets.regeneratingType !== null ||
                  isRemovingBg
                }
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.5rem",
                  flex: 1,
                }}
              >
                {spriteSheets.regeneratingType === type ? "..." : "Regen"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  downloadImage(
                    spriteSheets.urls[type],
                    `${type}-sprite-sheet.png`,
                  )
                }
                disabled={!spriteSheets.urls[type]}
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.5rem",
                  flex: 1,
                }}
              >
                DL
              </button>
              <label
                className="btn btn-secondary"
                style={{
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.5rem",
                  flex: 1,
                  textAlign: "center",
                  cursor: "pointer",
                  margin: 0,
                }}
              >
                Upload
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) spriteSheets.handleUpload(file, type);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {(spriteSheets.isGenerating || spriteSheets.regeneratingType) && (
        <div className="loading">
          <FalSpinner />
          <span className="loading-text">
            {spriteSheets.isGenerating
              ? "Regenerating all sprite sheets..."
              : `Regenerating ${spriteSheets.regeneratingType} sprite sheet...`}
          </span>
        </div>
      )}

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Character
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => spriteSheets.generateAll(selectedTypes)}
          disabled={spriteSheets.isGenerating || isRemovingBg}
        >
          Regenerate All
        </button>
        <button
          className="btn btn-success"
          onClick={onRemoveBackground}
          disabled={
            isRemovingBg ||
            spriteSheets.isGenerating ||
            [...selectedTypes].some((t) => !spriteSheets.urls[t])
          }
        >
          {isRemovingBg
            ? "Removing Backgrounds..."
            : "Remove Backgrounds →"}
        </button>
      </div>

      {isRemovingBg && (
        <div className="loading">
          <FalSpinner />
          <span className="loading-text">
            Removing backgrounds from all sheets...
          </span>
        </div>
      )}
    </div>
  );
}
