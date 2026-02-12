import type { Step } from "../types";

interface StepIndicatorProps {
  currentStep: Step;
  completedSteps: Set<number>;
}

export default function StepIndicator({
  currentStep,
  completedSteps,
}: StepIndicatorProps) {
  return (
    <div className="steps-indicator">
      {[1, 2, 3, 4, 5, 6].map((displayStep) => {
        const internalStep = displayStep === 6 ? 7 : displayStep;
        return (
          <div
            key={displayStep}
            className={`step-dot ${currentStep === internalStep ? "active" : ""} ${
              completedSteps.has(internalStep) ? "completed" : ""
            }`}
          />
        );
      })}
    </div>
  );
}
