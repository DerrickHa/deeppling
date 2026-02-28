"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

const stepOrder = ["identity", "employment", "tax", "wallet", "documents", "review"];

export default function EmployeeOnboardingClient({ token }: { token: string }) {
  const [profile, setProfile] = useState<EmployeePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      const latest = await apiRequest<EmployeePayload>(`/employee-onboarding/${token}`);
      setProfile(latest);
      if (label !== "load") {
        toast.success(`Step "${label}" saved successfully.`);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      if (label !== "load") {
        toast.error(`Failed: ${message}`);
      }
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    runAction("load", async () => {
      const latest = await apiRequest<EmployeePayload>(`/employee-onboarding/${token}`);
      setProfile(latest);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitForm = async (event: FormEvent<HTMLFormElement>, path: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction(path, async () => {
      await apiRequest(`/employee-onboarding/${token}/${path}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
    });
  };

  const submitWallet = async () => {
    await runAction("wallet", async () => {
      await apiRequest(`/employee-onboarding/${token}/wallet`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    });
  };

  const submitReview = async () => {
    await runAction("submit", async () => {
      await apiRequest(`/employee-onboarding/${token}/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    });
  };

  const isLoading = busy === "load" && !profile;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
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
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Employee Self-Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Complete all required steps to become payroll-ready. Invite token:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{token}</code>
          </p>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border p-6 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loaded content */}
        {profile && (
          <>
            {/* Employee info bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{profile.email}</Badge>
              <Badge variant="outline">Progress: {progress}%</Badge>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <StepIndicator
                steps={stepOrder}
                onboarding={profile.onboarding}
                currentStep={currentStepIndex}
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

            {/* Step cards */}
            <div className="space-y-6">
              <IdentityForm
                token={token}
                onSubmit={submitForm}
                busy={busy === "identity"}
                status={profile.onboarding["identity"] ?? "NOT_STARTED"}
              />

              <EmploymentForm
                token={token}
                onSubmit={submitForm}
                busy={busy === "employment"}
                status={profile.onboarding["employment"] ?? "NOT_STARTED"}
              />

              <TaxForm
                token={token}
                onSubmit={submitForm}
                busy={busy === "tax"}
                status={profile.onboarding["tax"] ?? "NOT_STARTED"}
              />

              <WalletStep
                onProvision={submitWallet}
                busy={busy === "wallet"}
                status={profile.onboarding["wallet"] ?? "NOT_STARTED"}
              />

              <DocumentSignForm
                token={token}
                onSubmit={submitForm}
                busy={busy === "sign"}
                status={profile.onboarding["documents"] ?? "NOT_STARTED"}
              />

              <ReviewStep
                onboarding={profile.onboarding}
                onSubmit={submitReview}
                busy={busy === "submit"}
                readiness={profile.readiness}
              />
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
        Deeppling -- Onboarding & Payroll on Monad
      </footer>
    </div>
  );
}
