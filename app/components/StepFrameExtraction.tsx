import type { AnimationType } from "../types";
import type { useFrameExtraction } from "../hooks/useFrameExtraction";
import FrameExtractorPanel from "./FrameExtractorPanel";

interface StepFrameExtractionProps {
  activeSheet: AnimationType;
  setActiveSheet: (type: AnimationType) => void;
  extractions: Record<AnimationType, ReturnType<typeof useFrameExtraction>>;
  pixelSnappedUrls: Record<AnimationType, string | null>;
  bgRemovedUrls: Record<AnimationType, string | null>;
  onProceedToSandbox: () => void;
  onBack: () => void;
  selectedTypes: Set<AnimationType>;
}

const TABS: { label: string; type: AnimationType }[] = [
  { label: "Walk Cycle", type: "walk" },
  { label: "Jump", type: "jump" },
  { label: "Attack", type: "attack" },
  { label: "Idle", type: "idle" },
];

export default function StepFrameExtraction({
  activeSheet,
  setActiveSheet,
  extractions,
  pixelSnappedUrls,
  bgRemovedUrls,
  onProceedToSandbox,
  onBack,
  selectedTypes,
}: StepFrameExtractionProps) {
  const visibleTabs = TABS.filter((tab) => selectedTypes.has(tab.type));
  const allExtracted = [...selectedTypes].every(
    (t) => extractions[t].extractedFrames.length > 0,
  );

  // If activeSheet is not in selectedTypes, auto-switch
  const effectiveActiveSheet = selectedTypes.has(activeSheet)
    ? activeSheet
    : visibleTabs[0]?.type ?? "walk";

  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">5</span>
        Extract Frames
      </h2>

      <p className="description-text">
        Drag the dividers to adjust frame boundaries. Purple = columns, pink =
        rows.
      </p>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {visibleTabs.map(({ label, type }) => (
          <button
            key={type}
            className={`btn ${effectiveActiveSheet === type ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveSheet(type)}
          >
            {label}
          </button>
        ))}
      </div>

      <FrameExtractorPanel
        label={TABS.find((t) => t.type === effectiveActiveSheet)!.label}
        extraction={extractions[effectiveActiveSheet]}
        pixelSnappedUrl={pixelSnappedUrls[effectiveActiveSheet]}
        bgRemovedUrl={bgRemovedUrls[effectiveActiveSheet]}
      />

      <div className="button-group">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          className="btn btn-success"
          onClick={onProceedToSandbox}
          disabled={!allExtracted}
        >
          Try in Sandbox →
        </button>
      </div>
    </div>
  );
}
