import { useState, useCallback } from "react";
import type { Step } from "../types";

export function useWizard(initialStep: Step = 1) {
  const [currentStep, setCurrentStep] = useState<Step>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const completeAndGoTo = useCallback(
    (completeSteps: number[], goTo: Step) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        completeSteps.forEach((s) => next.add(s));
        return next;
      });
      setCurrentStep(goTo);
    },
    [],
  );

  const reset = useCallback(() => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
  }, []);

  return { currentStep, setCurrentStep, completedSteps, completeAndGoTo, reset };
}
