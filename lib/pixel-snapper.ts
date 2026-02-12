export interface PixelSnapperConfig {
  kColors: number;
  kSeed: number;
  maxKmeansIterations: number;
  peakThresholdMultiplier: number;
  peakDistanceFilter: number;
  walkerSearchWindowRatio: number;
  walkerMinSearchWindow: number;
  walkerStrengthThreshold: number;
  minCutsPerAxis: number;
  fallbackTargetSegments: number;
  maxStepRatio: number;
}

const DEFAULT_CONFIG: PixelSnapperConfig = {
  kColors: 16,
  kSeed: 42,
  maxKmeansIterations: 15,
  peakThresholdMultiplier: 0.2,
  peakDistanceFilter: 4,
  walkerSearchWindowRatio: 0.35,
  walkerMinSearchWindow: 2.0,
  walkerStrengthThreshold: 0.5,
  minCutsPerAxis: 4,
  fallbackTargetSegments: 64,
  maxStepRatio: 1.8,
};

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${name} must be a positive integer`);
  }
}

function ensureProcessableDimensions(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new Error("Image dimensions must be positive");
  }
  if (width < 3 || height < 3) {
    throw new Error("Image must be at least 3x3 pixels");
  }
}

function compareRgba(a: number[], b: number[]): number {
  for (let i = 0; i < 4; i++) {
    const diff = a[i] - b[i];
    if (diff !== 0) return diff;
  }
  return 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleIndex(rng: () => number, upper: number): number {
  return Math.floor(rng() * upper);
}

function weightedSample(rng: () => number, weights: Float32Array): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  if (total <= 0) return sampleIndex(rng, weights.length);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function distSq(p: number[], c: number[]): number {
  const dr = p[0] - c[0];
  const dg = p[1] - c[1];
  const db = p[2] - c[2];
  return dr * dr + dg * dg + db * db;
}

function getPixel(data: Uint8ClampedArray, w: number, x: number, y: number): number[] {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

// Stage 1: Color Quantization (k-means++)
function quantizeImage(
  imgData: ImageData,
  config: PixelSnapperConfig,
): ImageData {
  const { width, height, data } = imgData;
  const totalPixels = width * height;

  // Collect opaque pixels as [R, G, B]
  const opaquePixels: number[][] = [];
  for (let i = 0; i < totalPixels; i++) {
    if (data[i * 4 + 3] !== 0) {
      opaquePixels.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
    }
  }
  if (opaquePixels.length === 0) return imgData;

  const nPixels = opaquePixels.length;
  const k = Math.min(config.kColors, nPixels);
  const rng = mulberry32(config.kSeed);

  // k-means++ initialization
  const centroids: number[][] = [];
  centroids.push([...opaquePixels[sampleIndex(rng, nPixels)]]);
  const distances = new Float32Array(nPixels).fill(Infinity);

  for (let c = 1; c < k; c++) {
    const lastC = centroids[centroids.length - 1];
    let sumSqDist = 0;
    for (let i = 0; i < nPixels; i++) {
      const d = distSq(opaquePixels[i], lastC);
      if (d < distances[i]) distances[i] = d;
      sumSqDist += distances[i];
    }
    if (sumSqDist <= 0) {
      centroids.push([...opaquePixels[sampleIndex(rng, nPixels)]]);
    } else {
      const idx = weightedSample(rng, distances);
      centroids.push([...opaquePixels[idx]]);
    }
  }

  // k-means iterations
  const prevCentroids = centroids.map((c) => [...c]);
  for (let iter = 0; iter < config.maxKmeansIterations; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0]);
    const counts = new Array(k).fill(0);

    for (let i = 0; i < nPixels; i++) {
      let minD = Infinity;
      let bestK = 0;
      for (let j = 0; j < k; j++) {
        const d = distSq(opaquePixels[i], centroids[j]);
        if (d < minD) { minD = d; bestK = j; }
      }
      sums[bestK][0] += opaquePixels[i][0];
      sums[bestK][1] += opaquePixels[i][1];
      sums[bestK][2] += opaquePixels[i][2];
      counts[bestK]++;
    }

    for (let j = 0; j < k; j++) {
      if (counts[j] > 0) {
        centroids[j][0] = sums[j][0] / counts[j];
        centroids[j][1] = sums[j][1] / counts[j];
        centroids[j][2] = sums[j][2] / counts[j];
      }
    }

    if (iter > 0) {
      let maxMovement = 0;
      for (let j = 0; j < k; j++) {
        const m = distSq(centroids[j], prevCentroids[j]);
        if (m > maxMovement) maxMovement = m;
      }
      if (maxMovement < 0.01) break;
    }
    for (let j = 0; j < k; j++) {
      prevCentroids[j][0] = centroids[j][0];
      prevCentroids[j][1] = centroids[j][1];
      prevCentroids[j][2] = centroids[j][2];
    }
  }

  // Apply quantized colors
  const newData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    if (data[idx + 3] === 0) {
      newData[idx] = data[idx];
      newData[idx + 1] = data[idx + 1];
      newData[idx + 2] = data[idx + 2];
      newData[idx + 3] = data[idx + 3];
      continue;
    }
    const p = [data[idx], data[idx + 1], data[idx + 2]];
    let minD = Infinity;
    let bestC = p;
    for (const c of centroids) {
      const d = distSq(p, c);
      if (d < minD) {
        minD = d;
        bestC = [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
      }
    }
    newData[idx] = bestC[0];
    newData[idx + 1] = bestC[1];
    newData[idx + 2] = bestC[2];
    newData[idx + 3] = data[idx + 3];
  }
  return new ImageData(newData, width, height);
}

// Stage 2: Edge Profile Computation
function computeProfiles(imgData: ImageData): { colProfile: number[]; rowProfile: number[] } {
  const { width: w, height: h, data } = imgData;

  const gray = (x: number, y: number): number => {
    const i = (y * w + x) * 4;
    if (data[i + 3] === 0) return 0;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  const colProfile = new Array(w).fill(0);
  const rowProfile = new Array(h).fill(0);

  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      const grad = Math.abs(gray(x + 1, y) - gray(x - 1, y));
      colProfile[x] += grad;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 1; y < h - 1; y++) {
      const grad = Math.abs(gray(x, y + 1) - gray(x, y - 1));
      rowProfile[y] += grad;
    }
  }
  return { colProfile, rowProfile };
}

// Stage 3: Grid Step Size Estimation
function estimateStepSize(profile: number[], config: PixelSnapperConfig): number | null {
  if (profile.length === 0) return null;

  let maxVal = -Infinity;
  for (const v of profile) if (v > maxVal) maxVal = v;
  if (maxVal === 0) return null;

  const threshold = maxVal * config.peakThresholdMultiplier;
  const peaks: number[] = [];
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i] > threshold && profile[i] > profile[i - 1] && profile[i] > profile[i + 1]) {
      peaks.push(i);
    }
  }
  if (peaks.length < 2) return null;

  const cleanPeaks = [peaks[0]];
  for (let i = 1; i < peaks.length; i++) {
    if (peaks[i] - cleanPeaks[cleanPeaks.length - 1] > config.peakDistanceFilter - 1) {
      cleanPeaks.push(peaks[i]);
    }
  }
  if (cleanPeaks.length < 2) return null;

  const diffs: number[] = [];
  for (let i = 1; i < cleanPeaks.length; i++) {
    diffs.push(cleanPeaks[i] - cleanPeaks[i - 1]);
  }
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

// Stage 4: Step Size Resolution
function resolveStepSizes(
  stepXOpt: number | null,
  stepYOpt: number | null,
  width: number,
  height: number,
  config: PixelSnapperConfig,
): { stepX: number; stepY: number } {
  if (stepXOpt !== null && stepYOpt !== null) {
    const ratio = stepXOpt > stepYOpt ? stepXOpt / stepYOpt : stepYOpt / stepXOpt;
    if (ratio > config.maxStepRatio) {
      const smaller = Math.min(stepXOpt, stepYOpt);
      return { stepX: smaller, stepY: smaller };
    }
    const avg = (stepXOpt + stepYOpt) / 2;
    return { stepX: avg, stepY: avg };
  }
  if (stepXOpt !== null) return { stepX: stepXOpt, stepY: stepXOpt };
  if (stepYOpt !== null) return { stepX: stepYOpt, stepY: stepYOpt };
  const fallback = Math.max(Math.min(width, height) / config.fallbackTargetSegments, 1);
  return { stepX: fallback, stepY: fallback };
}

// Stage 5a: Elastic Walker
function walk(profile: number[], stepSize: number, limit: number, config: PixelSnapperConfig): number[] {
  if (profile.length === 0) return [0, limit];

  const cuts = [0];
  let currentPos = 0;
  const searchWindow = Math.max(stepSize * config.walkerSearchWindowRatio, config.walkerMinSearchWindow);
  let sum = 0;
  for (const v of profile) sum += v;
  const meanVal = sum / profile.length;

  while (currentPos < limit) {
    const target = currentPos + stepSize;
    if (target >= limit) {
      cuts.push(limit);
      break;
    }
    const startSearch = Math.max(Math.floor(target - searchWindow), Math.floor(currentPos + 1));
    const endSearch = Math.min(Math.ceil(target + searchWindow), limit);

    if (endSearch <= startSearch) {
      currentPos = target;
      continue;
    }

    let maxValW = -1;
    let maxIdx = startSearch;
    for (let i = startSearch; i < endSearch; i++) {
      if (profile[i] > maxValW) {
        maxValW = profile[i];
        maxIdx = i;
      }
    }

    if (maxValW > meanVal * config.walkerStrengthThreshold) {
      cuts.push(maxIdx);
      currentPos = maxIdx;
    } else {
      cuts.push(Math.floor(target));
      currentPos = target;
    }
  }
  return cuts;
}

// Sanitize cuts: ensure sorted, deduped, includes 0 and limit
function sanitizeCuts(cuts: number[], limit: number): number[] {
  if (limit === 0) return [0];
  const set = new Set<number>();
  for (const c of cuts) set.add(Math.min(c, limit));
  set.add(0);
  set.add(limit);
  const sorted = Array.from(set).sort((a, b) => a - b);
  return sorted;
}

// Snap uniform cuts
function snapUniformCuts(
  profile: number[],
  limit: number,
  targetStep: number,
  config: PixelSnapperConfig,
  minRequired: number,
): number[] {
  if (limit === 0) return [0];
  if (limit === 1) return [0, 1];

  let desiredCells = targetStep > 0 && isFinite(targetStep) ? Math.round(limit / targetStep) : 0;
  desiredCells = Math.min(Math.max(desiredCells, Math.max(minRequired - 1, 1)), limit);

  const cellWidth = limit / desiredCells;
  const searchWindow = Math.max(cellWidth * config.walkerSearchWindowRatio, config.walkerMinSearchWindow);
  let sum = 0;
  for (const v of profile) sum += v;
  const meanVal = profile.length > 0 ? sum / profile.length : 0;

  const cuts = [0];
  for (let idx = 1; idx < desiredCells; idx++) {
    const target = cellWidth * idx;
    const prev = cuts[cuts.length - 1];
    if (prev + 1 >= limit) break;

    let start = Math.max(Math.floor(target - searchWindow), prev + 1, 0);
    let end = Math.min(Math.ceil(target + searchWindow), limit - 1);
    if (end < start) {
      start = prev + 1;
      end = start;
    }

    let bestIdx = Math.min(start, profile.length - 1);
    let bestVal = -1;
    for (let i = start; i <= Math.min(end, profile.length - 1); i++) {
      const v = profile[i] ?? 0;
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }

    const strengthThreshold = meanVal * config.walkerStrengthThreshold;
    if (bestVal < strengthThreshold) {
      let fallbackIdx = Math.round(target);
      if (fallbackIdx <= prev) fallbackIdx = prev + 1;
      if (fallbackIdx >= limit) fallbackIdx = Math.max(limit - 1, prev + 1);
      bestIdx = fallbackIdx;
    }
    cuts.push(bestIdx);
  }
  if (cuts[cuts.length - 1] !== limit) cuts.push(limit);
  return sanitizeCuts(cuts, limit);
}

// Stabilize cuts for one axis
function stabilizeCuts(
  profile: number[],
  cuts: number[],
  limit: number,
  siblingCuts: number[],
  siblingLimit: number,
  config: PixelSnapperConfig,
): number[] {
  if (limit === 0) return [0];

  const sanitized = sanitizeCuts(cuts, limit);
  const minRequired = Math.min(Math.max(config.minCutsPerAxis, 2), limit + 1);
  const axisCells = Math.max(sanitized.length - 1, 0);
  const siblingCells = Math.max(siblingCuts.length - 1, 0);
  const siblingHasGrid = siblingLimit > 0 && siblingCells >= Math.max(minRequired - 1, 0) && siblingCells > 0;
  const stepsSkewed = siblingHasGrid && axisCells > 0 && (() => {
    const axisStep = limit / axisCells;
    const siblingStep = siblingLimit / siblingCells;
    const stepRatio = axisStep / siblingStep;
    return stepRatio > config.maxStepRatio || stepRatio < 1 / config.maxStepRatio;
  })();
  const hasEnough = sanitized.length >= minRequired;

  if (hasEnough && !stepsSkewed) return sanitized;

  let targetStep: number;
  if (siblingHasGrid) {
    targetStep = siblingLimit / siblingCells;
  } else if (config.fallbackTargetSegments > 1) {
    targetStep = limit / config.fallbackTargetSegments;
  } else if (axisCells > 0) {
    targetStep = limit / axisCells;
  } else {
    targetStep = limit;
  }
  if (!isFinite(targetStep) || targetStep <= 0) targetStep = 1;

  return snapUniformCuts(profile, limit, targetStep, config, minRequired);
}

// Stage 5b: Two-pass stabilization
function stabilizeBothAxes(
  profileX: number[],
  profileY: number[],
  rawColCuts: number[],
  rawRowCuts: number[],
  width: number,
  height: number,
  config: PixelSnapperConfig,
): { colCuts: number[]; rowCuts: number[] } {
  const colCutsPass1 = stabilizeCuts(profileX, rawColCuts, width, rawRowCuts, height, config);
  const rowCutsPass1 = stabilizeCuts(profileY, rawRowCuts, height, rawColCuts, width, config);

  const colCells = Math.max(colCutsPass1.length - 1, 1);
  const rowCells = Math.max(rowCutsPass1.length - 1, 1);
  const colStep = width / colCells;
  const rowStep = height / rowCells;
  const stepRatio = colStep > rowStep ? colStep / rowStep : rowStep / colStep;

  if (stepRatio > config.maxStepRatio) {
    const targetStep = Math.min(colStep, rowStep);
    const finalColCuts = colStep > targetStep * 1.2
      ? snapUniformCuts(profileX, width, targetStep, config, config.minCutsPerAxis)
      : colCutsPass1;
    const finalRowCuts = rowStep > targetStep * 1.2
      ? snapUniformCuts(profileY, height, targetStep, config, config.minCutsPerAxis)
      : rowCutsPass1;
    return { colCuts: finalColCuts, rowCuts: finalRowCuts };
  }
  return { colCuts: colCutsPass1, rowCuts: rowCutsPass1 };
}

// Stage 6: Resampling (majority vote per grid cell)
function resample(imgData: ImageData, cols: number[], rows: number[]): ImageData {
  if (cols.length < 2 || rows.length < 2) {
    return imgData;
  }

  const outW = cols.length - 1;
  const outH = rows.length - 1;
  const { width: srcW, data: srcData } = imgData;
  const outData = new Uint8ClampedArray(outW * outH * 4);

  for (let yi = 0; yi < outH; yi++) {
    const ys = rows[yi];
    const ye = rows[yi + 1];
    for (let xi = 0; xi < outW; xi++) {
      const xs = cols[xi];
      const xe = cols[xi + 1];

      if (xe <= xs || ye <= ys) continue;

      // Majority vote
      const counts = new Map<string, { rgba: number[]; count: number }>();
      for (let y = ys; y < ye; y++) {
        for (let x = xs; x < xe; x++) {
          if (x < imgData.width && y < imgData.height) {
            const si = (y * srcW + x) * 4;
            const key = `${srcData[si]},${srcData[si + 1]},${srcData[si + 2]},${srcData[si + 3]}`;
            const entry = counts.get(key);
            if (entry) {
              entry.count++;
            } else {
              counts.set(key, { rgba: [srcData[si], srcData[si + 1], srcData[si + 2], srcData[si + 3]], count: 1 });
            }
          }
        }
      }

      let bestPixel = [0, 0, 0, 0];
      let bestCount = 0;
      for (const entry of counts.values()) {
        if (
          entry.count > bestCount ||
          (entry.count === bestCount && compareRgba(entry.rgba, bestPixel) < 0)
        ) {
          bestCount = entry.count;
          bestPixel = entry.rgba;
        }
      }

      const oi = (yi * outW + xi) * 4;
      outData[oi] = bestPixel[0];
      outData[oi + 1] = bestPixel[1];
      outData[oi + 2] = bestPixel[2];
      outData[oi + 3] = bestPixel[3];
    }
  }
  return new ImageData(outData, outW, outH);
}

// Main entry point
export function pixelSnap(imgData: ImageData, userConfig?: Partial<PixelSnapperConfig>): ImageData {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const { width, height } = imgData;

  assertPositiveInteger(config.kColors, "kColors");
  ensureProcessableDimensions(width, height);

  // Stage 1: Quantize
  const quantized = quantizeImage(imgData, config);

  // Stage 2: Compute profiles
  const { colProfile, rowProfile } = computeProfiles(quantized);

  // Stage 3: Estimate step sizes
  const stepXOpt = estimateStepSize(colProfile, config);
  const stepYOpt = estimateStepSize(rowProfile, config);

  // Stage 4: Resolve step sizes
  const { stepX, stepY } = resolveStepSizes(stepXOpt, stepYOpt, width, height, config);

  // Stage 5: Walk + stabilize
  const rawColCuts = walk(colProfile, stepX, width, config);
  const rawRowCuts = walk(rowProfile, stepY, height, config);
  const { colCuts, rowCuts } = stabilizeBothAxes(
    colProfile, rowProfile, rawColCuts, rawRowCuts, width, height, config,
  );

  // Stage 6: Resample
  return resample(quantized, colCuts, rowCuts);
}

// Helper: process an image URL through pixel snapper, return data URL + dimensions
export async function pixelSnapFromUrl(
  imageUrl: string,
  config?: Partial<PixelSnapperConfig>,
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);

      const result = pixelSnap(imageData, config);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = result.width;
      outCanvas.height = result.height;
      const outCtx = outCanvas.getContext("2d")!;
      outCtx.putImageData(result, 0, 0);

      resolve({
        dataUrl: outCanvas.toDataURL("image/png"),
        width: result.width,
        height: result.height,
      });
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}
