"use client";

import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sprout, Play } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface RunControlsProps {
  orgId: string;
  onOrgIdChange: (id: string) => void;
  runId: string;
  onCreatePreview: (periodStart: string, periodEnd: string) => void;
  onSeed: () => void;
  busy: string | null;
}

export function RunControls({
  orgId,
  onOrgIdChange,
  runId,
  onCreatePreview,
  onSeed,
  busy,
}: RunControlsProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const periodStart = form.get("periodStart") as string;
    const periodEnd = form.get("periodEnd") as string;
    onCreatePreview(periodStart, periodEnd);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Setup</CardTitle>
        <CardDescription>
          Configure organization and create a payroll preview
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="orgId">Organization ID</Label>
          <div className="flex gap-2">
            <Input
              id="orgId"
              value={orgId}
              onChange={(e) => onOrgIdChange(e.target.value)}
              placeholder="Enter org ID"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={onSeed}
              disabled={!orgId || busy === "seed"}
              className="shrink-0"
            >
              {busy === "seed" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sprout className="size-4" />
              )}
              Seed 100
            </Button>
          </div>
        </div>

        <Separator />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Period Start</Label>
              <Input
                id="periodStart"
                name="periodStart"
                type="date"
                defaultValue="2026-02-01"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period End</Label>
              <Input
                id="periodEnd"
                name="periodEnd"
                type="date"
                defaultValue="2026-02-28"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={!orgId || busy === "preview"}
            className="w-full"
          >
            {busy === "preview" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Create Preview
          </Button>
        </form>

        {runId && (
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground mb-1">Active Run ID</p>
            <code className="text-xs font-mono break-all">{runId}</code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
