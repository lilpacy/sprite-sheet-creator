import type { useFrameExtraction } from "../hooks/useFrameExtraction";

interface FrameExtractorPanelProps {
  label: string;
  extraction: ReturnType<typeof useFrameExtraction>;
  pixelSnappedUrl: string | null;
  bgRemovedUrl: string | null;
}

export default function FrameExtractorPanel({
  label,
  extraction,
  pixelSnappedUrl,
  bgRemovedUrl,
}: FrameExtractorPanelProps) {
  const srcUrl = pixelSnappedUrl || bgRemovedUrl;

  return (
    <>
      <div className="frame-controls">
        <label htmlFor={`${label}-gridCols`}>Columns:</label>
        <input
          id={`${label}-gridCols`}
          type="number"
          className="frame-count-input"
          min={1}
          max={8}
          value={extraction.gridCols}
          onChange={(e) =>
            extraction.setGridCols(
              Math.max(1, Math.min(8, parseInt(e.target.value) || 2)),
            )
          }
        />
        <label
          htmlFor={`${label}-gridRows`}
          style={{ marginLeft: "1rem" }}
        >
          Rows:
        </label>
        <input
          id={`${label}-gridRows`}
          type="number"
          className="frame-count-input"
          min={1}
          max={8}
          value={extraction.gridRows}
          onChange={(e) =>
            extraction.setGridRows(
              Math.max(1, Math.min(8, parseInt(e.target.value) || 2)),
            )
          }
        />
        <span
          style={{
            marginLeft: "1rem",
            color: "var(--text-tertiary)",
            fontSize: "0.875rem",
          }}
        >
          ({extraction.gridCols * extraction.gridRows} frames)
        </span>
      </div>

      {srcUrl && (
        <div className="frame-extractor">
          <div className="sprite-sheet-container">
            <img
              ref={extraction.spriteSheetRef}
              src={srcUrl}
              alt={`${label} sprite sheet`}
              style={{ imageRendering: "pixelated" }}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                extraction.setDimensions({
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                });
              }}
            />
            <div className="divider-overlay">
              {extraction.verticalDividers.map((pos, index) => (
                <div
                  key={`v-${index}`}
                  className="divider-line divider-vertical"
                  style={{ left: `${pos}%` }}
                  onMouseDown={(e) =>
                    extraction.handleVerticalDividerDrag(index, e)
                  }
                />
              ))}
              {extraction.horizontalDividers.map((pos, index) => (
                <div
                  key={`h-${index}`}
                  className="divider-line divider-horizontal"
                  style={{ top: `${pos}%` }}
                  onMouseDown={(e) =>
                    extraction.handleHorizontalDividerDrag(index, e)
                  }
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {extraction.extractedFrames.length > 0 && (
        <div className="frames-preview">
          {extraction.extractedFrames.map((frame, index) => (
            <div key={index} className="frame-thumb">
              <img src={frame.dataUrl} alt={`${label} frame ${index + 1}`} />
              <div className="frame-label">
                {label} {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
