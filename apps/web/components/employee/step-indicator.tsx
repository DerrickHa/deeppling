"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

interface StepIndicatorProps {
  steps: string[];
  onboarding: Record<string, StepStatus>;
  currentStep?: number;
}

const stepLabels: Record<string, string> = {
  identity: "Identity",
  employment: "Employment",
  tax: "Tax",
  wallet: "Wallet",
  documents: "Documents",
  review: "Review",
};

export function StepIndicator({ steps, onboarding, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      {/* Desktop: full step bar */}
      <ol className="hidden sm:flex items-center w-full">
        {steps.map((step, index) => {
          const status = onboarding[step];
          const isCompleted = status === "COMPLETED";
          const isCurrent = currentStep === index;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step}
              className={cn("flex items-center", !isLast && "flex-1")}
            >
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center justify-center size-8 rounded-full border-2 text-xs font-semibold transition-colors shrink-0",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      !isCompleted &&
                      "border-primary text-primary bg-primary/10",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted-foreground/30 text-muted-foreground/60 bg-background"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isCompleted ? (
                    <Check className="size-4" strokeWidth={3} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none",
                    isCompleted && "text-primary",
                    isCurrent && !isCompleted && "text-foreground",
                    !isCompleted && !isCurrent && "text-muted-foreground/60"
                  )}
                >
                  {stepLabels[step] ?? step}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mt-[-18px] rounded-full transition-colors",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: compact dots */}
      <div className="flex sm:hidden items-center justify-center gap-2">
        {steps.map((step, index) => {
          const status = onboarding[step];
          const isCompleted = status === "COMPLETED";
          const isCurrent = currentStep === index;

          return (
            <div
              key={step}
              className={cn(
                "flex items-center justify-center size-7 rounded-full text-[10px] font-bold transition-colors",
                isCompleted &&
                  "bg-primary text-primary-foreground",
                isCurrent &&
                  !isCompleted &&
                  "border-2 border-primary text-primary bg-primary/10",
                !isCompleted &&
                  !isCurrent &&
                  "bg-muted text-muted-foreground"
              )}
              aria-label={`Step ${index + 1}: ${stepLabels[step] ?? step}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
            >
              {isCompleted ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
