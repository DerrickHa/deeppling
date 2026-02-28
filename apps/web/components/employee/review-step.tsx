"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BooleanStatusBadge } from "@/components/shared/status-badge";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

const prerequisiteSteps = ["identity", "employment", "tax", "wallet", "documents"];

const stepLabels: Record<string, string> = {
  identity: "Identity & Contact",
  employment: "Employment Profile",
  tax: "Tax Profile",
  wallet: "Payout Wallet",
  documents: "Document Signature",
};

interface ReviewStepProps {
  onboarding: Record<string, StepStatus>;
  onSubmit: () => void;
  busy: boolean;
  readiness: string;
}

export function ReviewStep({ onboarding, onSubmit, busy, readiness }: ReviewStepProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const allComplete = prerequisiteSteps.every(
    (step) => onboarding[step] === "COMPLETED"
  );
  const isSubmitted = readiness === "READY" || onboarding["review"] === "COMPLETED";

  const handleConfirm = () => {
    setDialogOpen(false);
    onSubmit();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>6. Review & Submit</CardTitle>
          {isSubmitted ? (
            <BooleanStatusBadge ok okLabel="Submitted" />
          ) : (
            <BooleanStatusBadge ok={false} failLabel="Pending" />
          )}
        </div>
        <CardDescription>
          All prior steps must be completed before you can submit your onboarding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border divide-y">
          {prerequisiteSteps.map((step) => (
            <div
              key={step}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm">{stepLabels[step]}</span>
              <BooleanStatusBadge
                ok={onboarding[step] === "COMPLETED"}
                okLabel="Done"
                failLabel="Incomplete"
              />
            </div>
          ))}
        </div>

        {!allComplete && (
          <p className="text-sm text-muted-foreground">
            Complete all steps above before submitting.
          </p>
        )}
      </CardContent>
      {!isSubmitted && (
        <CardFooter>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                disabled={!allComplete || busy}
                className="w-full sm:w-auto"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                <Send className="size-4" />
                Submit Onboarding
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm submission</DialogTitle>
                <DialogDescription>
                  You are about to submit your onboarding for review. Once submitted, you
                  will not be able to edit your information. Are you sure?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Confirm & Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardFooter>
      )}
    </Card>
  );
}
