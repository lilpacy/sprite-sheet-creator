import { FalSpinner } from "./FalLogo";
import type { AnimationType } from "../types";
import type { usePixelSnap } from "../hooks/usePixelSnap";

interface StepPixelPerfectProps {
  pixelSnap: ReturnType<typeof usePixelSnap>;
  onProceedToFrameExtraction: () => void;
  onBack: () => void;
  selectedTypes: Set<AnimationType>;
}

const SHEET_ITEMS = [
  { label: "Walk Cycle", key: "walk" as const },
  { label: "Jump", key: "jump" as const },
  { label: "Attack", key: "attack" as const },
  { label: "Idle", key: "idle" as const },
];

export default function StepPixelPerfect({
  pixelSnap,
  onProceedToFrameExtraction,
  onBack,
  selectedTypes,
}: StepPixelPerfectProps) {
  const visibleItems = SHEET_ITEMS.filter((item) => selectedTypes.has(item.key));
  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">4</span>
        Pixel Perfect
      </h2>

      <p className="description-text">
        Sprite sheets have been converted to pixel-perfect art. Review the
        results below.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        {visibleItems.map(({ label, key }) => (
          <div key={key}>
            <h4
              style={{
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              {label}
            </h4>
            {pixelSnap.urls[key] && (
              <div className="image-preview" style={{ margin: 0 }}>
                <img
                  src={pixelSnap.urls[key]!}
                  alt={`${label} pixel-snapped`}
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="frame-controls" style={{ marginBottom: "1rem" }}>
        <label htmlFor="kColorsStep4">Colors:</label>
        <select
          id="kColorsStep4"
          value={pixelSnap.kColors}
          onChange={(e) => pixelSnap.setKColors(Number(e.target.value))}
          disabled={pixelSnap.isSnapping}
          style={{
            padding: "0.25rem 0.5rem",
            borderRadius: "4px",
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
          }}
        >
          {[16, 32, 48, 64, 80, 96, 112, 128].map((n) => (
            <option key={n} value={n}>
              {n} colors
            </option>
          ))}
        </select>
        <button
          className="btn btn-secondary"
          onClick={() => pixelSnap.snapAll(selectedTypes)}
          disabled={pixelSnap.isSnapping}
          style={{ marginLeft: "0.5rem" }}
        >
          {pixelSnap.isSnapping ? "Re-snapping..." : "Re-snap"}
        </button>
      </div>

      {pixelSnap.isSnapping && (
        <div className="loading">
          <FalSpinner />
          <span className="loading-text">
            Re-converting with {pixelSnap.kColors} colors...
          </span>
        </div>
      )}

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-success"
          onClick={onProceedToFrameExtraction}
          disabled={pixelSnap.isSnapping}
        >
          Extract Frames →
        </button>
      </div>
    </div>
  );
}
