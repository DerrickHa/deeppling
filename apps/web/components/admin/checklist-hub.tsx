"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck, AlertTriangle } from "lucide-react";
import { BooleanStatusBadge } from "@/components/shared/status-badge";
import type { ChecklistResponse } from "@/lib/api";

interface ChecklistHubProps {
  orgId: string;
  checklist: ChecklistResponse | null;
  onRefresh: () => void;
  busy: boolean;
}

export function ChecklistHub({ orgId, checklist, onRefresh, busy }: ChecklistHubProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Checklist Hub</CardTitle>
            <CardDescription>Onboarding readiness overview</CardDescription>
          </div>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={!orgId || busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {checklist ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Company verification</span>
                <BooleanStatusBadge ok={checklist.companyVerified} />
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Treasury funded</span>
                <BooleanStatusBadge ok={checklist.treasuryFunded} />
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Policy active</span>
                <BooleanStatusBadge ok={checklist.policyActive} />
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Employees ready</span>
                <Badge variant="secondary">
                  {checklist.employeesReady}/{checklist.employeesInvited}
                </Badge>
              </div>
            </div>

            {checklist.blockers.length > 0 ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
                <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="size-3" />
                  Blockers
                </p>
                {checklist.blockers.map((blocker) => (
                  <p key={blocker} className="text-sm text-destructive/80">
                    {blocker}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No checklist loaded yet. Click Refresh to fetch status.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
