"use client";

import { FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

interface OrgResponse {
  id: string;
  kybStatus: string;
  treasury: {
    accountId?: string;
    fundedTokenUnits: string;
    fundedMonUnits: string;
  };
  payrollPolicy?: {
    tokenAddress: string;
    status: string;
  };
}

interface PayrollPolicyFormProps {
  orgId: string;
  onUpdate: (org: OrgResponse) => void;
  busy: boolean;
}

export function PayrollPolicyForm({ orgId, onUpdate, busy }: PayrollPolicyFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    try {
      const updated = await apiRequest<OrgResponse>(
        `/orgs/${orgId}/payroll-policy`,
        {
          method: "POST",
          body: JSON.stringify({
            schedule: "MONTHLY",
            cutoffDay: Number(form.get("cutoffDay")),
            payoutDay: Number(form.get("payoutDay")),
            tokenAddress: form.get("tokenAddress"),
            maxRunAmount: form.get("maxRunAmount"),
            maxPayoutAmount: form.get("maxPayoutAmount"),
            approvedTokens: [form.get("tokenAddress")],
          }),
        }
      );
      onUpdate(updated);
      toast.success("Payroll policy saved");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Policy save failed");
      throw caught;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Payroll Policy</CardTitle>
            <CardDescription>Define schedule and payout limits</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="policy-cutoff">Cutoff day</Label>
              <Input
                id="policy-cutoff"
                name="cutoffDay"
                type="number"
                min={1}
                max={28}
                defaultValue={25}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-payout">Payout day</Label>
              <Input
                id="policy-payout"
                name="payoutDay"
                type="number"
                min={1}
                max={28}
                defaultValue={1}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-token">Token address</Label>
            <Input
              id="policy-token"
              name="tokenAddress"
              defaultValue="0x0000000000000000000000000000000000000010"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="policy-max-run">Max run amount</Label>
              <Input
                id="policy-max-run"
                name="maxRunAmount"
                defaultValue="1000000000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-max-payout">Max payout amount</Label>
              <Input
                id="policy-max-payout"
                name="maxPayoutAmount"
                defaultValue="100000000"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={!orgId || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save Payroll Policy
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
