"use client";

import { cn } from "@/lib/utils";
import { Check, Building2, ShieldCheck, Vault, FileText } from "lucide-react";

interface WizardProgressProps {
  currentStep: number;
}

const steps = [
  { label: "Workspace", icon: Building2 },
  { label: "KYB", icon: ShieldCheck },
  { label: "Treasury", icon: Vault },
  { label: "Policy", icon: FileText },
];

export function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <div className="w-full py-2">
      <div className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-5 left-[calc(12.5%+14px)] right-[calc(12.5%+14px)] h-0.5 bg-border" />
        {/* Filled connector line */}
        <div
          className="absolute top-5 left-[calc(12.5%+14px)] h-0.5 bg-primary transition-all duration-500 ease-out"
          style={{
            width:
              currentStep === 0
                ? "0%"
                : `${(Math.min(currentStep, 4) / 3) * 75}%`,
          }}
        />

        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;
          const StepIcon = step.icon;

          return (
            <div
              key={step.label}
              className="flex flex-col items-center gap-2 relative z-10 flex-1"
            >
              <div
                className={cn(
                  "size-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isComplete
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                      ? "bg-background border-primary text-primary"
                      : "bg-background border-border text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <Check className="size-4 stroke-[3]" />
                ) : (
                  <StepIcon className="size-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium transition-colors duration-300",
                  isComplete || isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
