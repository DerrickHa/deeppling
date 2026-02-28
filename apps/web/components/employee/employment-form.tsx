"use client";

import { FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

interface EmploymentFormProps {
  token: string;
  onSubmit: (event: FormEvent<HTMLFormElement>, path: string) => void;
  busy: boolean;
  status: StepStatus;
}

export function EmploymentForm({ onSubmit, busy, status }: EmploymentFormProps) {
  const isCompleted = status === "COMPLETED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>2. Employment Profile</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>
          Confirm your role, start date, and compensation details.
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => onSubmit(e, "employment")}>
        <CardContent className="space-y-4">
          <fieldset disabled={isCompleted} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roleTitle">Role title</Label>
              <Input
                id="roleTitle"
                name="roleTitle"
                placeholder="Software Engineer"
                defaultValue="Software Engineer"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue="2026-01-10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualSalaryCents">Annual salary (cents)</Label>
                <Input
                  id="annualSalaryCents"
                  name="annualSalaryCents"
                  type="number"
                  defaultValue="13500000"
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
              Save Employment
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
