"use client";

import { useState, useCallback, useRef } from "react";
import type { AnimationType, SpriteSheetDimensions } from "./types";
import { useWizard } from "./hooks/useWizard";
import { useCharacterGeneration } from "./hooks/useCharacterGeneration";
import { useSpriteSheetGeneration } from "./hooks/useSpriteSheetGeneration";
import { useBackgroundRemoval } from "./hooks/useBackgroundRemoval";
import { usePixelSnap } from "./hooks/usePixelSnap";
import { useFrameExtraction } from "./hooks/useFrameExtraction";
import { useAnimationPreview } from "./hooks/useAnimationPreview";
import { useSandbox } from "./hooks/useSandbox";

import { FalLogo } from "./components/FalLogo";
import StepIndicator from "./components/StepIndicator";
import StepCharacter from "./components/StepCharacter";
import StepSpriteSheets from "./components/StepSpriteSheets";
import StepBgRemoved from "./components/StepBgRemoved";
import StepPixelPerfect from "./components/StepPixelPerfect";
import StepFrameExtraction from "./components/StepFrameExtraction";
import StepPreview from "./components/StepPreview";
import StepSandbox from "./components/StepSandbox";

export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<AnimationType>("walk");
  const [selectedTypes, setSelectedTypes] = useState<Set<AnimationType>>(
    new Set(["walk", "jump", "attack", "idle"]),
  );

  const wizard = useWizard();
  const character = useCharacterGeneration(setError);

  const spriteSheets = useSpriteSheetGeneration(
    character.characterImageUrl,
    setError,
    useCallback(() => wizard.completeAndGoTo([1], 2), [wizard.completeAndGoTo]),
  );

  // Ref to hold dimension setters (populated after extraction hooks are declared)
  const dimensionSettersRef = useRef<
    Record<AnimationType, (d: SpriteSheetDimensions) => void>
  >({ walk: () => {}, jump: () => {}, attack: () => {}, idle: () => {} });

  // Stable callback that uses ref to access extraction setters
  const setAllDimensions = useCallback(
    (dims: Record<AnimationType, SpriteSheetDimensions>) => {
      for (const type of Object.keys(dims) as AnimationType[]) {
        dimensionSettersRef.current[type](dims[type]);
      }
    },
    [],
  );

  const bgRemoval = useBackgroundRemoval(
    spriteSheets.urls,
    setError,
    useCallback(
      (dims: Record<AnimationType, SpriteSheetDimensions>) => {
        setAllDimensions(dims);
        wizard.completeAndGoTo([2], 3);
      },
      [setAllDimensions, wizard.completeAndGoTo],
    ),
  );

  const pixelSnap = usePixelSnap(
    bgRemoval.urls,
    setError,
    useCallback(
      (dims: Record<AnimationType, SpriteSheetDimensions>) => {
        setAllDimensions(dims);
        wizard.completeAndGoTo([3], 4);
      },
      [setAllDimensions, wizard.completeAndGoTo],
    ),
  );

  // Frame extraction hooks (one per animation type)
  const walkExtraction = useFrameExtraction({
    pixelSnappedUrl: pixelSnap.urls.walk,
    bgRemovedUrl: bgRemoval.urls.walk,
  });
  const jumpExtraction = useFrameExtraction({
    pixelSnappedUrl: pixelSnap.urls.jump,
    bgRemovedUrl: bgRemoval.urls.jump,
  });
  const attackExtraction = useFrameExtraction({
    pixelSnappedUrl: pixelSnap.urls.attack,
    bgRemovedUrl: bgRemoval.urls.attack,
  });
  const idleExtraction = useFrameExtraction({
    pixelSnappedUrl: pixelSnap.urls.idle,
    bgRemovedUrl: bgRemoval.urls.idle,
  });

  // Populate dimension setters ref (stable setState fns, safe to assign every render)
  dimensionSettersRef.current = {
    walk: walkExtraction.setDimensions,
    jump: jumpExtraction.setDimensions,
    attack: attackExtraction.setDimensions,
    idle: idleExtraction.setDimensions,
  };

  const extractions: Record<AnimationType, ReturnType<typeof useFrameExtraction>> = {
    walk: walkExtraction,
    jump: jumpExtraction,
    attack: attackExtraction,
    idle: idleExtraction,
  };

  const [previewType, setPreviewType] = useState<AnimationType>("walk");
  // If previewType is not in selectedTypes, fall back to first selected
  const effectivePreviewType = selectedTypes.has(previewType)
    ? previewType
    : [...selectedTypes][0] ?? "walk";
  const preview = useAnimationPreview(extractions[effectivePreviewType].extractedFrames);
  const sandbox = useSandbox(
    character.characterImageUrl,
    character.characterPrompt,
    setError,
  );

  const resetAll = () => {
    wizard.reset();
    character.reset();
    spriteSheets.reset();
    bgRemoval.reset();
    pixelSnap.reset();
    sandbox.reset();
    setSelectedTypes(new Set(["walk", "jump", "attack", "idle"]));
  };

  return (
    <main className="container">
      <header className="header">
        <div className="header-logo">
          <FalLogo size={36} />
          <h1>Sprite Sheet Creator</h1>
        </div>
        <p>Create pixel art sprite sheets using fal.ai</p>
      </header>

      <StepIndicator
        currentStep={wizard.currentStep}
        completedSteps={wizard.completedSteps}
      />

      {error && <div className="error-message">{error}</div>}

      {wizard.currentStep === 1 && (
        <StepCharacter
          character={character}
          onGenerateSpriteSheet={() => spriteSheets.generateAll(selectedTypes)}
          isGeneratingSpriteSheet={spriteSheets.isGenerating}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
        />
      )}

      {wizard.currentStep === 2 && (
        <StepSpriteSheets
          spriteSheets={spriteSheets}
          isRemovingBg={bgRemoval.isRemoving}
          onRemoveBackground={() => bgRemoval.removeAll(selectedTypes)}
          onBack={() => wizard.setCurrentStep(1)}
          selectedTypes={selectedTypes}
        />
      )}

      {wizard.currentStep === 3 && (
        <StepBgRemoved
          bgRemoval={bgRemoval}
          pixelSnap={pixelSnap}
          onBack={() => wizard.setCurrentStep(2)}
          selectedTypes={selectedTypes}
        />
      )}

      {wizard.currentStep === 4 && (
        <StepPixelPerfect
          pixelSnap={pixelSnap}
          onProceedToFrameExtraction={() =>
            wizard.completeAndGoTo([4], 5)
          }
          onBack={() => wizard.setCurrentStep(3)}
          selectedTypes={selectedTypes}
        />
      )}

      {wizard.currentStep === 5 && (
        <StepFrameExtraction
          activeSheet={activeSheet}
          setActiveSheet={setActiveSheet}
          extractions={extractions}
          pixelSnappedUrls={pixelSnap.urls}
          bgRemovedUrls={bgRemoval.urls}
          onProceedToSandbox={() => wizard.completeAndGoTo([5], 6)}
          onBack={() => wizard.setCurrentStep(4)}
          selectedTypes={selectedTypes}
        />
      )}

      {wizard.currentStep === 6 && (
        <StepPreview
          preview={preview}
          walkFrames={walkExtraction.extractedFrames}
          jumpFrames={jumpExtraction.extractedFrames}
          attackFrames={attackExtraction.extractedFrames}
          idleFrames={idleExtraction.extractedFrames}
          pixelSnappedUrls={pixelSnap.urls}
          bgRemovedUrls={bgRemoval.urls}
          onProceedToSandbox={() => wizard.completeAndGoTo([6], 7)}
          onBack={() => wizard.setCurrentStep(5)}
          selectedTypes={selectedTypes}
          previewType={effectivePreviewType}
          setPreviewType={setPreviewType}
        />
      )}

      {wizard.currentStep === 7 && (
        <StepSandbox
          preview={preview}
          sandbox={sandbox}
          walkFrames={walkExtraction.extractedFrames}
          jumpFrames={jumpExtraction.extractedFrames}
          attackFrames={attackExtraction.extractedFrames}
          idleFrames={idleExtraction.extractedFrames}
          onBack={() => wizard.setCurrentStep(6)}
          onStartNew={resetAll}
        />
      )}
    </main>
  );
}
