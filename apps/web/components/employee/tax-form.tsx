"use client";

import { FormEvent, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

interface TaxFormProps {
  token: string;
  onSubmit: (event: FormEvent<HTMLFormElement>, path: string) => void;
  busy: boolean;
  status: StepStatus;
}

export function TaxForm({ onSubmit, busy, status }: TaxFormProps) {
  const isCompleted = status === "COMPLETED";
  const filingStatusRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>3. Tax Profile</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>
          Set your filing status and withholding preferences.
        </CardDescription>
      </CardHeader>
      <form onSubmit={(e) => onSubmit(e, "tax")}>
        <CardContent className="space-y-4">
          <fieldset disabled={isCompleted} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filingStatus">Filing status</Label>
              <input
                ref={filingStatusRef}
                type="hidden"
                name="filingStatus"
                defaultValue="single"
              />
              <Select
                defaultValue="single"
                onValueChange={(value) => {
                  if (filingStatusRef.current) {
                    filingStatusRef.current.value = value;
                  }
                }}
                disabled={isCompleted}
              >
                <SelectTrigger id="filingStatus" className="w-full">
                  <SelectValue placeholder="Select filing status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="head_of_household">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="allowances">Allowances</Label>
                <Input
                  id="allowances"
                  name="allowances"
                  type="number"
                  defaultValue={1}
                  min={0}
                  max={10}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extraWithholdingCents">Extra withholding (cents)</Label>
                <Input
                  id="extraWithholdingCents"
                  name="extraWithholdingCents"
                  type="number"
                  defaultValue={0}
                  min={0}
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
              Save Tax Profile
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
