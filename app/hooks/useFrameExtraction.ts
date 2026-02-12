import { useState, useRef, useCallback, useEffect } from "react";
import type { Frame, SpriteSheetDimensions } from "../types";
import { getContentBounds } from "../lib/image-utils";

interface UseFrameExtractionArgs {
  pixelSnappedUrl: string | null;
  bgRemovedUrl: string | null;
}

export function useFrameExtraction({
  pixelSnappedUrl,
  bgRemovedUrl,
}: UseFrameExtractionArgs) {
  const [gridCols, setGridCols] = useState(2);
  const [gridRows, setGridRows] = useState(2);
  const [verticalDividers, setVerticalDividers] = useState<number[]>([]);
  const [horizontalDividers, setHorizontalDividers] = useState<number[]>([]);
  const [extractedFrames, setExtractedFrames] = useState<Frame[]>([]);
  const [dimensions, setDimensions] = useState<SpriteSheetDimensions>({
    width: 0,
    height: 0,
  });
  const spriteSheetRef = useRef<HTMLImageElement>(null);

  // Initialize divider positions when grid changes
  useEffect(() => {
    if (dimensions.width <= 0) return;

    const vPositions: number[] = [];
    for (let i = 1; i < gridCols; i++) {
      vPositions.push((i / gridCols) * 100);
    }
    setVerticalDividers(vPositions);

    const hPositions: number[] = [];
    for (let i = 1; i < gridRows; i++) {
      hPositions.push((i / gridRows) * 100);
    }
    setHorizontalDividers(hPositions);
  }, [gridCols, gridRows, dimensions.width]);

  // Extract frames from sprite sheet
  const extractFrames = useCallback(() => {
    const srcUrl = pixelSnappedUrl || bgRemovedUrl;
    if (!srcUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const frames: Frame[] = [];
      const colPositions = [0, ...verticalDividers, 100];
      const rowPositions = [0, ...horizontalDividers, 100];

      for (let row = 0; row < rowPositions.length - 1; row++) {
        const startY = Math.round((rowPositions[row] / 100) * img.height);
        const endY = Math.round((rowPositions[row + 1] / 100) * img.height);
        const frameHeight = endY - startY;

        for (let col = 0; col < colPositions.length - 1; col++) {
          const startX = Math.round((colPositions[col] / 100) * img.width);
          const endX = Math.round((colPositions[col + 1] / 100) * img.width);
          const frameWidth = endX - startX;

          const canvas = document.createElement("canvas");
          canvas.width = frameWidth;
          canvas.height = frameHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            ctx.drawImage(
              img,
              startX,
              startY,
              frameWidth,
              frameHeight,
              0,
              0,
              frameWidth,
              frameHeight,
            );
            const contentBounds = getContentBounds(ctx, frameWidth, frameHeight);
            frames.push({
              dataUrl: canvas.toDataURL("image/png"),
              x: startX,
              y: startY,
              width: frameWidth,
              height: frameHeight,
              contentBounds,
            });
          }
        }
      }

      setExtractedFrames(frames);
    };

    img.src = srcUrl;
  }, [pixelSnappedUrl, bgRemovedUrl, verticalDividers, horizontalDividers]);

  // Auto-extract when dependencies change
  useEffect(() => {
    if ((pixelSnappedUrl || bgRemovedUrl) && dimensions.width > 0) {
      extractFrames();
    }
  }, [pixelSnappedUrl, bgRemovedUrl, verticalDividers, horizontalDividers, dimensions, extractFrames]);

  // Generic vertical divider drag handler
  const handleVerticalDividerDrag = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      const imgRect = spriteSheetRef.current?.getBoundingClientRect();
      if (!imgRect) return;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const relativeX = moveEvent.clientX - imgRect.left;
        const percentage = Math.max(
          0,
          Math.min(100, (relativeX / imgRect.width) * 100),
        );

        setVerticalDividers((prev) => {
          const newPos = [...prev];
          const minPos = index > 0 ? newPos[index - 1] + 2 : 2;
          const maxPos =
            index < newPos.length - 1 ? newPos[index + 1] - 2 : 98;
          newPos[index] = Math.max(minPos, Math.min(maxPos, percentage));
          return newPos;
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [],
  );

  // Generic horizontal divider drag handler
  const handleHorizontalDividerDrag = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      const imgRect = spriteSheetRef.current?.getBoundingClientRect();
      if (!imgRect) return;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const relativeY = moveEvent.clientY - imgRect.top;
        const percentage = Math.max(
          0,
          Math.min(100, (relativeY / imgRect.height) * 100),
        );

        setHorizontalDividers((prev) => {
          const newPos = [...prev];
          const minPos = index > 0 ? newPos[index - 1] + 2 : 2;
          const maxPos =
            index < newPos.length - 1 ? newPos[index + 1] - 2 : 98;
          newPos[index] = Math.max(minPos, Math.min(maxPos, percentage));
          return newPos;
        });
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [],
  );

  return {
    gridCols,
    setGridCols,
    gridRows,
    setGridRows,
    verticalDividers,
    horizontalDividers,
    extractedFrames,
    dimensions,
    setDimensions,
    spriteSheetRef,
    handleVerticalDividerDrag,
    handleHorizontalDividerDrag,
  };
}
