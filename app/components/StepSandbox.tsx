import { lazy, Suspense } from "react";
import { FalSpinner } from "./FalLogo";
import type { Frame } from "../types";
import type { useAnimationPreview } from "../hooks/useAnimationPreview";
import type { useSandbox } from "../hooks/useSandbox";

const PixiSandbox = lazy(() => import("./PixiSandbox"));

interface StepSandboxProps {
  preview: ReturnType<typeof useAnimationPreview>;
  sandbox: ReturnType<typeof useSandbox>;
  walkFrames: Frame[];
  jumpFrames: Frame[];
  attackFrames: Frame[];
  idleFrames: Frame[];
  onBack: () => void;
  onStartNew: () => void;
}

export default function StepSandbox({
  preview,
  sandbox,
  walkFrames,
  jumpFrames,
  attackFrames,
  idleFrames,
  onBack,
  onStartNew,
}: StepSandboxProps) {
  return (
    <div className="step-container">
      <h2 className="step-title">
        <span className="step-number">6</span>
        Sandbox
      </h2>

      <p className="description-text">
        Walk, jump, and attack with your character! Use the keyboard to control
        movement.
      </p>

      {/* Background mode tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          className={`btn ${sandbox.backgroundMode === "default" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => sandbox.setBackgroundMode("default")}
        >
          Default Background
        </button>
        <button
          className={`btn ${sandbox.backgroundMode === "custom" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => sandbox.setBackgroundMode("custom")}
        >
          Custom Background
        </button>
      </div>

      {/* Custom background generation UI */}
      {sandbox.backgroundMode === "custom" && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            background: "var(--bg-secondary)",
            borderRadius: "8px",
          }}
        >
          {!sandbox.customBackgroundLayers.layer1Url ? (
            <>
              <p
                style={{
                  marginBottom: "0.75rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                }}
              >
                Generate a custom parallax background that matches your
                character&apos;s world.
              </p>
              <button
                className="btn btn-success"
                onClick={sandbox.generateBackground}
                disabled={sandbox.isGeneratingBackground}
              >
                {sandbox.isGeneratingBackground
                  ? "Generating Background..."
                  : "Generate Custom Background"}
              </button>
              {sandbox.isGeneratingBackground && (
                <div className="loading" style={{ marginTop: "1rem" }}>
                  <FalSpinner />
                  <span className="loading-text">
                    Creating 3-layer parallax background (this may take a
                    moment)...
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <p
                style={{
                  marginBottom: "0.75rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.9rem",
                }}
              >
                Custom background generated! Click on a layer to regenerate just
                that one.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                {([1, 2, 3] as const).map((layerNum) => {
                  const labels = ["Sky", "Mid", "Front"];
                  const layerKey =
                    `layer${layerNum}Url` as keyof typeof sandbox.customBackgroundLayers;
                  return (
                    <div key={layerNum}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--text-tertiary)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Layer {layerNum} ({labels[layerNum - 1]})
                      </div>
                      <img
                        src={sandbox.customBackgroundLayers[layerKey]!}
                        alt={`${labels[layerNum - 1]} layer`}
                        style={{
                          width: "100%",
                          borderRadius: "4px",
                          background: layerNum > 1 ? "#333" : undefined,
                          opacity:
                            sandbox.regeneratingLayer === layerNum ? 0.5 : 1,
                        }}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() =>
                          sandbox.regenerateBackgroundLayer(layerNum)
                        }
                        disabled={
                          sandbox.isGeneratingBackground ||
                          sandbox.regeneratingLayer !== null
                        }
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.5rem",
                          marginTop: "0.25rem",
                          width: "100%",
                        }}
                      >
                        {sandbox.regeneratingLayer === layerNum
                          ? "..."
                          : "Regen"}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                className="btn btn-secondary"
                onClick={sandbox.generateBackground}
                disabled={
                  sandbox.isGeneratingBackground ||
                  sandbox.regeneratingLayer !== null
                }
                style={{ fontSize: "0.85rem" }}
              >
                {sandbox.isGeneratingBackground
                  ? "Regenerating All..."
                  : "Regenerate All Layers"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="sandbox-container">
        <Suspense
          fallback={
            <div className="loading">
              <FalSpinner />
              <span className="loading-text">Loading sandbox...</span>
            </div>
          }
        >
          <PixiSandbox
            walkFrames={walkFrames}
            jumpFrames={jumpFrames}
            attackFrames={attackFrames}
            idleFrames={idleFrames}
            fps={preview.fps}
            characterScale={preview.characterScale}
            customBackgroundLayers={
              sandbox.backgroundMode === "custom"
                ? sandbox.customBackgroundLayers
                : undefined
            }
          />
        </Suspense>
      </div>

      <div className="keyboard-hint" style={{ marginTop: "1rem" }}>
        <kbd>A</kbd>/<kbd>←</kbd> walk left | <kbd>D</kbd>/<kbd>→</kbd> walk
        right | <kbd>W</kbd>/<kbd>↑</kbd> jump | <kbd>J</kbd> attack
      </div>

      <div className="animation-controls" style={{ marginTop: "1rem" }}>
        <div className="fps-control">
          <label>Animation Speed (FPS): {preview.fps}</label>
          <input
            type="range"
            className="fps-slider"
            min={4}
            max={16}
            value={preview.fps}
            onChange={(e) => preview.setFps(parseInt(e.target.value))}
          />
        </div>
        <div className="fps-control">
          <label>Character Size: {preview.characterScale.toFixed(1)}x</label>
          <input
            type="range"
            className="fps-slider"
            min={0.5}
            max={3.0}
            step={0.1}
            value={preview.characterScale}
            onChange={(e) =>
              preview.setCharacterScale(parseFloat(e.target.value))
            }
          />
        </div>
      </div>

      <div className="button-group" style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Preview & Export
        </button>
        <button className="btn btn-secondary" onClick={onStartNew}>
          Start New Sprite
        </button>
      </div>
    </div>
  );
}
