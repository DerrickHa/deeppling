import { NextRequest } from "next/server";
import { treasurySetupSchema } from "@deeppling/shared";
import { getServices } from "@/lib/server/services";
import { getPrincipal, requireRoles } from "@/lib/server/auth";
import { parseBody } from "@/lib/server/http";
import { jsonResponse, errorResponse } from "@/lib/server/response";
import { getAdminProgress } from "@/api-lib/lib/onboardingProgress";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const services = await getServices();
    const principal = getPrincipal(request, services, id);
    requireRoles(principal, ["OrgOwner", "FinanceApprover"]);
    const body = await request.json();
    const payload = parseBody(treasurySetupSchema, body);
    const org = await services.onboarding.setupTreasury(id, principal.email, payload);
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
