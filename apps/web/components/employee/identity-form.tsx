"use client";

import { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

interface IdentityFormProps {
  token: string;
  onSubmit: (event: FormEvent<HTMLFormElement>, path: string) => void;
  busy: boolean;
  status: StepStatus;
}

export function IdentityForm({ onSubmit, busy, status }: IdentityFormProps) {
  const isCompleted = status === "COMPLETED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>1. Identity & Contact</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>
          Provide your legal name, state of residence, and phone number.
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => onSubmit(e, "identity")}>
        <CardContent className="space-y-4">
          <fieldset disabled={isCompleted} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full legal name</Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Jane Doe"
                defaultValue="Employee One"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="CA"
                  defaultValue="CA"
                  maxLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="4155551234"
                  defaultValue="4155551234"
                  required
                />
              </div>
            </div>
          </fieldset>
        </CardContent>
        {!isCompleted && (
          <CardFooter>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy && <Loader2 className="size-4 animate-spin" />}
              Save Identity
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
