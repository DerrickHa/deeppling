"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/shared/error-alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { StepIndicator } from "@/components/employee/step-indicator";
import { IdentityForm } from "@/components/employee/identity-form";
import { EmploymentForm } from "@/components/employee/employment-form";
import { TaxForm } from "@/components/employee/tax-form";
import { WalletStep } from "@/components/employee/wallet-step";
import { DocumentSignForm } from "@/components/employee/document-sign-form";
import { ReviewStep } from "@/components/employee/review-step";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

type EmployeePayload = {
  employeeId: string;
  email: string;
  inviteExpiresAt: string;
  onboarding: Record<string, StepStatus>;
  readiness: string;
};

const stepOrder = ["identity", "employment", "tax", "wallet", "documents", "review"] as const;
type StepKey = (typeof stepOrder)[number];

const stepMeta: Record<StepKey, { title: string; description: string }> = {
  identity: {
    title: "Identity & Contact",
    description: "Tell us who you are and how payroll can reach you.",
  },
  employment: {
    title: "Employment Profile",
    description: "Confirm your role, start date, and salary details.",
  },
  tax: {
    title: "Tax Profile",
    description: "Set withholding preferences to keep payroll compliant.",
  },
  wallet: {
    title: "Payout Wallet",
    description: "Provision your managed wallet for payroll payouts.",
  },
  documents: {
    title: "Document Signature",
    description: "Review and sign your onboarding documents.",
  },
  review: {
    title: "Review & Submit",
    description: "Double-check everything and send your onboarding for review.",
  },
};

const stepActionMap: Record<string, StepKey> = {
  identity: "identity",
  employment: "employment",
  tax: "tax",
  wallet: "wallet",
  sign: "documents",
  submit: "review",
};

