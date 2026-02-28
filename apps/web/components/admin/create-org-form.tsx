"use client";

import { FormEvent } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Building2 } from "lucide-react";
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

interface CreateOrgFormProps {
  onOrgCreated: (org: OrgResponse) => void;
  busy: boolean;
}

export function CreateOrgForm({ onOrgCreated, busy }: CreateOrgFormProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      const created = await apiRequest<OrgResponse>("/orgs", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          domain: form.get("domain"),
          adminEmail: form.get("adminEmail"),
        }),
      });
      onOrgCreated(created);
      toast.success("Workspace created");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Failed to create workspace");
      throw caught;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Create Workspace</CardTitle>
            <CardDescription>Set up your company workspace</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Company name</Label>
            <Input
              id="org-name"
              name="name"
              placeholder="Company name"
              defaultValue="Deeppling Labs"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-domain">Company domain</Label>
            <Input
              id="org-domain"
              name="domain"
              placeholder="Company domain"
              defaultValue="deeppling.test"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-email">Admin email</Label>
            <Input
              id="org-email"
              name="adminEmail"
              type="email"
              placeholder="Admin email"
              defaultValue="admin@deeppling.test"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Create Org
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
