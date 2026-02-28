"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { apiRequest, type InviteResult } from "@/lib/api";

interface InviteFormProps {
  orgId: string;
  busy: boolean;
}

export function InviteForm({ orgId, busy }: InviteFormProps) {
  const [invite, setInvite] = useState<InviteResult | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    try {
      const invited = await apiRequest<InviteResult>(
        `/orgs/${orgId}/employees/invite`,
        {
          method: "POST",
          body: JSON.stringify({ email: form.get("email") }),
        }
      );
      setInvite(invited);
      toast.success(`Invite sent to ${invited.email}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Invite failed");
      throw caught;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>Invite Employee</CardTitle>
            <CardDescription>Send onboarding invite link</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Employee email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              defaultValue="employee1@deeppling.test"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={!orgId || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Send Invite Link
          </Button>

          {invite ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
              <p className="text-sm font-medium text-foreground">
                Invite generated for {invite.email}
              </p>
              <Link
                href={`/employee/${invite.inviteToken}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {invite.inviteToken.slice(0, 12)}...
                <ExternalLink className="size-3" />
              </Link>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
