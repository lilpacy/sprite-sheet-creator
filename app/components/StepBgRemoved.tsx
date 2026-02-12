import { FalSpinner } from "./FalLogo";
import type { AnimationType } from "../types";
import type { useBackgroundRemoval } from "../hooks/useBackgroundRemoval";
import type { usePixelSnap } from "../hooks/usePixelSnap";
import { downloadImage } from "../lib/image-utils";

interface StepBgRemovedProps {
  bgRemoval: ReturnType<typeof useBackgroundRemoval>;
  pixelSnap: ReturnType<typeof usePixelSnap>;
  onBack: () => void;
  selectedTypes: Set<AnimationType>;
}

const SHEET_ITEMS: { label: string; type: AnimationType }[] = [
  { label: "Walk Cycle", type: "walk" },
  { label: "Jump", type: "jump" },
  { label: "Attack", type: "attack" },
  { label: "Idle", type: "idle" },
];

export default function StepBgRemoved({
  bgRemoval,
  pixelSnap,
  onBack,
  selectedTypes,
}: StepBgRemovedProps) {
  const visibleItems = SHEET_ITEMS.filter((item) => selectedTypes.has(item.type));
  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">3</span>
        Backgrounds Removed
      </h2>

      <p className="description-text">
        Backgrounds have been removed. Now let&apos;s extract the individual
        frames.
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
              {label}
            </h4>
            {bgRemoval.urls[type] && (
              <div className="image-preview" style={{ margin: 0 }}>
                <img
                  src={bgRemoval.urls[type]!}
                  alt={`${label} sprite sheet with background removed`}
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
                onClick={() =>
                  downloadImage(
                    bgRemoval.urls[type],
                    `${type}-bg-removed.png`,
                  )
                }
                disabled={!bgRemoval.urls[type]}
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
                    if (file) bgRemoval.handleUpload(file, type);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="frame-controls" style={{ marginBottom: "1rem" }}>
        <label htmlFor="kColors">Colors:</label>
        <select
          id="kColors"
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
      </div>

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-success"
          onClick={() => pixelSnap.snapAll(selectedTypes)}
          disabled={
            pixelSnap.isSnapping ||
            [...selectedTypes].some((t) => !bgRemoval.urls[t])
          }
        >
          {pixelSnap.isSnapping ? "Pixel Snapping..." : "Pixel Snap →"}
        </button>
      </div>

      {pixelSnap.isSnapping && (
        <div className="loading">
          <FalSpinner />
          <span className="loading-text">
            Converting to pixel-perfect art...
          </span>
        </div>
      )}
    </div>
  );
}
