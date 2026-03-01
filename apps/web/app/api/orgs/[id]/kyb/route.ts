import { NextRequest } from "next/server";
import { z } from "zod";
import { kybSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { parseBody } from "@/lib/server/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";
import { getAdminProgress } from "@/api-lib/lib/onboardingProgress";

const kybExtendedSchema = kybSchema.extend({
  decision: z.enum(["APPROVE", "REJECT"]).optional(),
  reviewerNotes: z.string().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
    const body = await request.json();
    const payload = parseBody(kybExtendedSchema, body);
    const org = services.onboarding.upsertKyb(id, principal.email, payload);
    const progress = getAdminProgress(org, services.store.getChecklist(id));
    return jsonResponse({
      ...org,
      nextStep: progress.earliestIncompleteStep,
      progress
    });
  } catch (error) {
    return errorResponse(error);
  }
}
