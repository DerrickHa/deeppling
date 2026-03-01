"use client";

import { FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Vault } from "lucide-react";
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

interface TreasuryFormProps {
  orgId: string;
  onUpdate: (org: OrgResponse) => void;
  busy: boolean;
}

export function TreasuryForm({ orgId, onUpdate, busy }: TreasuryFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    try {
      const updated = await apiRequest<OrgResponse>(
        `/orgs/${orgId}/treasury/setup`,
        {
          method: "POST",
          actor: {
            email: "finance@demo.local",
            role: "FinanceApprover"
          },
          body: JSON.stringify({
            tokenAddress: form.get("tokenAddress"),
            fundedTokenUnits: form.get("fundedTokenUnits"),
            fundedMonUnits: form.get("fundedMonUnits"),
            minTokenThreshold: "1000000",
            minMonThreshold: "10000000000000000",
            signerAddresses: ["0x111", "0x222", "0x333"],
          }),
        }
      );
      onUpdate(updated);
      toast.success("Treasury configured");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Treasury setup failed");
      throw caught;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Vault className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Treasury Setup</CardTitle>
            <CardDescription>Configure token funding and thresholds</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="treasury-token">Payroll token address</Label>
            <Input
              id="treasury-token"
              name="tokenAddress"
              placeholder="Payroll token"
              defaultValue="0x0000000000000000000000000000000000000010"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="treasury-funded">Funded token units</Label>
            <Input
              id="treasury-funded"
              name="fundedTokenUnits"
              placeholder="Funded token units"
              defaultValue="900000000"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="treasury-mon">Funded MON (wei)</Label>
            <Input
              id="treasury-mon"
              name="fundedMonUnits"
              placeholder="Funded MON wei"
              defaultValue="1000000000000000000"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!orgId || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Configure Treasury
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
