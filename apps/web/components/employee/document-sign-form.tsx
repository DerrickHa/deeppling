"use client";

import { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

interface DocumentSignFormProps {
  token: string;
  onSubmit: (event: FormEvent<HTMLFormElement>, path: string) => void;
  busy: boolean;
  status: StepStatus;
}

export function DocumentSignForm({ onSubmit, busy, status }: DocumentSignFormProps) {
  const isCompleted = status === "COMPLETED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>5. Document Signature</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>
          Review and sign your employment documents to proceed.
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => onSubmit(e, "sign")}>
        <CardContent className="space-y-4">
          <fieldset disabled={isCompleted} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="documentHash">Document hash</Label>
              <Input
                id="documentHash"
                name="documentHash"
                defaultValue="employment-doc-hash-2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">Signing IP address</Label>
              <Input
                id="ip"
                name="ip"
                defaultValue="127.0.0.1"
                required
              />
            </div>
          </fieldset>
        </CardContent>
        {!isCompleted && (
          <CardFooter>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sign Documents
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