export default function EmployeeOnboardingClient({ token }: { token: string }) {
  const [profile, setProfile] = useState<EmployeePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const progress = useMemo(() => {
    if (!profile) return 0;
    const completed = stepOrder.filter((step) => profile.onboarding[step] === "COMPLETED").length;
    return Math.round((completed / stepOrder.length) * 100);
  }, [profile]);

  const currentStepIndex = useMemo(() => {
    if (!profile) return 0;
    const firstIncomplete = stepOrder.findIndex(
      (step) => profile.onboarding[step] !== "COMPLETED"
    );
    return firstIncomplete === -1 ? stepOrder.length - 1 : firstIncomplete;
  }, [profile]);

  const activeIndex = activeStepIndex ?? currentStepIndex;
  const activeStep = stepOrder[activeIndex];
  const activeStatus = profile?.onboarding[activeStep] ?? "NOT_STARTED";
  const isFirstStep = activeIndex === 0;
  const isLastStep = activeIndex === stepOrder.length - 1;
  const stepCompleted = activeStatus === "COMPLETED";
  const navigationBusy = busy !== null && busy !== "load";

  const runAction = async (label: string, fn: () => Promise<void>): Promise<boolean> => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      const latest = await apiRequest<EmployeePayload>(`/employee-onboarding/${token}`);
      setProfile(latest);
      if (label !== "load") {
        const toastLabel = label === "sign" ? "documents" : label;
        toast.success(`Step "${toastLabel}" saved.`);
      }
      return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      if (label !== "load") {
        toast.error(`Failed: ${message}`);
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void runAction("load", async () => {
      const latest = await apiRequest<EmployeePayload>(`/employee-onboarding/${token}`);
      setProfile(latest);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!profile) return;
    setActiveStepIndex((previous) => {
      if (previous === null) {
        return currentStepIndex;
      }
      return Math.max(0, Math.min(previous, stepOrder.length - 1));
    });
  }, [profile, currentStepIndex]);

  const maybeAdvanceStep = (action: string) => {
    const actionStep = stepActionMap[action];
    if (!actionStep) return;

    setActiveStepIndex((previous) => {
      const current = previous ?? currentStepIndex;
      if (stepOrder[current] !== actionStep) {
        return current;
      }
      return Math.min(current + 1, stepOrder.length - 1);
    });
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>, path: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const ok = await runAction(path, async () => {
      await apiRequest(`/employee-onboarding/${token}/${path}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
    });
    if (ok) {
      maybeAdvanceStep(path);
    }
  };

  const submitWallet = async () => {
    const ok = await runAction("wallet", async () => {
      await apiRequest(`/employee-onboarding/${token}/wallet`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    });
    if (ok) {
      maybeAdvanceStep("wallet");
    }
  };

  const submitReview = async () => {
    await runAction("submit", async () => {
      await apiRequest(`/employee-onboarding/${token}/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    });
  };

  const goToPrevious = () => {
    setActiveStepIndex((previous) => {
      const current = previous ?? currentStepIndex;
      return Math.max(current - 1, 0);
    });
  };

  const goToNext = () => {
    if (!stepCompleted || isLastStep) return;
    setActiveStepIndex((previous) => {
      const current = previous ?? currentStepIndex;
      return Math.min(current + 1, stepOrder.length - 1);
    });
  };

  const renderActiveStep = () => {
    switch (activeStep) {
      case "identity":
        return (
          <IdentityForm
            token={token}
            onSubmit={submitForm}
            busy={busy === "identity"}
            status={profile?.onboarding["identity"] ?? "NOT_STARTED"}
          />
        );
      case "employment":
        return (
          <EmploymentForm
            token={token}
            onSubmit={submitForm}
            busy={busy === "employment"}
            status={profile?.onboarding["employment"] ?? "NOT_STARTED"}
          />
        );
      case "tax":
        return (
          <TaxForm
            token={token}
            onSubmit={submitForm}
            busy={busy === "tax"}
            status={profile?.onboarding["tax"] ?? "NOT_STARTED"}
          />
        );
      case "wallet":
        return (
          <WalletStep
            onProvision={submitWallet}
            busy={busy === "wallet"}
            status={profile?.onboarding["wallet"] ?? "NOT_STARTED"}
          />
        );
      case "documents":
        return (
          <DocumentSignForm
            token={token}
            onSubmit={submitForm}
            busy={busy === "sign"}
            status={profile?.onboarding["documents"] ?? "NOT_STARTED"}
          />
        );
      case "review":
        return (
          <ReviewStep
            onboarding={profile?.onboarding ?? {}}
            onSubmit={submitReview}
            busy={busy === "submit"}
            readiness={profile?.readiness ?? "NOT_READY"}
          />
        );
      default:
        return null;
    }
  };

  const isLoading = busy === "load" && !profile;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -left-24 h-56 w-56 rounded-full bg-chart-2/20 blur-3xl" />
        <div className="absolute -right-20 bottom-12 h-56 w-56 rounded-full bg-chart-4/20 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="border-b border-border/70 bg-background/85 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/90 shadow-sm flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">Deeppling</span>
          </Link>
          {profile && (
            <StatusBadge status={profile.readiness} />
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-[0_16px_45px_-30px_color-mix(in_oklch,var(--color-primary)_55%,transparent)]">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                Guided onboarding
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Employee Self-Onboarding</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                One focused step at a time. Save each section, then continue with Next.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {profile && <Badge variant="secondary">{profile.email}</Badge>}
              <Badge variant="outline">Token: {token.slice(0, 8)}...</Badge>
            </div>
          </div>
        </section>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-2.5 w-full" />
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          </div>
        )}

        {/* Loaded content */}
        {profile && (
          <>
            <div className="rounded-2xl border border-white/50 bg-card/80 backdrop-blur-sm p-5 sm:p-6 space-y-4 shadow-[0_10px_30px_-24px_color-mix(in_oklch,var(--color-primary)_60%,transparent)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step {activeIndex + 1} of {stepOrder.length}
                  </p>
                  <p className="text-base font-semibold">{stepMeta[activeStep].title}</p>
                  <p className="text-sm text-muted-foreground">{stepMeta[activeStep].description}</p>
                </div>
                <Badge variant="outline" className="w-fit">
                  {progress}% complete
                </Badge>
              </div>
              <Progress value={progress} className="h-2.5" />
              <StepIndicator
                steps={stepOrder}
                onboarding={profile.onboarding}
                currentStep={activeIndex}
              />
            </div>

            {/* Error */}
            <ErrorAlert message={error} />

            {/* Global busy indicator */}
            {busy && busy !== "load" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Processing: {busy}</span>
              </div>
            )}

            <div className="rounded-3xl border border-white/50 bg-card/80 backdrop-blur-xl shadow-[0_16px_45px_-30px_color-mix(in_oklch,var(--color-primary)_65%,transparent)] overflow-hidden">
              <div
                key={activeStep}
                className="animate-in fade-in slide-in-from-bottom-2 duration-300 [&_[data-slot=card]]:rounded-none [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:shadow-none"
              >
                {renderActiveStep()}
              </div>

              <div className="border-t bg-muted/35 px-5 py-4 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {isLastStep
                    ? "Final step: submit when everything looks correct."
                    : stepCompleted
                      ? "Saved. Continue to the next step whenever you're ready."
                      : "Save this step to unlock Next."}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={goToPrevious}
                    disabled={isFirstStep || navigationBusy}
                  >
                    <ArrowLeft className="size-4" />
                    Back
                  </Button>
                  <Button
                    onClick={goToNext}
                    disabled={isLastStep || !stepCompleted || navigationBusy}
                    className="min-w-24"
                  >
                    Next
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Error without profile (failed initial load) */}
        {!isLoading && !profile && error && (
          <div className="space-y-4">
            <ErrorAlert message={error} />
            <p className="text-sm text-muted-foreground">
              Could not load your onboarding profile. The invite token may be invalid or expired.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Deeppling - Onboarding & Payroll on Monad
      </footer>
    </div>
  );
}
