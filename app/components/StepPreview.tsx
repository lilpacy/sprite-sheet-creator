import { useEffect } from "react";
import type { AnimationType, Frame } from "../types";
import type { useAnimationPreview } from "../hooks/useAnimationPreview";
import { downloadImage } from "../lib/image-utils";

interface StepPreviewProps {
  preview: ReturnType<typeof useAnimationPreview>;
  walkFrames: Frame[];
  jumpFrames: Frame[];
  attackFrames: Frame[];
  idleFrames: Frame[];
  pixelSnappedUrls: Record<string, string | null>;
  bgRemovedUrls: Record<string, string | null>;
  onProceedToSandbox: () => void;
  onBack: () => void;
  selectedTypes: Set<AnimationType>;
  previewType: AnimationType;
  setPreviewType: (type: AnimationType) => void;
}

const TYPE_LABELS: Record<AnimationType, string> = {
  walk: "Walk",
  jump: "Jump",
  attack: "Attack",
  idle: "Idle",
};

export default function StepPreview({
  preview,
  walkFrames,
  jumpFrames,
  attackFrames,
  idleFrames,
  pixelSnappedUrls,
  bgRemovedUrls,
  onProceedToSandbox,
  onBack,
  selectedTypes,
  previewType,
  setPreviewType,
}: StepPreviewProps) {
  // Keyboard controls for Step 6
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        preview.setDirection("right");
        if (!preview.isPlaying) preview.setIsPlaying(true);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        preview.setDirection("left");
        if (!preview.isPlaying) preview.setIsPlaying(true);
      } else if (e.key === " ") {
        e.preventDefault();
        preview.setIsPlaying(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.key === "d" ||
        e.key === "D" ||
        e.key === "ArrowRight" ||
        e.key === "a" ||
        e.key === "A" ||
        e.key === "ArrowLeft"
      ) {
        preview.setIsPlaying(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [preview]);

  const allFrameGroups: { label: string; frames: Frame[]; prefix: string; type: AnimationType }[] = [
    { label: "Walk Frames", frames: walkFrames, prefix: "Walk", type: "walk" },
    { label: "Jump Frames", frames: jumpFrames, prefix: "Jump", type: "jump" },
    { label: "Attack Frames", frames: attackFrames, prefix: "Attack", type: "attack" },
    { label: "Idle Frames", frames: idleFrames, prefix: "Idle", type: "idle" },
  ];
  const visibleFrameGroups = allFrameGroups.filter((g) => selectedTypes.has(g.type));

  const exportSheet = (type: string) =>
    downloadImage(
      pixelSnappedUrls[type] || bgRemovedUrls[type],
      `${type}-sprite-sheet.png`,
    );

  const exportAllFrames = () => {
    for (const { frames, type } of visibleFrameGroups) {
      frames.forEach((frame, i) =>
        downloadImage(frame.dataUrl, `${type}-frame-${i + 1}.png`),
      );
    }
  };

  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">6</span>
        Preview & Export
      </h2>

      <p className="description-text">
        Animation preview. Select a type below to preview, or test all in the sandbox!
      </p>

      {/* Animation type selector */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {([...selectedTypes] as AnimationType[]).map((type) => (
          <button
            key={type}
            className={`btn ${previewType === type ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setPreviewType(type)}
          >
            {TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="animation-preview">
        <div className="animation-canvas-container">
          <canvas ref={preview.canvasRef} className="animation-canvas" />
          <div className="direction-indicator">
            {preview.direction === "right"
              ? `→ ${TYPE_LABELS[previewType]} Right`
              : `← ${TYPE_LABELS[previewType]} Left`}
          </div>
        </div>

        <div className="keyboard-hint">
          Hold <kbd>D</kbd> or <kbd>→</kbd> to walk right | Hold <kbd>A</kbd>{" "}
          or <kbd>←</kbd> to walk left | <kbd>Space</kbd> to stop
        </div>

        <div className="animation-controls">
          <button
            className={`btn ${preview.isPlaying ? "btn-secondary" : "btn-primary"}`}
            onClick={() => preview.setIsPlaying(!preview.isPlaying)}
          >
            {preview.isPlaying ? "Stop" : "Play"}
          </button>

          <div className="fps-control">
            <label>FPS: {preview.fps}</label>
            <input
              type="range"
              className="fps-slider"
              min={1}
              max={24}
              value={preview.fps}
              onChange={(e) => preview.setFps(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "1rem",
          margin: "1rem 0",
        }}
      >
        {visibleFrameGroups.map(({ label, frames, prefix, type }) => (
          <div key={prefix}>
            <h4
              style={{
                marginBottom: "0.5rem",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
              }}
            >
              {label}
            </h4>
            <div
              className="frames-preview"
              style={{ margin: 0, justifyContent: "flex-start" }}
            >
              {frames.map((frame, index) => (
                <div
                  key={index}
                  className={`frame-thumb ${type === previewType && preview.currentFrameIndex === index ? "active" : ""}`}
                  onClick={() => {
                    if (type !== previewType) setPreviewType(type);
                    preview.setCurrentFrameIndex(index);
                  }}
                >
                  <img
                    src={frame.dataUrl}
                    alt={`${prefix} ${index + 1}`}
                  />
                  <div className="frame-label">{index + 1}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="export-section">
        <h3 style={{ marginBottom: "0.75rem" }}>Export</h3>
        <div className="export-options">
          {visibleFrameGroups.map(({ prefix, type }) => (
            <button
              key={type}
              className="btn btn-primary"
              onClick={() => exportSheet(type)}
            >
              {prefix} Sheet
            </button>
          ))}
          <button className="btn btn-secondary" onClick={exportAllFrames}>
            All Frames
          </button>
        </div>
      </div>

      <div className="button-group" style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Frame Extraction
        </button>
        <button className="btn btn-success" onClick={onProceedToSandbox}>
          Try in Sandbox →
        </button>
      </div>
    </div>
  );
}
