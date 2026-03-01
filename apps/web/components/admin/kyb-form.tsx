"use client";

import { FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
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

interface KybFormProps {
  orgId: string;
  onUpdate: (org: OrgResponse) => void;
  busy: boolean;
}

export function KybForm({ orgId, onUpdate, busy }: KybFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    try {
      const updated = await apiRequest<OrgResponse>(`/orgs/${orgId}/kyb`, {
        method: "POST",
        actor: {
          email: "payroll-admin@demo.local",
          role: "PayrollAdmin"
        },
        body: JSON.stringify({
          legalEntityName: form.get("legalEntityName"),
          ein: form.get("ein"),
          registeredAddress: form.get("registeredAddress"),
          docs: [String(form.get("docName") || "kyb-document.pdf")],
          submitForReview: true,
          decision: "APPROVE",
        }),
      });
      onUpdate(updated);
      toast.success("KYB review submitted and approved");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "KYB submission failed");
      throw caught;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>KYB Review</CardTitle>
            <CardDescription>Submit business verification documents</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kyb-legal">Legal entity name</Label>
            <Input
              id="kyb-legal"
              name="legalEntityName"
              placeholder="Legal entity"
              defaultValue="Deeppling Labs Inc"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyb-ein">EIN</Label>
            <Input
              id="kyb-ein"
              name="ein"
              placeholder="EIN"
              defaultValue="12-3456789"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyb-address">Registered address</Label>
            <Input
              id="kyb-address"
              name="registeredAddress"
              placeholder="Registered address"
              defaultValue="100 Commerce St, New York, NY"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyb-doc">Document filename</Label>
            <Input
              id="kyb-doc"
              name="docName"
              placeholder="Doc filename"
              defaultValue="articles.pdf"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!orgId || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Submit + Approve KYB
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
