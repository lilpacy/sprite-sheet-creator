import { useState, useRef, useEffect } from "react";
import type { Frame } from "../types";

const PREVIEW_SCALE = 6;

export function useAnimationPreview(walkFrames: Frame[]) {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [characterScale, setCharacterScale] = useState(1.0);
  const [direction, setDirection] = useState<"right" | "left">("right");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animation loop (requestAnimationFrame + elapsed-time based)
  useEffect(() => {
    if (!isPlaying || walkFrames.length === 0) return;
    let rafId: number;
    let lastTime = 0;
    const frameDuration = 1000 / fps;

    const tick = (timestamp: number) => {
      if (lastTime === 0) lastTime = timestamp;
      const elapsed = timestamp - lastTime;
      if (elapsed >= frameDuration) {
        lastTime = timestamp - (elapsed % frameDuration);
        setCurrentFrameIndex((prev) => (prev + 1) % walkFrames.length);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, fps, walkFrames.length]);

  // Draw current frame on canvas
  useEffect(() => {
    if (walkFrames.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = walkFrames[currentFrameIndex];
    if (!frame) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * PREVIEW_SCALE;
      canvas.height = img.height * PREVIEW_SCALE;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (direction === "left") {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(img, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
    img.src = frame.dataUrl;
  }, [currentFrameIndex, walkFrames, direction]);

  return {
    currentFrameIndex,
    setCurrentFrameIndex,
    isPlaying,
    setIsPlaying,
    fps,
    setFps,
    characterScale,
    setCharacterScale,
    direction,
    setDirection,
    canvasRef,
  };
}
