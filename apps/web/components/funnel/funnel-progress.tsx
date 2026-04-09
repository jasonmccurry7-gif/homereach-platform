import { cn } from "@/lib/utils";

type Step = {
  label: string;
  sublabel?: string;
};

const STEPS: Step[] = [
  { label: "City" },
  { label: "Category" },
  { label: "Your Spot" },
  { label: "Checkout" },
];

interface FunnelProgressProps {
  currentStep: 1 | 2 | 3 | 4;
  cityName?: string;
  categoryName?: string;
}

export function FunnelProgress({
  currentStep,
  cityName,
  categoryName,
}: FunnelProgressProps) {
  const steps = STEPS.map((step, i) => ({
    ...step,
    sublabel:
      i === 0 ? cityName :
      i === 1 ? categoryName :
      undefined,
  }));

  return (
    <div className="py-6">
      <div className="mx-auto max-w-xl px-4">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => {
            const stepNum = i + 1;
            const isComplete = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div key={i} className="flex flex-1 items-center">
                {/* Step circle */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                      isComplete &&
                        "bg-blue-600 text-white",
                      isCurrent &&
                        "bg-blue-600 text-white ring-4 ring-blue-100",
                      !isComplete && !isCurrent &&
                        "bg-gray-100 text-gray-400"
                    )}
                  >
                    {isComplete ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <div className="mt-1.5 text-center">
                    <div
                      className={cn(
                        "text-xs font-medium leading-tight",
                        isCurrent ? "text-blue-700" : isComplete ? "text-gray-700" : "text-gray-400"
                      )}
                    >
                      {step.label}
                    </div>
                    {step.sublabel && (
                      <div className="text-xs text-gray-500 truncate max-w-[80px]">
                        {step.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 mt-[-16px] h-px flex-1",
                      stepNum < currentStep ? "bg-blue-600" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
